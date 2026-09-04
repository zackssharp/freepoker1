import { createDeck, cryptoRng, type Card, type Rng } from "./cards";
import { evaluateHand, preflopStrength } from "./evaluator";
import {
  legalActions,
  type Action,
  type LegalActions,
  type Seat,
  type Street,
  type TableState,
} from "./engine";
import { BOT_PROFILES, type BotProfile } from "./profiles";

/** Monte Carlo sample sizes, by street. Later streets have less to simulate. */
const DEFAULT_ITERATIONS: Record<Street, number> = {
  preflop: 240,
  flop: 320,
  turn: 400,
  river: 400,
  showdown: 0,
};

export interface EquityInput {
  hole: readonly Card[];
  board: readonly Card[];
  opponents: number;
  iterations: number;
  rng: Rng;
}

/**
 * Win probability against `opponents` random hands, by simulation. Ties count
 * as a fractional win, so the result is directly comparable to pot odds.
 *
 * This is the expensive part of a bot's turn, which is exactly why bot turns
 * are resolved inside Server Actions and never shipped to the browser.
 */
export function estimateEquity({
  hole,
  board,
  opponents,
  iterations,
  rng,
}: EquityInput): number {
  if (opponents <= 0) return 1;

  const known = new Set<string>([...hole, ...board]);
  const available = createDeck().filter((card) => !known.has(card));
  const boardToCome = 5 - board.length;
  const needed = opponents * 2 + boardToCome;

  if (needed > available.length) return 0;

  let equity = 0;

  for (let iteration = 0; iteration < iterations; iteration++) {
    const pool = available.slice();
    // Partial Fisher-Yates: only shuffle the cards we are about to deal.
    for (let i = 0; i < needed; i++) {
      const j = i + Math.floor(rng() * (pool.length - i));
      const a = pool[i] as Card;
      const b = pool[j] as Card;
      pool[i] = b;
      pool[j] = a;
    }

    const runout = pool.slice(0, boardToCome);
    const fullBoard = [...board, ...runout];
    const heroScore = evaluateHand([...hole, ...fullBoard]).score;

    let bestOpponent = -1;
    let tiedAtBest = 0;

    for (let opponent = 0; opponent < opponents; opponent++) {
      const offset = boardToCome + opponent * 2;
      const opponentScore = evaluateHand([
        pool[offset] as Card,
        pool[offset + 1] as Card,
        ...fullBoard,
      ]).score;

      if (opponentScore > bestOpponent) {
        bestOpponent = opponentScore;
        tiedAtBest = 1;
      } else if (opponentScore === bestOpponent) {
        tiedAtBest += 1;
      }
    }

    if (heroScore > bestOpponent) equity += 1;
    else if (heroScore === bestOpponent) equity += 1 / (tiedAtBest + 1);
  }

  return equity / iterations;
}

export interface BotDecisionOptions {
  rng?: Rng;
  /** Overrides the per-street Monte Carlo sample size; lower is faster. */
  iterations?: number;
}

export interface BotDecision {
  action: Action;
  /** Why the bot did that -- surfaced in the table log. */
  reason: string;
  equity: number;
}

function roundToBlind(amount: number, bigBlind: number): number {
  return Math.max(bigBlind, Math.round(amount / bigBlind) * bigBlind);
}

/**
 * Chooses an action for a bot seat: simulate equity, compare it against the
 * pot odds and against what an average hand would be worth, then let the
 * personality decide how hard to lean on the answer.
 */
