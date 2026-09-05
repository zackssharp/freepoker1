/**
 * Rules fuzzer for the betting engine.
 *
 * `simulate.ts` plays bot-vs-bot tables and checks that chips are conserved.
 * This script goes after the rules themselves: it drives the engine with
 * arbitrary *legal* actions -- including the minimum raises and awkward short
 * all-ins the bots rarely choose -- and asserts the things a dealer would.
 * Payouts are checked against a side-pot distribution computed independently
 * of `buildPots`, so the two have to agree.
 *
 * Run with: npx tsx scripts/verify-rules.ts [seed]
 */
import { mulberry32, type Card } from "../lib/poker/cards";
import {
  applyAction,
  buildPots,
  createTable,
  legalActions,
  startHand,
  type Action,
  type Seat,
  type TableState,
} from "../lib/poker/engine";
import { evaluateHand } from "../lib/poker/evaluator";

const rng = mulberry32(Number(process.argv[2] ?? 4242));

let failures = 0;
const reported = new Set<string>();

function fail(kind: string, detail: string, state?: TableState): void {
  failures += 1;
  if (reported.has(kind)) return; // One dump per kind is enough to debug it.
  reported.add(kind);
  console.log(`FAIL [${kind}] ${detail}`);
  if (state) {
    console.log(
      JSON.stringify(
        {
          hand: state.handNumber,
          street: state.street,
          phase: state.phase,
          currentBet: state.currentBet,
          minRaise: state.minRaise,
          acting: state.actingSeatId,
          button: state.buttonIndex,
          board: state.board,
          seats: state.seats.map((seat) => ({
            id: seat.id,
            stack: seat.stack,
            committed: seat.committed,
            total: seat.totalCommitted,
            status: seat.status,
            acted: seat.hasActed,
          })),
        },
        null,
        1,
      ),
    );
  }
}

const BOARD_SIZE: Record<string, number> = {
  preflop: 0,
  flop: 3,
  turn: 4,
  river: 5,
};

/** Any legal action, weighted to hit minimum raises and shoves often. */
function randomAction(state: TableState): Action {
  const legal = legalActions(state) as NonNullable<ReturnType<typeof legalActions>>;
  const roll = rng();

  if (legal.canRaise && roll < 0.35) {
    const size = rng();
    const amount =
      size < 0.4
        ? legal.minRaiseTo
        : size < 0.7
          ? legal.maxRaiseTo
          : Math.max(
              legal.minRaiseTo,
              Math.min(
                legal.maxRaiseTo,
                Math.round(
                  legal.minRaiseTo + rng() * (legal.maxRaiseTo - legal.minRaiseTo),
                ),
              ),
            );
    return { type: legal.isOpen ? "bet" : "raise", amount };
  }

  if (legal.canCheck) return { type: "check" };
  return roll < 0.72 ? { type: "call" } : { type: "fold" };
}

/**
 * Side-pot distribution worked out from scratch: slice the chips at every
 * all-in level and give each slice to the best live hand among the seats that
 * paid into it. Deliberately does not share code with `buildPots`.
 */
function referencePayout(
  seats: Seat[],
  board: Card[],
  showdown: boolean,
  buttonOrder: readonly string[],
): Map<string, number> {
  const payout = new Map<string, number>();
  const live = seats.filter(
    (seat) => seat.status === "active" || seat.status === "all-in",
  );

  const score = new Map<string, number>();
  if (showdown) {
    for (const seat of live) {
      score.set(seat.id, evaluateHand([...seat.holeCards, ...board]).score);
    }
  }

  // Nobody should still have chips in the pot that no opponent ever matched.
  const amounts = seats.map((seat) => seat.totalCommitted).sort((a, b) => b - a);
  if ((amounts[0] ?? 0) > (amounts[1] ?? 0)) {
    payout.set("__uncalled__", (amounts[0] ?? 0) - (amounts[1] ?? 0));
  }

  const levels = [
    ...new Set(seats.filter((s) => s.totalCommitted > 0).map((s) => s.totalCommitted)),
  ].sort((a, b) => a - b);

  let previous = 0;
  let carried = 0;

  for (const level of levels) {
    let amount = carried;
    carried = 0;
    for (const seat of seats) {
      amount +=
        Math.min(seat.totalCommitted, level) -
        Math.min(seat.totalCommitted, previous);
    }
    previous = level;

    const eligible = live.filter((seat) => seat.totalCommitted >= level);
    if (eligible.length === 0) {
      carried = amount;
      continue;
    }

    let winners = eligible;
    if (showdown && eligible.length > 1) {
      const best = Math.max(...eligible.map((seat) => score.get(seat.id) as number));
      winners = eligible.filter((seat) => score.get(seat.id) === best);
    } else {
      winners = eligible.slice(0, 1);
    }

    const share = Math.floor(amount / winners.length);
    let remainder = amount - share * winners.length;

    // Odd chips go to the first winner left of the button.
    for (const winner of [...winners].sort(
      (a, b) => buttonOrder.indexOf(a.id) - buttonOrder.indexOf(b.id),
    )) {
      let take = share;
      if (remainder > 0) {
        take += 1;
        remainder -= 1;
      }
      payout.set(winner.id, (payout.get(winner.id) ?? 0) + take);
    }
  }

  if (carried > 0) payout.set("__carried__", carried);
  return payout;
}

