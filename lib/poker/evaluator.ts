import { RANK_NAME, RANKS, rankOf, rankValue, suitOf, type Card, type Rank } from "./cards";

/** Ordered weakest to strongest; the index is the hand's category rank. */
export const HAND_CATEGORIES = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
] as const;

export type HandCategory = (typeof HAND_CATEGORIES)[number];

export interface HandRank {
  /** Index into `HAND_CATEGORIES`. */
  category: number;
  /** Up to five tiebreak values, most significant first. */
  tiebreakers: number[];
  /** Single comparable integer: higher always wins. */
  score: number;
  /** Human-readable, e.g. `"Full House, Kings full of Threes"`. */
  label: string;
}

const RANK_LABEL_BY_VALUE: Record<number, string> = {};
for (const rank of RANKS) {
  RANK_LABEL_BY_VALUE[rankValue(`${rank}s` as Card)] = RANK_NAME[rank];
}

function labelFor(value: number): string {
  return RANK_LABEL_BY_VALUE[value] ?? String(value);
}

function pluralLabel(value: number): string {
  const label = labelFor(value);
  return label === "Six" ? "Sixes" : `${label}s`;
}

/**
 * Highest card of the best straight in `values`, or `null`. Handles the wheel
 * (A-2-3-4-5) by letting an ace also count as 1.
 */
function straightHigh(values: readonly number[]): number | null {
  const unique = new Set(values);
  if (unique.has(14)) unique.add(1);
  const ordered = [...unique].sort((a, b) => b - a);

  let run = 1;
  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1] as number;
    const current = ordered[i] as number;
    if (current === previous - 1) {
      run += 1;
      if (run >= 5) return ordered[i - 4] as number;
    } else {
      run = 1;
    }
  }
  return null;
}

const SCORE_BASE = 15;
const SCORE_WEIGHTS = [
  SCORE_BASE ** 4,
  SCORE_BASE ** 3,
  SCORE_BASE ** 2,
  SCORE_BASE,
  1,
];

function scoreOf(category: number, tiebreakers: readonly number[]): number {
  let score = category * SCORE_BASE ** 5;
  for (let i = 0; i < SCORE_WEIGHTS.length; i++) {
    score += (tiebreakers[i] ?? 0) * (SCORE_WEIGHTS[i] as number);
  }
  return score;
}

function describe(category: number, tiebreakers: readonly number[]): string {
  const [first, second] = tiebreakers;
  switch (HAND_CATEGORIES[category]) {
    case "Straight Flush":
      return first === 14 ? "Royal Flush" : `Straight Flush, ${labelFor(first ?? 0)} high`;
    case "Four of a Kind":
      return `Four of a Kind, ${pluralLabel(first ?? 0)}`;
    case "Full House":
      return `Full House, ${pluralLabel(first ?? 0)} full of ${pluralLabel(second ?? 0)}`;
    case "Flush":
      return `Flush, ${labelFor(first ?? 0)} high`;
    case "Straight":
      return `Straight, ${labelFor(first ?? 0)} high`;
    case "Three of a Kind":
      return `Three of a Kind, ${pluralLabel(first ?? 0)}`;
    case "Two Pair":
      return `Two Pair, ${pluralLabel(first ?? 0)} and ${pluralLabel(second ?? 0)}`;
    case "Pair":
      return `Pair of ${pluralLabel(first ?? 0)}`;
    default:
      return `High Card, ${labelFor(first ?? 0)}`;
  }
}

function makeRank(category: number, tiebreakers: number[]): HandRank {
  const trimmed = tiebreakers.slice(0, 5);
  return {
    category,
    tiebreakers: trimmed,
    score: scoreOf(category, trimmed),
    label: describe(category, trimmed),
  };
}

/**
 * Best five-card hand from five to seven cards, evaluated directly rather than
 * by enumerating all 21 five-card subsets -- the bots run this in a tight
 * Monte Carlo loop, so the constant factor matters.
 *
 * Ordering the checks is safe because a seven-card hand containing a flush can
 * never also contain a full house or quads: the five suited cards hold five
 * distinct ranks, leaving at most two cards to pair anything up.
 */