export function decideBotAction(
  state: TableState,
  seatId: string,
  options: BotDecisionOptions = {},
): BotDecision {
  const rng = options.rng ?? cryptoRng;
  const legal = legalActions(state);

  if (!legal || legal.seatId !== seatId) {
    throw new Error("It is not that bot's turn to act");
  }

  const seat = state.seats.find((candidate) => candidate.id === seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);

  const profile: BotProfile =
    BOT_PROFILES[seat.profileId ?? "pro"] ?? BOT_PROFILES.pro;

  const opponents = state.seats.filter(
    (other) =>
      other.id !== seat.id &&
      (other.status === "active" || other.status === "all-in"),
  ).length;

  if (state.street === "preflop" && seat.holeCards.length === 2) {
    return decidePreflop(state, seat, profile, opponents, legal, rng);
  }

  const equity = estimateEquity({
    hole: seat.holeCards,
    board: state.board,
    opponents,
    iterations: options.iterations ?? DEFAULT_ITERATIONS[state.street],
    rng,
  });

  // 1.0 means "an average hand for this many opponents".
  const relative = equity * (opponents + 1);
  const potOdds =
    legal.callAmount > 0
      ? legal.callAmount / (legal.potSize + legal.callAmount)
      : 0;
  const requiredEquity = potOdds * profile.callLooseness;

  const wantsValue = relative >= profile.valueRatio;
  const monster = relative >= profile.valueRatio * 1.6;
  const traps = monster && rng() < profile.trapRate;

  const raiseTarget = (fraction: number): number => {
    const raw = state.currentBet + Math.round(legal.potSize * fraction);
    const clamped = Math.min(
      Math.max(roundToBlind(raw, state.bigBlind), legal.minRaiseTo),
      legal.maxRaiseTo,
    );
    // Do not leave a token amount behind; just move in.
    return clamped > legal.maxRaiseTo * 0.72 ? legal.maxRaiseTo : clamped;
  };

  if (legal.canCheck) {
    if (wantsValue && !traps && legal.canRaise) {
      return {
        action: { type: "bet", amount: raiseTarget(profile.betSizing) },
        reason: `bets for value (${Math.round(equity * 100)}% equity)`,
        equity,
      };
    }

    if (legal.canRaise && !wantsValue && rng() < profile.bluffRate) {
      return {
        action: { type: "bet", amount: raiseTarget(profile.betSizing * 0.7) },
        reason: "fires a bluff",
        equity,
      };
    }

    return {
      action: { type: "check" },
      reason: traps ? "traps with a monster" : "checks",
      equity,
    };
  }

  // Facing a bet.
  if (equity < requiredEquity) {
    // Never fold when the call is free-ish relative to a huge pot; and give
    // the loosest personalities a small chance to look anyway.
    const curiosity = rng() < profile.bluffRate * 0.5;
    if (!curiosity) {
      return {
        action: { type: "fold" },
        reason: `folds (${Math.round(equity * 100)}% vs ${Math.round(
          requiredEquity * 100,
        )}% needed)`,
        equity,
      };
    }
  }

  if (wantsValue && !traps && legal.canRaise) {
    return {
      action: { type: "raise", amount: raiseTarget(profile.betSizing) },
      reason: `raises for value (${Math.round(equity * 100)}% equity)`,
      equity,
    };
  }

  return {
    action: { type: "call" },
    reason: traps ? "flat-calls with a monster" : "calls",
    equity,
  };
}

/**
 * Preflop is decided from a Chen-style hand ranking rather than simulated
 * equity. Raw equity against N random hands says almost everything is a fold
 * six-handed, which ignores implied odds and the fact that most of the table
 * folds behind -- a strength model plays far closer to how the street runs.
 */
function decidePreflop(
  state: TableState,
  seat: Seat,
  profile: BotProfile,
  opponents: number,
  legal: LegalActions,
  rng: Rng,
): BotDecision {
  const hole: [Card, Card] = [seat.holeCards[0] as Card, seat.holeCards[1] as Card];
  const strength = preflopStrength(hole);
  const crowdPenalty = 0.022 * Math.max(0, opponents - 1);

  const openAt = profile.preflopOpen + crowdPenalty;
  const raiseAt = openAt + 0.12;

  const potOdds =
    legal.callAmount > 0
      ? legal.callAmount / (legal.potSize + legal.callAmount)
      : 0;
  // A standard open lays about 0.33; anything pricier needs a better hand.
  const priceFactor = 1 + 2.2 * Math.max(0, potOdds - 0.33);
  const callAt = profile.preflopCall * priceFactor + crowdPenalty;

  const openSize = () => {
    const limpers = state.seats.filter(
      (other) => other.id !== seat.id && other.committed >= state.bigBlind,
    ).length;
    const target = state.currentBet * 3 + state.bigBlind * limpers;
    return Math.min(
      Math.max(roundToBlind(target, state.bigBlind), legal.minRaiseTo),
      legal.maxRaiseTo,
    );
  };

  if (legal.canCheck) {
    if (strength >= openAt && legal.canRaise) {
      return {
        action: { type: "raise", amount: openSize() },
        reason: "opens for a raise",
        equity: strength,
      };
    }
    return { action: { type: "check" }, reason: "checks", equity: strength };
  }

  if (strength >= raiseAt && legal.canRaise && rng() > profile.trapRate) {
    return {
      action: { type: "raise", amount: openSize() },
      reason: "three-bets a premium",
      equity: strength,
    };
  }

  if (strength >= callAt) {
    return { action: { type: "call" }, reason: "calls to see a flop", equity: strength };
  }

  return {
    action: { type: "fold" },
    reason: "folds a weak holding",
    equity: strength,
  };
}

export function isBotSeat(seat: Seat): boolean {
  return seat.kind === "bot";
}
