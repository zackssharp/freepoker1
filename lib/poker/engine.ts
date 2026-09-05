import {
  createShuffledDeck,
  cryptoRng,
  formatCard,
  type Card,
  type Rng,
} from "./cards";
import { evaluateHand } from "./evaluator";
import type { BotProfileId } from "./profiles";

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown";
export type SeatStatus = "active" | "folded" | "all-in" | "busted";
export type ActionType = "fold" | "check" | "call" | "bet" | "raise";
export type SeatKind = "human" | "bot";
export type HandResult = "won" | "lost" | "folded" | "chopped";
export type TablePhase =
  | "idle"
  | "awaiting-action"
  | "hand-complete"
  | "table-complete";

/** `amount` is the total this seat is betting *to* for the round, not the delta. */
export interface Action {
  type: ActionType;
  amount?: number;
}

export interface Seat {
  id: string;
  name: string;
  kind: SeatKind;
  profileId: BotProfileId | null;
  stack: number;
  /** Chips in front of this seat for the current betting round. */
  committed: number;
  /** Chips this seat has put in across the whole hand -- drives side pots. */
  totalCommitted: number;
  /** Stack at the moment the current hand was dealt. */
  handStartStack: number;
  holeCards: Card[];
  status: SeatStatus;
  hasActed: boolean;
  lastAction: ActionType | null;
  lastAmount: number;
}

export interface Pot {
  amount: number;
  eligibleSeatIds: string[];
}

export interface PotAward {
  seatId: string;
  name: string;
  amount: number;
  handLabel: string | null;
}

export interface HandPlayerSummary {
  seatId: string;
  name: string;
  kind: SeatKind;
  holeCards: Card[];
  handLabel: string | null;
  startingStack: number;
  endingStack: number;
  net: number;
  result: HandResult;
}

export interface HandSummary {
  handNumber: number;
  board: Card[];
  potSize: number;
  wentToShowdown: boolean;
  /** Seats whose hole cards are public now that the hand is over. */
  revealedSeatIds: string[];
  awards: PotAward[];
  players: HandPlayerSummary[];
}

export interface LogEntry {
  id: string;
  handNumber: number;
  street: Street;
  text: string;
}

export interface TableState {
  version: 1;
  handNumber: number;
  seats: Seat[];
  buttonIndex: number;
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  street: Street;
  board: Card[];
  /** Server-only: never send this to the browser. See `lib/poker/view.ts`. */
  deck: Card[];
  currentBet: number;
  /** Size of the last legal raise increment; the next raise must match it. */
  minRaise: number;
  actingSeatId: string | null;
  smallBlindSeatId: string | null;
  bigBlindSeatId: string | null;
  phase: TablePhase;
  log: LogEntry[];
  /** Monotonic counter behind log ids, which stay unique as the log is trimmed. */
  logSeq: number;
  lastHand: HandSummary | null;
}

export interface SeatConfig {
  id: string;
  name: string;
  kind: SeatKind;
  profileId?: BotProfileId | null;
}

export interface TableConfig {
  seats: SeatConfig[];
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
}

export interface LegalActions {
  seatId: string;
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  /** Extra chips needed to call, already clamped to the seat's stack. */
  callAmount: number;
  /** True when nobody has bet yet this round, so the control reads "Bet". */
  isOpen: boolean;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  potSize: number;
  toCall: number;
}

const MAX_LOG_ENTRIES = 240;

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IllegalActionError";
  }
}

function clone(state: TableState): TableState {
  return structuredClone(state);
}

function seatIndexById(state: TableState, seatId: string): number {
  const index = state.seats.findIndex((seat) => seat.id === seatId);
  if (index === -1) throw new IllegalActionError(`Unknown seat: ${seatId}`);
  return index;
}

function seatById(state: TableState, seatId: string): Seat {
  return state.seats[seatIndexById(state, seatId)] as Seat;
}

