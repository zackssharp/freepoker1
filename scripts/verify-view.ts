/**
 * Plays hands from the human seat's perspective and asserts that the redacted
 * `TableView` never leaks the deck or a concealed hole card.
 * Run with: npx tsx scripts/verify-view.ts [hands] [seed]
 */
import { decideBotAction } from "../lib/poker/ai";
import { playBotTurns } from "../lib/poker/autoplay";
import { mulberry32, type Card } from "../lib/poker/cards";
import {
  applyAction,
  createTable,
  startHand,
  type TableState,
} from "../lib/poker/engine";
import { BOT_ROSTER } from "../lib/poker/profiles";
import { toTableView } from "../lib/poker/view";

const targetHands = Number(process.argv[2] ?? 150);
const seed = Number(process.argv[3] ?? 424242);
const rng = mulberry32(seed);

const HERO = "hero";
const CARD_PATTERN = /^[23456789TJQKA][cdhs]$/;

let failures = 0;
let checks = 0;
let showdownsSeen = 0;
let heroDecisions = 0;

function fail(message: string): void {
  failures += 1;
  console.log(`FAIL ${message}`);
}

/** Every card-shaped string anywhere in the payload sent to the browser. */
function cardsIn(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    if (CARD_PATTERN.test(value)) found.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) cardsIn(item, found);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) cardsIn(item, found);
  }
  return found;
}

function auditView(state: TableState): void {
  const view = toTableView(state, "game-1", HERO);
  const serialised = JSON.parse(JSON.stringify(view)) as unknown;
  checks += 1;

  if (JSON.stringify(serialised).includes('"deck"')) {
    fail("the view carried a deck");
  }

  const heroSeat = state.seats.find((seat) => seat.id === HERO);
  const revealed = new Set(state.lastHand?.revealedSeatIds ?? []);
  if (revealed.size > 0) showdownsSeen += 1;

  const allowed = new Set<string>([
    ...state.board,
    ...(heroSeat?.holeCards ?? []),
  ]);
  for (const seat of state.seats) {
    if (revealed.has(seat.id)) {
      for (const card of seat.holeCards) allowed.add(card);
    }
  }

  for (const card of cardsIn(serialised)) {
    if (!allowed.has(card as Card)) {
      fail(`the view exposed a concealed card: ${card}`);
      return;
    }
  }

  // The hero must always be able to see their own hand.
  const heroView = view.seats.find((seat) => seat.isHero);
  if (heroSeat && heroView && heroView.holeCards.length !== heroSeat.holeCards.length) {
    fail("the hero could not see their own cards");
  }

  // Opponents' card counts must still be visible, so the felt can draw backs.
  for (const seat of view.seats) {
    if (seat.isHero) continue;
    const actual = state.seats.find((candidate) => candidate.id === seat.id);
    if (actual && seat.cardCount !== actual.holeCards.length) {
      fail(`wrong card count for ${seat.id}`);
    }
    if (!revealed.has(seat.id) && seat.holeCards.length > 0) {
      fail(`opponent ${seat.id} was face up outside a showdown`);
    }
  }

  // Bet controls are only offered when it really is the hero's turn.
  const heroToAct =
    state.phase === "awaiting-action" && state.actingSeatId === HERO;
  if (heroToAct && !view.legal) fail("the hero was asked to act with no legal actions");
  if (!heroToAct && view.legal) fail("legal actions leaked outside the hero's turn");
}

function freshTable(): TableState {
  return createTable({
    seats: [
      { id: HERO, name: "You", kind: "human", profileId: null },
      ...BOT_ROSTER.slice(0, 4).map((bot, index) => ({
        id: `bot-${index}`,
        name: bot.name,
        kind: "bot" as const,
        profileId: bot.profileId,
      })),
    ],
    smallBlind: 10,
    bigBlind: 20,
    startingStack: 2_000,
  });
}

let state = freshTable();

let played = 0;
let rebuys = 0;
while (played < targetHands) {
  // Keep the hero in every hand; a sitting-out hero audits nothing.
  const heroStack =
    state.seats.find((seat) => seat.id === HERO)?.stack ?? 0;
  if (heroStack === 0 || state.seats.filter((seat) => seat.stack > 0).length < 2) {
    state = freshTable();
    rebuys += 1;
  }

  state = startHand(state, rng);
  if (state.phase === "table-complete") {
    state = freshTable();
    rebuys += 1;
    continue;
  }

  state = playBotTurns(state, HERO, { rng, iterations: 60 });
  auditView(state);

  let guard = 0;
  while (state.phase === "awaiting-action") {
    if (guard++ > 400) {
      fail("hand did not terminate");
      break;
    }
    if (state.actingSeatId !== HERO) {
      fail("control returned to the client mid bot turn");
      break;
    }

    const decision = decideBotAction(state, HERO, { rng, iterations: 60 });
    heroDecisions += 1;
    state = applyAction(state, HERO, decision.action);
    state = playBotTurns(state, HERO, { rng, iterations: 60 });
    auditView(state);
  }

  played += 1;
}

console.log(
  [
    `hands audited     ${played}`,
    `views inspected   ${checks}`,
    `hero decisions    ${heroDecisions}`,
    `showdowns seen    ${showdownsSeen}`,
    `table rebuys      ${rebuys}`,
  ].join("\n"),
);
console.log(
  failures === 0 ? "view: no card ever leaked" : `view: ${failures} FAILURES`,
);
process.exit(failures === 0 ? 0 : 1);