export function evaluateHand(cards: readonly Card[]): HandRank {
  if (cards.length < 5) {
    throw new Error(`evaluateHand needs at least 5 cards, received ${cards.length}`);
  }

  const values: number[] = [];
  const bySuit = new Map<string, number[]>();

  for (const card of cards) {
    const value = rankValue(card);
    values.push(value);
    const suit = suitOf(card);
    const bucket = bySuit.get(suit);
    if (bucket) bucket.push(value);
    else bySuit.set(suit, [value]);
  }

  for (const suited of bySuit.values()) {
    if (suited.length < 5) continue;

    const straightFlushHigh = straightHigh(suited);
    if (straightFlushHigh !== null) {
      return makeRank(HAND_CATEGORIES.indexOf("Straight Flush"), [straightFlushHigh]);
    }

    const topFive = suited.slice().sort((a, b) => b - a).slice(0, 5);
    return makeRank(HAND_CATEGORIES.indexOf("Flush"), topFive);
  }

  const counts = new Map<number, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  // Most repeated first, then highest rank -- the order paired hands read in.
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const [firstGroup, secondGroup] = groups;
  const kickersBelow = (excluded: readonly number[]) =>
    groups
      .filter(([value]) => !excluded.includes(value))
      .map(([value]) => value)
      .sort((a, b) => b - a);

  if (firstGroup && firstGroup[1] === 4) {
    const quad = firstGroup[0];
    const kicker = kickersBelow([quad])[0] ?? 0;
    return makeRank(HAND_CATEGORIES.indexOf("Four of a Kind"), [quad, kicker]);
  }

  if (firstGroup && firstGroup[1] === 3 && secondGroup && secondGroup[1] >= 2) {
    return makeRank(HAND_CATEGORIES.indexOf("Full House"), [
      firstGroup[0],
      secondGroup[0],
    ]);
  }

  const high = straightHigh(values);
  if (high !== null) {
    return makeRank(HAND_CATEGORIES.indexOf("Straight"), [high]);
  }

  if (firstGroup && firstGroup[1] === 3) {
    const trips = firstGroup[0];
    return makeRank(HAND_CATEGORIES.indexOf("Three of a Kind"), [
      trips,
      ...kickersBelow([trips]).slice(0, 2),
    ]);
  }

  if (firstGroup && firstGroup[1] === 2 && secondGroup && secondGroup[1] === 2) {
    const highPair = firstGroup[0];
    const lowPair = secondGroup[0];
    const kicker = kickersBelow([highPair, lowPair])[0] ?? 0;
    return makeRank(HAND_CATEGORIES.indexOf("Two Pair"), [highPair, lowPair, kicker]);
  }

  if (firstGroup && firstGroup[1] === 2) {
    const pair = firstGroup[0];
    return makeRank(HAND_CATEGORIES.indexOf("Pair"), [
      pair,
      ...kickersBelow([pair]).slice(0, 3),
    ]);
  }

  return makeRank(
    HAND_CATEGORIES.indexOf("High Card"),
    values.slice().sort((a, b) => b - a).slice(0, 5),
  );
}

export function compareHands(a: HandRank, b: HandRank): number {
  return a.score - b.score;
}

/** Chen-style preflop strength in `[0, 1]`, used to seed bot preflop ranges. */
export function preflopStrength(hole: readonly [Card, Card]): number {
  const [first, second] = hole;
  const high = Math.max(rankValue(first), rankValue(second));
  const low = Math.min(rankValue(first), rankValue(second));
  const suited = suitOf(first) === suitOf(second);
  const gap = high - low;

  let points = high === 14 ? 10 : high === 13 ? 8 : high === 12 ? 7 : high === 11 ? 6 : high / 2;

  if (high === low) points = Math.max(5, points * 2);
  if (suited) points += 2;
  if (gap === 2) points -= 1;
  else if (gap === 3) points -= 2;
  else if (gap === 4) points -= 4;
  else if (gap >= 5) points -= 5;
  if (gap <= 2 && high < 12 && high !== low) points += 1;

  return Math.min(1, Math.max(0, points / 20));
}

export function isRank(value: string): value is Rank {
  return (RANKS as readonly string[]).includes(value);
}

export function rankNameOf(card: Card): string {
  return RANK_NAME[rankOf(card)];
}
