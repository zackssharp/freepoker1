/** Bot personalities. Kept in their own module so the engine and the AI can
 *  both reference the ids without importing each other. */
export const BOT_PROFILE_IDS = [
  "rock",
  "shark",
  "maniac",
  "station",
  "pro",
] as const;

export type BotProfileId = (typeof BOT_PROFILE_IDS)[number];

export interface BotProfile {
  id: BotProfileId;
  name: string;
  /** One-line personality shown in the seat tooltip. */
  tell: string;
  /**
   * How many times an average hand's equity this bot wants before it bets or
   * raises for value. 1.0 is an average hand, 2.0 is twice as good as average.
   */
  valueRatio: number;
  /** Multiplier on the pot odds required to continue: <1 calls wider. */
  callLooseness: number;
  /** Fraction of the pot a value bet targets. */
  betSizing: number;
  /** Chance of firing a bluff with a weak hand when checked to. */
  bluffRate: number;
  /** Chance of turning a strong hand into a slowplay. */
  trapRate: number;
  /** Preflop hand strength (0-1) needed to open or re-raise. */
  preflopOpen: number;
  /** Preflop hand strength needed to call a standard raise. */
  preflopCall: number;
}

export const BOT_PROFILES: Record<BotProfileId, BotProfile> = {
  rock: {
    id: "rock",
    name: "Rock",
    tell: "Folds everything, then shows up with the nuts.",
    valueRatio: 2.0,
    callLooseness: 1.35,
    betSizing: 0.55,
    bluffRate: 0.02,
    trapRate: 0.1,
    preflopOpen: 0.46,
    preflopCall: 0.4,
  },
  shark: {
    id: "shark",
    name: "Shark",
    tell: "Tight, aggressive, and punishes limpers.",
    valueRatio: 1.65,
    callLooseness: 1.05,
    betSizing: 0.72,
    bluffRate: 0.16,
    trapRate: 0.14,
    preflopOpen: 0.36,
    preflopCall: 0.29,
  },
  maniac: {
    id: "maniac",
    name: "Maniac",
    tell: "Raises first, thinks later. Very hard to read.",
    valueRatio: 1.2,
    callLooseness: 0.72,
    betSizing: 0.95,
    bluffRate: 0.38,
    trapRate: 0.04,
    preflopOpen: 0.22,
    preflopCall: 0.15,
  },
  station: {
    id: "station",
    name: "Calling Station",
    tell: "Will not fold a pair. Bet your good hands.",
    valueRatio: 2.3,
    callLooseness: 0.6,
    betSizing: 0.45,
    bluffRate: 0.03,
    trapRate: 0.02,
    preflopOpen: 0.44,
    preflopCall: 0.17,
  },
  pro: {
    id: "pro",
    name: "Pro",
    tell: "Balanced ranges, sizes to the board, mixes it up.",
    valueRatio: 1.5,
    callLooseness: 0.95,
    betSizing: 0.66,
    bluffRate: 0.22,
    trapRate: 0.18,
    preflopOpen: 0.33,
    preflopCall: 0.25,
  },
};

/** Table-name pool, paired with the profile that plays under each name. */
export const BOT_ROSTER: ReadonlyArray<{ name: string; profileId: BotProfileId }> = [
  { name: "Ada", profileId: "shark" },
  { name: "Boone", profileId: "station" },
  { name: "Cyrus", profileId: "maniac" },
  { name: "Delia", profileId: "rock" },
  { name: "Esme", profileId: "pro" },
  { name: "Fitz", profileId: "shark" },
  { name: "Greer", profileId: "maniac" },
  { name: "Hollis", profileId: "pro" },
];