let handsPlayed = 0;
let showdowns = 0;
let shortAllIns = 0;
let bigBlindOptions = 0;

for (const seatCount of [2, 3, 4, 5, 6]) {
  for (let table = 0; table < 60; table++) {
    const startingStack = 200 + Math.floor(rng() * 1200);
    const bigBlind = [10, 20, 50][Math.floor(rng() * 3)] as number;

    let state = createTable({
      seats: Array.from({ length: seatCount }, (_, index) => ({
        id: `s${index}`,
        name: `P${index}`,
        kind: "bot" as const,
        profileId: "pro" as const,
      })),
      smallBlind: bigBlind / 2,
      bigBlind,
      startingStack,
    });

    const bankroll = seatCount * startingStack;
    let previousButton = state.buttonIndex;

    for (let hand = 0; hand < 40 && state.phase !== "table-complete"; hand++) {
      const before = state;
      state = startHand(state, rng);
      if (state.phase === "table-complete") break;
      handsPlayed += 1;

      // --- Setup ---------------------------------------------------------
      if (before.handNumber > 0) {
        const seat = state.seats[state.buttonIndex] as Seat;
        if (seat.handStartStack <= 0) fail("button-broke", "button on a busted seat", state);
        if (
          state.buttonIndex === previousButton &&
          state.seats.filter((s) => s.handStartStack > 0).length > 1
        ) {
          fail("button-stuck", `button stayed at ${state.buttonIndex}`, state);
        }
      }
      previousButton = state.buttonIndex;

      const order: number[] = [];
      for (let step = 1; step <= state.seats.length; step++) {
        const index = (state.buttonIndex + step) % state.seats.length;
        if ((state.seats[index] as Seat).handStartStack > 0) order.push(index);
      }
      if (order.length === 2) {
        if (state.smallBlindSeatId !== (state.seats[state.buttonIndex] as Seat).id) {
          fail("hu-blinds", "heads-up button is not the small blind", state);
        }
      } else {
        if ((state.seats[order[0] as number] as Seat).id !== state.smallBlindSeatId) {
          fail("sb-seat", "small blind is not left of the button", state);
        }
        if ((state.seats[order[1] as number] as Seat).id !== state.bigBlindSeatId) {
          fail("bb-seat", "big blind is not two seats left of the button", state);
        }
      }

      for (const seat of state.seats) {
        const expected = seat.handStartStack > 0 ? 2 : 0;
        if (seat.holeCards.length !== expected) {
          fail("hole-count", `${seat.id} holds ${seat.holeCards.length}, expected ${expected}`, state);
        }
      }

      // --- Betting -------------------------------------------------------
      const bigBlindId = state.bigBlindSeatId;
      const bigBlindCouldAct =
        (state.seats.find((s) => s.id === bigBlindId) as Seat).status === "active";
      let preflopRaised = false;
      let bigBlindActed = false;
      let actionableAfterPreflop = 0;

      const actedThisRound = new Set<string>();
      // Streets where a full-sized bet or raise has legitimately reopened play.
      const reopened = new Set<string>();
      let round: string = state.street;
      let guard = 0;

      while (state.phase === "awaiting-action") {
        if (guard++ > 800) {
          fail("no-terminate", "the hand never resolved", state);
          break;
        }

        const legal = legalActions(state) as NonNullable<ReturnType<typeof legalActions>>;
        const actor = state.seats.find((s) => s.id === legal.seatId) as Seat;

        if (state.street !== round) {
          actedThisRound.clear();
          reopened.delete(round);
          round = state.street;
        }

        if (actor.status !== "active") {
          fail("acting-inactive", `${actor.id} is ${actor.status} but is to act`, state);
        }
        if (BOARD_SIZE[state.street] !== state.board.length) {
          fail("board-size", `${state.street} with ${state.board.length} board cards`, state);
        }
        if (legal.minRaiseTo > legal.maxRaiseTo) fail("min-over-max", "minRaiseTo above maxRaiseTo", state);
        if (legal.canCheck !== (legal.toCall === 0)) fail("check-parity", "canCheck disagrees with toCall", state);
        if (legal.canCheck && legal.canCall) fail("check-and-call", "check and call both offered", state);
        if (legal.callAmount > actor.stack) fail("call-over-stack", "callAmount exceeds the stack", state);
        if (legal.maxRaiseTo !== actor.committed + actor.stack) fail("shove-size", "maxRaiseTo is not the whole stack", state);
        if (legal.potSize !== state.seats.reduce((n, s) => n + s.totalCommitted, 0)) {
          fail("pot-size", "potSize disagrees with the chips in front", state);
        }

        // An all-in for less than a full raise does not reopen the betting:
        // a seat that already acted may only call or fold.
        if (!reopened.has(state.street) && actor.hasActed && legal.toCall > 0 && legal.canRaise) {
          fail("reopen", `${actor.id} may re-raise facing only a short all-in`, state);
        }

        if (state.street === "preflop" && actor.id === bigBlindId) bigBlindActed = true;

        const betBefore = state.currentBet;
        const streetBefore = state.street;
        const action = randomAction(state);

        if (action.type === "bet" || action.type === "raise") {
          const amount = action.amount as number;
          if (amount < legal.minRaiseTo && amount !== legal.maxRaiseTo) {
            fail("bad-fuzz", "the fuzzer produced an illegal raise");
          }
          if (amount < betBefore + state.minRaise) shortAllIns += 1;
          else reopened.add(state.street);
          if (state.street === "preflop" && amount > betBefore) preflopRaised = true;
        }

        state = applyAction(state, legal.seatId, action);
        actedThisRound.add(actor.id);

        if (streetBefore === "preflop" && state.street !== "preflop") {
          actionableAfterPreflop = state.seats.filter((s) => s.status === "active").length;
        }

        for (const seat of state.seats) {
          if (seat.stack < 0) fail("negative-stack", `${seat.id} at ${seat.stack}`, state);
          if (seat.committed < 0 || seat.totalCommitted < 0) fail("negative-commit", seat.id, state);
          if (seat.committed > seat.totalCommitted) fail("commit-over-total", seat.id, state);
          if (seat.stack === 0 && seat.status === "active") {
            fail("active-broke", `${seat.id} is active with no chips`, state);
          }
        }

        const inPlay = state.seats.reduce((n, s) => n + s.stack + s.totalCommitted, 0);
        if (inPlay !== bankroll) fail("chips-mid-hand", `${inPlay} != ${bankroll}`, state);

        // Nobody may be asked to act twice in a round without a raise between.
        if (state.phase === "awaiting-action" && state.street === round) {
          const next = state.seats.find((s) => s.id === state.actingSeatId) as Seat;
          if (
            actedThisRound.has(next.id) &&
            next.committed === state.currentBet &&
            state.currentBet === betBefore
          ) {
            fail("re-ask", `${next.id} asked to act again with nothing to call`, state);
          }
        }
      }

      // The big blind is owed an option when nobody raised and play continues.
      if (bigBlindCouldAct && !preflopRaised && actionableAfterPreflop > 1) {
        bigBlindOptions += 1;
        if (!bigBlindActed) fail("bb-option", `${bigBlindId} never got the option preflop`, state);
      }

      // --- Settlement ----------------------------------------------------
      const summary = state.lastHand;
      if (!summary) {
        fail("no-summary", "the hand ended without a summary", state);
        break;
      }
      if (summary.wentToShowdown) showdowns += 1;

      const won = new Map<string, number>();
      for (const award of summary.awards) {
        won.set(award.seatId, (won.get(award.seatId) ?? 0) + award.amount);
      }

      // Rebuild each seat's stake from the summary: start - end + winnings.
      const atPayout: Seat[] = state.seats
        .filter((seat) => seat.handStartStack > 0)
        .map((seat) => {
          const player = summary.players.find((p) => p.seatId === seat.id) as
            (typeof summary.players)[number];
          return {
            ...structuredClone(seat),
            totalCommitted:
              player.startingStack - player.endingStack + (won.get(seat.id) ?? 0),
            status: player.result === "folded" ? ("folded" as const) : ("active" as const),
          };
        });

      const buttonOrder: string[] = [];
      for (let step = 1; step <= state.seats.length; step++) {
        buttonOrder.push((state.seats[(state.buttonIndex + step) % state.seats.length] as Seat).id);
      }

      const expected = referencePayout(atPayout, state.board, summary.wentToShowdown, buttonOrder);
      if (expected.get("__carried__")) {
        fail("carried-chips", `${expected.get("__carried__")} chips had no eligible pot`, state);
      }
      if (expected.get("__uncalled__")) {
        fail("uncalled-bet", `${expected.get("__uncalled__")} unmatched chips were paid out as winnings`, state);
      }
      for (const id of new Set([...expected.keys(), ...won.keys()])) {
        if (id.startsWith("__")) continue;
        if ((expected.get(id) ?? 0) !== (won.get(id) ?? 0)) {
          fail("payout", `${id} received ${won.get(id) ?? 0}, expected ${expected.get(id) ?? 0}`, state);
        }
      }

      const awarded = summary.awards.reduce((n, a) => n + a.amount, 0);
      if (awarded !== summary.potSize) fail("award-total", `awarded ${awarded} of a ${summary.potSize} pot`, state);
      // Winning a main pot and a genuine side pot is two awards, which is fine.
      // Two pots contested by the *same* seats is one pot paid out twice.
      const potKeys = buildPots(atPayout).map((pot) => pot.eligibleSeatIds.join(","));
      if (new Set(potKeys).size !== potKeys.length) {
        fail("pot-split", "two pots share an identical set of eligible seats", state);
      }

      const inPlay = state.seats.reduce((n, s) => n + s.stack + s.totalCommitted, 0);
      if (inPlay !== bankroll) fail("chips-after-award", `${inPlay} != ${bankroll}`, state);

      const nets = summary.players.reduce((n, p) => n + p.net, 0);
      if (nets !== 0) fail("net-sum", `the hand's nets sum to ${nets}`, state);

      for (const player of summary.players) {
        if (player.endingStack - player.startingStack !== player.net) fail("net-math", player.seatId, state);
        if (player.result === "folded" && player.net > 0) fail("folded-profit", `${player.seatId} folded but profited`, state);
        if (player.result === "lost" && player.net > 0) fail("lost-profit", `${player.seatId} lost but profited`, state);
        if (player.result === "folded" && player.holeCards.length > 0) {
          fail("fold-leak", `${player.seatId} folded but showed`, state);
        }
      }

      if (summary.board.length > 5) fail("board-long", `${summary.board.length} cards`, state);
      if (!summary.wentToShowdown && summary.revealedSeatIds.length > 0) {
        fail("reveal-leak", "cards revealed without a showdown", state);
      }

      const dealt = [
        ...summary.board,
        ...state.seats.filter((s) => s.handStartStack > 0).flatMap((s) => s.holeCards),
      ];
      if (new Set(dealt).size !== dealt.length) fail("duplicate-card", "a card was dealt twice", state);

      // Log ids are React keys, so they have to survive the log being trimmed.
      if (new Set(state.log.map((e) => e.id)).size !== state.log.length) {
        fail("log-ids", `duplicate ids among ${state.log.length} log entries`, state);
      }
    }
  }
}

console.log(
  [
    `hands played        ${handsPlayed}`,
    `went to showdown    ${showdowns}`,
    `short all-in raises ${shortAllIns}`,
    `big blind options   ${bigBlindOptions}`,
  ].join("\n"),
);

console.log(failures === 0 ? "rules: all invariants held" : `rules: ${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
