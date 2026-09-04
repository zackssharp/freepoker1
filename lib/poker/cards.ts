export const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "J",
  "Q",
  "K",
  "A",
] as const;

export const SUITS = ["c", "d", "h", "s"] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];

/** A card is its rank followed by its suit, e.g. `"As"`, `"Td"`, `"7c"`. */
export type Card = `${Rank}${Suit}`;

export const SUIT_SYMBOL: Record<Suit, string> = {
  c: "♣",
  d: "♦",
  h: "♥",
  s: "♠",
};

export const SUIT_NAME: Record<Suit, string> = {
  c: "clubs",
  d: "diamonds",
  h: "hearts",
  s: "spades",
};

export const RANK_NAME: Record<Rank, string> = {
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  T: "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
  A: "Ace",
};

const RANK_VALUES: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export function rankOf(card: Card): Rank {
  return card[0] as Rank;
}

export function suitOf(card: Card): Suit {
  return card[1] as Suit;
}

/** 2 through 14, where an ace is high. Wheel straights are handled by the evaluator. */
export function rankValue(card: Card): number {
  return RANK_VALUES[rankOf(card)];
}

export function isCard(value: unknown): value is Card {
  return (
    typeof value === "string" &&
    value.length === 2 &&
    (RANKS as readonly string[]).includes(value[0] as string) &&
    (SUITS as readonly string[]).includes(value[1] as string)
  );
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

/** A random source in `[0, 1)`. Swappable so simulations can run deterministically. */
export type Rng = () => number;

/** Uniform float in `[0, 1)` drawn from the platform CSPRNG. */
export const cryptoRng: Rng = () => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return (buffer[0] ?? 0) / 2 ** 32;
};

/** Deterministic 32-bit PRNG, used to keep bot equity simulations reproducible. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a shuffled copy; the input is left untouched. */
export function shuffle<T>(items: readonly T[], rng: Rng = cryptoRng): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

export function createShuffledDeck(rng: Rng = cryptoRng): Card[] {
  return shuffle(createDeck(), rng);
}

export function formatCard(card: Card): string {
  return `${rankOf(card)}${SUIT_SYMBOL[suitOf(card)]}`;
}

export function describeCard(card: Card): string {
  return `${RANK_NAME[rankOf(card)]} of ${SUIT_NAME[suitOf(card)]}`;
}
