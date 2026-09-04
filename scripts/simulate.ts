/**
 * Plays full bot-vs-bot tables and asserts the engine's invariants.
 * Run with: npx tsx scripts/simulate.ts [hands] [seed]
 */
import { mulberry32 } from "../lib/poker/cards";
import { decideBotAction } from "../lib/poker/ai";
import {
  applyAction,
  createTable,
  legalActions,
  startHand,
  type TableState,
} from "../lib/poker/engine";
import { BOT_ROSTER } from "../lib/poker/profiles";

const targetHands = Number(process.argv[2] ?? 400);
const seed = Number(process.argv[3] ?? 20260903);
const rng = mulberry32(seed);

let failures = 0;
function fail(message: string, state?: TableState): void {
  failures += 1;
  console.log(`FAIL ${message}`);
  if (state) {
    console.log(
      JSON.stringify(
        {
          hand: state.handNumber,
          street: state.street,
          phase: state.phase,
          currentBet: state.currentBet,
          acting: state.actingSeatId,
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
        2,
      ),
    );
  }
}

function chipsInPlay(state: TableState): number {
  return state.seats.reduce(
    (sum, seat) => sum + seat.stack + seat.totalCommitted,
    0,
  );
}

const seatCounts = [2, 3, 4, 6];
const stats = {
  hands: 0,
  showdowns: 0,
  allInHands: 0,
  chops: 0,
  tablesFinished: 0,
  actions: 0,
  sawFlop: 0,
  potBigBlinds: 0,
  showdownPlayers: 0,
};

for (const seatCount of seatCounts) {
  const handsPerTable = Math.max(1, Math.floor(targetHands / seatCounts.length));
  let played = 0;

  while (played < handsPerTable) {
    const startingStack = 1000;
    let state = createTable({
      seats: Array.from({ length: seatCount }, (_, index) => {
        const entry = BOT_ROSTER[index % BOT_ROSTER.length]!;
        return {
          id: `s${index}`,
          name: `${entry.name}-${index}`,
          kind: "bot" as const,
          profileId: entry.profileId,
        };
      }),
      smallBlind: 10,
      bigBlind: 20,
      startingStack,
    });

    const bankroll = seatCount * startingStack;

    while (state.phase !== "table-complete" && played < handsPerTable) {
      state = startHand(state, rng);
      if (state.phase === "table-complete") break;

      let guard = 0;
      while (state.phase === "awaiting-action") {
        if (guard++ > 500) {
          fail(`hand did not terminate (${seatCount}-handed)`, state);
          break;
        }

        const legal = legalActions(state);
        if (!legal) {
          fail("awaiting-action with no legal actions", state);
          break;
        }

        // Every advertised option must be internally consistent.
        if (legal.canCheck && legal.toCall !== 0) {
          fail("canCheck while facing a bet", state);
        }
        if (legal.minRaiseTo > legal.maxRaiseTo) {
          fail("minRaiseTo above maxRaiseTo", state);
        }
        if (legal.callAmount < 0) fail("negative callAmount", state);

        const decision = decideBotAction(state, legal.seatId, {
          rng,
          iterations: 60,
        });

        state = applyAction(state, legal.seatId, decision.action);
        stats.actions += 1;

        for (const seat of state.seats) {
          if (seat.stack < 0) fail("negative stack", state);
          if (seat.committed < 0) fail("negative committed", state);
        }
        if (chipsInPlay(state) !== bankroll) {
          fail(
            `chips not conserved mid-hand: ${chipsInPlay(state)} != ${bankroll}`,
            state,
          );
        }
      }

      if (state.phase === "awaiting-action") break;

      const summary = state.lastHand;
      if (!summary) {
        fail("hand completed without a summary", state);
        break;
      }

      stats.hands += 1;
      played += 1;
      if (summary.wentToShowdown) {
        stats.showdowns += 1;
        stats.showdownPlayers += summary.revealedSeatIds.length;
      }
      if (summary.board.length >= 3) stats.sawFlop += 1;
      stats.potBigBlinds += summary.potSize / state.bigBlind;
      if (summary.players.some((player) => player.result === "chopped")) {
        stats.chops += 1;
      }
      if (
        summary.players.some(
          (player) => player.endingStack === 0 && player.startingStack > 0,
        )
      ) {
        stats.allInHands += 1;
      }

      const awarded = summary.awards.reduce(
        (sum, award) => sum + award.amount,
        0,
      );
      if (awarded !== summary.potSize) {
        fail(
          `pot mismatch: awarded ${awarded} of a ${summary.potSize} pot`,
          state,
        );
      }
      if (chipsInPlay(state) !== bankroll) {
        fail(`chips not conserved after award: ${chipsInPlay(state)}`, state);
      }
      if (summary.board.length > 5) fail("board longer than five cards", state);

      const dealt = new Set<string>(summary.board);
      let dealtCount = summary.board.length;
      for (const seat of state.seats) {
        for (const card of seat.holeCards) {
          dealt.add(card);
          dealtCount += 1;
        }
      }
      if (dealt.size !== dealtCount) fail("a card was dealt twice", state);
    }

    if (state.phase === "table-complete") stats.tablesFinished += 1;
    if (played >= handsPerTable) break;
  }
}

console.log(
  [
    `hands played      ${stats.hands}`,
    `player actions    ${stats.actions}`,
    `went to showdown  ${stats.showdowns} (${Math.round(
      (stats.showdowns / Math.max(1, stats.hands)) * 100,
    )}%)`,
    `saw a flop        ${stats.sawFlop} (${Math.round(
      (stats.sawFlop / Math.max(1, stats.hands)) * 100,
    )}%)`,
    `avg pot           ${(stats.potBigBlinds / Math.max(1, stats.hands)).toFixed(1)} BB`,
    `avg at showdown   ${(
      stats.showdownPlayers / Math.max(1, stats.showdowns)
    ).toFixed(2)} players`,
    `split pots        ${stats.chops}`,
    `busts            ${stats.allInHands}`,
    `tables played out ${stats.tablesFinished}`,
  ].join("\n"),
);

console.log(
  failures === 0
    ? "engine: all invariants held"
    : `engine: ${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);