/** Seat indices in table order, starting at `startIndex` and wrapping once. */
function orderFrom(state: TableState, startIndex: number): number[] {
  const count = state.seats.length;
  const order: number[] = [];
  for (let step = 0; step < count; step++) {
    order.push((startIndex + step) % count);
  }
  return order;
}

/** Still in the hand: has not folded and is not busted. */
function isLive(seat: Seat): boolean {
  return seat.status === "active" || seat.status === "all-in";
}

/** Still in the hand *and* has chips behind, so can still be asked to act. */
function isActionable(seat: Seat): boolean {
  return seat.status === "active";
}

function totalPot(state: TableState): number {
  return state.seats.reduce((sum, seat) => sum + seat.totalCommitted, 0);
}

function log(state: TableState, text: string): void {
  // `log.length` stops growing once the log is capped, so it cannot be the id:
  // every entry after the cap would collide and React would reuse the wrong
  // row. `?? state.log.length` picks up states persisted before this counter.
  const seq = (state.logSeq ?? state.log.length) + 1;
  state.logSeq = seq;

  state.log.push({
    id: `${state.handNumber}:${seq}`,
    handNumber: state.handNumber,
    street: state.street,
    text,
  });
  if (state.log.length > MAX_LOG_ENTRIES) {
    state.log.splice(0, state.log.length - MAX_LOG_ENTRIES);
  }
}

function draw(state: TableState, count: number): Card[] {
  if (state.deck.length < count) {
    throw new Error("Deck exhausted");
  }
  return state.deck.splice(0, count);
}

export function createTable(config: TableConfig): TableState {
  if (config.seats.length < 2) {
    throw new Error("A table needs at least two seats");
  }

  return {
    version: 1,
    handNumber: 0,
    seats: config.seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      kind: seat.kind,
      profileId: seat.profileId ?? null,
      stack: config.startingStack,
      committed: 0,
      totalCommitted: 0,
      handStartStack: config.startingStack,
      holeCards: [],
      status: "active",
      hasActed: false,
      lastAction: null,
      lastAmount: 0,
    })),
    // The first `startHand` advances the button, so seat 0 gets it.
    buttonIndex: config.seats.length - 1,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    startingStack: config.startingStack,
    street: "preflop",
    board: [],
    deck: [],
    currentBet: 0,
    minRaise: config.bigBlind,
    actingSeatId: null,
    smallBlindSeatId: null,
    bigBlindSeatId: null,
    phase: "idle",
    log: [],
    logSeq: 0,
    lastHand: null,
  };
}

function postBlind(
  state: TableState,
  seat: Seat,
  amount: number,
  label: string,
): void {
  const posted = Math.min(amount, seat.stack);
  seat.stack -= posted;
  seat.committed += posted;
  seat.totalCommitted += posted;
  if (seat.stack === 0) seat.status = "all-in";
  log(state, `${seat.name} posts the ${label} (${posted})`);
}

/**
 * Deals the next hand. Returns a `table-complete` table if fewer than two
 * seats still have chips.
 */
