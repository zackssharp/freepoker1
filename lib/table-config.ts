/** Shared table setup constants. Imported by both Server Actions and the UI,
 *  so this module must stay free of server-only dependencies. */

export const HERO_SEAT_ID = "hero";

export const STAKES = {
  micro: { id: "micro", label: "Micro", smallBlind: 5, bigBlind: 10, startingStack: 1_000 },
  low: { id: "low", label: "Low", smallBlind: 10, bigBlind: 20, startingStack: 2_000 },
  high: { id: "high", label: "High", smallBlind: 25, bigBlind: 50, startingStack: 5_000 },
} as const;

export type StakesId = keyof typeof STAKES;

export const STAKES_LIST = Object.values(STAKES);

export function isStakesId(value: unknown): value is StakesId {
  return typeof value === "string" && value in STAKES;
}

export const MIN_OPPONENTS = 1;
export const MAX_OPPONENTS = 5;

export function clampOpponents(value: number): number {
  if (!Number.isFinite(value)) return MAX_OPPONENTS;
  return Math.min(MAX_OPPONENTS, Math.max(MIN_OPPONENTS, Math.round(value)));
}

export function formatChips(amount: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(amount));
}

export function formatSigned(amount: number): string {
  const rounded = Math.round(amount);
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${formatChips(
    Math.abs(rounded),
  )}`;
}

/** Stable pastel hue per name, so avatars are recognisable without images. */
export function hueFromString(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export const STREET_LABELS = {
  preflop: "Pre-flop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
} as const;