export function startHand(state: TableState, rng: Rng = cryptoRng): TableState {
  const next = clone(state);

  for (const seat of next.seats) {
    seat.committed = 0;
    seat.totalCommitted = 0;
    seat.holeCards = [];
    seat.hasActed = false;
    seat.lastAction = null;
    seat.lastAmount = 0;
    seat.handStartStack = seat.stack;
    seat.status = seat.stack > 0 ? "active" : "busted";
  }

  if (next.seats.filter((seat) => seat.status === "active").length < 2) {
    next.phase = "table-complete";
    next.actingSeatId = null;
    return next;
  }

  next.handNumber += 1;
  next.street = "preflop";
  next.board = [];
  next.deck = createShuffledDeck(rng);
  next.currentBet = 0;
  next.minRaise = next.bigBlind;
  next.phase = "awaiting-action";
  next.lastHand = null;

  // Move the button to the next seat that still has chips.
  const nextButton = orderFrom(
    next,
    (next.buttonIndex + 1) % next.seats.length,
  ).find((index) => isActionable(next.seats[index] as Seat));
  next.buttonIndex = nextButton ?? next.buttonIndex;

  log(next, `Hand #${next.handNumber} is dealt`);

  const inOrder = orderFrom(
    next,
    (next.buttonIndex + 1) % next.seats.length,
  ).filter((index) => isActionable(next.seats[index] as Seat));
  const headsUp = inOrder.length === 2;

  // Heads-up, the button posts the small blind and acts first before the flop.
  const smallBlindIndex = headsUp ? next.buttonIndex : (inOrder[0] as number);
  const bigBlindIndex = headsUp
    ? (inOrder.find((index) => index !== next.buttonIndex) as number)
    : (inOrder[1] as number);

  // Two cards each, one at a time, starting to the left of the button.
  for (let pass = 0; pass < 2; pass++) {
    for (const index of inOrder) {
      (next.seats[index] as Seat).holeCards.push(...draw(next, 1));
    }
  }

  next.smallBlindSeatId = (next.seats[smallBlindIndex] as Seat).id;
  next.bigBlindSeatId = (next.seats[bigBlindIndex] as Seat).id;

  postBlind(
    next,
    next.seats[smallBlindIndex] as Seat,
    next.smallBlind,
    "small blind",
  );
  postBlind(next, next.seats[bigBlindIndex] as Seat, next.bigBlind, "big blind");

  next.currentBet = Math.max(...next.seats.map((seat) => seat.committed));

  const firstToAct = headsUp
    ? smallBlindIndex
    : (orderFrom(next, (bigBlindIndex + 1) % next.seats.length).find((index) =>
        isActionable(next.seats[index] as Seat),
      ) ?? bigBlindIndex);

  next.actingSeatId = (next.seats[firstToAct] as Seat).id;

  // A blind can be all-in before anyone gets to act, so settle before returning.
  advance(next, firstToAct);
  return next;
}

export function legalActions(state: TableState): LegalActions | null {
  if (state.phase !== "awaiting-action" || !state.actingSeatId) return null;

  const seat = seatById(state, state.actingSeatId);
  const toCall = Math.max(0, state.currentBet - seat.committed);
  const callAmount = Math.min(toCall, seat.stack);
  const maxRaiseTo = seat.committed + seat.stack;
  // A full-sized raise clears `hasActed` for everyone else, so a seat that is
  // asked to act again while still flagged as having acted is facing nothing
  // but a short all-in. That does not reopen the betting: call or fold only.
  const canRaise = seat.stack > toCall && !seat.hasActed;
  const minRaiseTo = Math.min(state.currentBet + state.minRaise, maxRaiseTo);

  return {
    seatId: seat.id,
    canFold: true,
    canCheck: toCall === 0,
    canCall: toCall > 0,
    callAmount,
    isOpen: state.currentBet === 0,
    canRaise,
    minRaiseTo,
    maxRaiseTo,
    potSize: totalPot(state),
    toCall,
  };
}

export function applyAction(
  state: TableState,
  seatId: string,
  action: Action,
): TableState {
  if (state.phase !== "awaiting-action") {
    throw new IllegalActionError(`No action is pending (phase: ${state.phase})`);
  }
  if (state.actingSeatId !== seatId) {
    throw new IllegalActionError("It is not that seat's turn to act");
  }

  const next = clone(state);
  const options = legalActions(next);
  if (!options) throw new IllegalActionError("No legal actions available");

  const seatIndex = seatIndexById(next, seatId);
  const seat = next.seats[seatIndex] as Seat;

  switch (action.type) {
    case "fold": {
      seat.status = "folded";
      seat.lastAction = "fold";
      seat.lastAmount = 0;
      log(next, `${seat.name} folds`);
      break;
    }
    case "check": {
      if (!options.canCheck) {
        throw new IllegalActionError(
          `${seat.name} cannot check facing a bet of ${options.toCall}`,
        );
      }
      seat.lastAction = "check";
      seat.lastAmount = 0;
      log(next, `${seat.name} checks`);
      break;
    }
    case "call": {
      if (!options.canCall) {
        throw new IllegalActionError(`${seat.name} has nothing to call`);
      }
      commit(seat, options.callAmount);
      seat.lastAction = "call";
      seat.lastAmount = options.callAmount;
      log(
        next,
        seat.status === "all-in"
          ? `${seat.name} calls ${options.callAmount} and is all in`
          : `${seat.name} calls ${options.callAmount}`,
      );
      break;
    }
    case "bet":
    case "raise": {
      if (!options.canRaise) {
        throw new IllegalActionError(
          seat.hasActed && options.toCall > 0
            ? `${seat.name} cannot raise; a short all-in does not reopen the betting`
            : `${seat.name} cannot raise`,
        );
      }
      const target = Math.floor(action.amount ?? 0);
      if (!Number.isFinite(target)) {
        throw new IllegalActionError("Bet amount must be a number");
      }
      if (target > options.maxRaiseTo) {
        throw new IllegalActionError(
          `${seat.name} cannot bet ${target}; the maximum is ${options.maxRaiseTo}`,
        );
      }
      // Below the minimum is legal only as an all-in for the whole stack.
      if (target < options.minRaiseTo && target !== options.maxRaiseTo) {
        throw new IllegalActionError(
          `The minimum is ${options.minRaiseTo}; ${target} is short of a legal raise`,
        );
      }

      const increment = target - next.currentBet;
      commit(seat, target - seat.committed);
      seat.lastAction = options.isOpen ? "bet" : "raise";
      seat.lastAmount = target;

      // A short all-in raises the price but does not reopen the betting.
      if (increment >= next.minRaise) {
        next.minRaise = increment;
        for (const other of next.seats) {
          if (other.id !== seat.id && isActionable(other)) other.hasActed = false;
        }
      }
      next.currentBet = Math.max(next.currentBet, target);

      const verb = options.isOpen ? "bets" : "raises to";
      log(
        next,
        seat.status === "all-in"
          ? `${seat.name} ${verb} ${target} and is all in`
          : `${seat.name} ${verb} ${target}`,
      );
      break;
    }
    default: {
      const exhaustive: never = action.type;
      throw new IllegalActionError(`Unsupported action: ${String(exhaustive)}`);
    }
  }

  seat.hasActed = true;
  advance(next, (seatIndex + 1) % next.seats.length);
  return next;
}

function commit(seat: Seat, amount: number): void {
  const paid = Math.min(Math.max(0, amount), seat.stack);
  seat.stack -= paid;
  seat.committed += paid;
  seat.totalCommitted += paid;
  if (seat.stack === 0) seat.status = "all-in";
}

/**
 * Runs the hand forward until a player actually has a decision to make, or
 * until the hand is over. `searchFrom` is the seat index to start looking from
 * for the next actor.
 */
function advance(state: TableState, searchFrom: number): void {
  let from = searchFrom;

  for (;;) {
    if (state.seats.filter(isLive).length <= 1) {
      completeHand(state, false);
      return;
    }

    const actionable = state.seats.filter(isActionable);
    // With at most one player left holding chips there is nobody to bet
    // against, so matching the current bet is all that is left to settle.
    const roundComplete =
      actionable.length <= 1
        ? actionable.every((seat) => seat.committed === state.currentBet)
        : actionable.every(
            (seat) => seat.hasActed && seat.committed === state.currentBet,
          );

    if (!roundComplete) {
      const nextIndex = orderFrom(state, from).find((index) => {
        const seat = state.seats[index] as Seat;
        return (
          isActionable(seat) &&
          !(seat.hasActed && seat.committed === state.currentBet)
        );
      });

      if (nextIndex !== undefined) {
        state.actingSeatId = (state.seats[nextIndex] as Seat).id;
        state.phase = "awaiting-action";
        return;
      }
    }

    if (state.street === "river") {
      closeBettingRound(state);
      state.street = "showdown";
      completeHand(state, true);
      return;
    }

    closeBettingRound(state);
    dealTo(state, nextStreet(state.street));
    from = (state.buttonIndex + 1) % state.seats.length;
  }
}

function nextStreet(street: Street): Street {
  switch (street) {
    case "preflop":
      return "flop";
    case "flop":
      return "turn";
    case "turn":
      return "river";
    default:
      return "showdown";
  }
}

function closeBettingRound(state: TableState): void {
  for (const seat of state.seats) {
    seat.committed = 0;
    seat.hasActed = false;
    seat.lastAction = null;
    seat.lastAmount = 0;
  }
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.actingSeatId = null;
}

function dealTo(state: TableState, street: Street): void {
  state.street = street;
  if (street === "showdown") return;

  const count = street === "flop" ? 3 : 1;
  draw(state, 1); // burn card
  const dealt = draw(state, count);
  state.board.push(...dealt);

  const streetName =
    street === "flop" ? "Flop" : street === "turn" ? "Turn" : "River";
  log(state, `${streetName}: ${dealt.map(formatCard).join(" ")}`);
}

function sameSeats(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Splits the hand's chips into a main pot plus one side pot per all-in level.
 * Money at a level nobody is eligible for rolls forward into the next pot.
 */
export function buildPots(seats: readonly Seat[]): Pot[] {
  const contributors = seats.filter((seat) => seat.totalCommitted > 0);
  if (contributors.length === 0) return [];

  const levels = [
    ...new Set(contributors.map((seat) => seat.totalCommitted)),
  ].sort((a, b) => a - b);

  const pots: Pot[] = [];
  let previousLevel = 0;
  let carried = 0;

  for (const level of levels) {
    let amount = carried;
    carried = 0;

    for (const seat of contributors) {
      amount +=
        Math.min(seat.totalCommitted, level) -
        Math.min(seat.totalCommitted, previousLevel);
    }

    const eligibleSeatIds = contributors
      .filter((seat) => seat.totalCommitted >= level && isLive(seat))
      .map((seat) => seat.id);

    if (amount > 0 && eligibleSeatIds.length > 0) {
      // Consecutive levels contested by exactly the same seats are one pot;
      // splitting them would pay the same winner twice for a single pot.
      const previous = pots[pots.length - 1];
      if (previous && sameSeats(previous.eligibleSeatIds, eligibleSeatIds)) {
        previous.amount += amount;
      } else {
        pots.push({ amount, eligibleSeatIds });
      }
    } else {
      carried = amount;
    }
    previousLevel = level;
  }

  if (carried > 0) {
    const lastPot = pots[pots.length - 1];
    if (lastPot) lastPot.amount += carried;
  }

  return pots;
}

/**
 * Hands back the top bettor's chips that nobody was ever able to match -- an
 * over-bet against a shorter stack, or a bet everyone folded to. Without this
 * they would be paid back out as if they had been won, so the log, the pot
 * size and the recorded stats would all credit chips that were never at risk.
 */
function returnUncalledBet(state: TableState): void {
  const amounts = state.seats
    .map((seat) => seat.totalCommitted)
    .sort((a, b) => b - a);

  const highest = amounts[0] ?? 0;
  const second = amounts[1] ?? 0;
  if (highest <= 0 || highest <= second) return;

  // `highest > second` makes the top contributor unique.
  const seat = state.seats.find((candidate) => candidate.totalCommitted === highest);
  if (!seat) return;

  const refund = highest - second;
  seat.totalCommitted -= refund;
  seat.stack += refund;
  // Betting past everyone else's stack does not leave you all in.
  if (seat.status === "all-in" && seat.stack > 0) seat.status = "active";

  log(state, `${seat.name} takes back the uncalled ${refund}`);
}

function completeHand(state: TableState, wentToShowdown: boolean): void {
  returnUncalledBet(state);

  const potTotal = totalPot(state);
  const pots = buildPots(state.seats);
  const live = state.seats.filter(isLive);

  for (const seat of state.seats) {
    seat.committed = 0;
  }

  const ranked = new Map<string, { score: number; label: string }>();
  if (wentToShowdown) {
    for (const seat of live) {
      const rank = evaluateHand([...seat.holeCards, ...state.board]);
      ranked.set(seat.id, { score: rank.score, label: rank.label });
    }
  }

  const awards: PotAward[] = [];
  const winnings = new Map<string, number>();
  const chopped = new Set<string>();

  // Odd chips go to the first eligible seat to the left of the button.
  const oddChipOrder = orderFrom(
    state,
    (state.buttonIndex + 1) % state.seats.length,
  );

  for (const pot of pots) {
    const eligible = pot.eligibleSeatIds
      .map((id) => seatById(state, id))
      .filter(isLive);
    if (eligible.length === 0) continue;

    let winners: Seat[];
    if (!wentToShowdown || eligible.length === 1) {
      winners = eligible.slice(0, 1);
    } else {
      const best = Math.max(
        ...eligible.map((seat) => ranked.get(seat.id)?.score ?? 0),
      );
      winners = eligible.filter(
        (seat) => (ranked.get(seat.id)?.score ?? 0) === best,
      );
    }

    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - share * winners.length;

    const orderedWinners = oddChipOrder
      .map((index) => state.seats[index] as Seat)
      .filter((seat) => winners.some((winner) => winner.id === seat.id));

    for (const winner of orderedWinners) {
      let amount = share;
      if (remainder > 0) {
        amount += 1;
        remainder -= 1;
      }
      winner.stack += amount;
      winnings.set(winner.id, (winnings.get(winner.id) ?? 0) + amount);
      if (winners.length > 1) chopped.add(winner.id);
      awards.push({
        seatId: winner.id,
        name: winner.name,
        amount,
        handLabel: ranked.get(winner.id)?.label ?? null,
      });
    }
  }

  const revealedSeatIds =
    wentToShowdown && live.length > 1 ? live.map((seat) => seat.id) : [];

  const players: HandPlayerSummary[] = state.seats
    .filter((seat) => seat.handStartStack > 0)
    .map((seat) => {
      const revealed = revealedSeatIds.includes(seat.id);
      const won = (winnings.get(seat.id) ?? 0) > 0;
      const result: HandResult =
        seat.status === "folded"
          ? "folded"
          : won && chopped.has(seat.id)
            ? "chopped"
            : won
              ? "won"
              : "lost";

      return {
        seatId: seat.id,
        name: seat.name,
        kind: seat.kind,
        holeCards: revealed ? seat.holeCards.slice() : [],
        handLabel: revealed ? (ranked.get(seat.id)?.label ?? null) : null,
        startingStack: seat.handStartStack,
        endingStack: seat.stack,
        net: seat.stack - seat.handStartStack,
        result,
      };
    });

  for (const award of awards) {
    log(
      state,
      award.handLabel
        ? `${award.name} wins ${award.amount} with ${award.handLabel}`
        : `${award.name} wins ${award.amount}`,
    );
  }

  state.lastHand = {
    handNumber: state.handNumber,
    board: state.board.slice(),
    potSize: potTotal,
    wentToShowdown,
    revealedSeatIds,
    awards,
    players,
  };

  // The pot has been paid out, so nothing is owed to the middle any more.
  for (const seat of state.seats) {
    seat.totalCommitted = 0;
    if (seat.stack === 0 && seat.status !== "busted") seat.status = "busted";
  }

  state.actingSeatId = null;
  state.phase =
    state.seats.filter((seat) => seat.stack > 0).length < 2
      ? "table-complete"
      : "hand-complete";
}

export function potSize(state: TableState): number {
  return totalPot(state);
}

export function seatOf(state: TableState, seatId: string): Seat | undefined {
  return state.seats.find((seat) => seat.id === seatId);
}
