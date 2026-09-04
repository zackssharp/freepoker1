"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db, games, type Game } from "@/db";
import { recordCompletedHand, saveGameState } from "@/lib/game-store";
import { playBotTurns } from "@/lib/poker/autoplay";
import {
  applyAction,
  createTable,
  startHand,
  IllegalActionError,
  type Action,
  type ActionType,
  type SeatConfig,
  type TableState,
} from "@/lib/poker/engine";
import { BOT_ROSTER } from "@/lib/poker/profiles";
import { shuffle } from "@/lib/poker/cards";
import { toTableView, type TableView } from "@/lib/poker/view";
import {
  getCurrentUser,
  normaliseDisplayName,
  requireUser,
} from "@/lib/session";
import {
  clampOpponents,
  HERO_SEAT_ID,
  isStakesId,
  STAKES,
} from "@/lib/table-config";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const ACTION_TYPES: readonly ActionType[] = [
  "fold",
  "check",
  "call",
  "bet",
  "raise",
];

/**
 * Server Actions are reachable by direct POST, so the payload is treated as
 * untrusted no matter what the UI would have sent.
 */
function parseAction(input: unknown): Action | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as { type?: unknown; amount?: unknown };

  if (!ACTION_TYPES.includes(candidate.type as ActionType)) return null;
  const type = candidate.type as ActionType;

  if (type === "bet" || type === "raise") {
    const amount = Number(candidate.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return { type, amount: Math.floor(amount) };
  }

  return { type };
}

function buildSeats(displayName: string, opponentCount: number): SeatConfig[] {
  const bots = shuffle(BOT_ROSTER).slice(0, opponentCount);

  return [
    { id: HERO_SEAT_ID, name: displayName, kind: "human", profileId: null },
    ...bots.map((bot, index) => ({
      id: `bot-${index}`,
      name: bot.name,
      kind: "bot" as const,
      profileId: bot.profileId,
    })),
  ];
}

/** Creates a table, deals the first hand, and sends the player to it. */
export async function createGameAction(formData: FormData): Promise<void> {
  const displayName = normaliseDisplayName(formData.get("displayName"));
  const user = await requireUser(displayName);

  const stakesId = formData.get("stakes");
  const stakes = isStakesId(stakesId) ? STAKES[stakesId] : STAKES.low;
  const opponents = clampOpponents(Number(formData.get("opponents")));

  let state = createTable({
    seats: buildSeats(user.displayName, opponents),
    smallBlind: stakes.smallBlind,
    bigBlind: stakes.bigBlind,
    startingStack: stakes.startingStack,
  });

  state = startHand(state);
  state = playBotTurns(state, HERO_SEAT_ID);

  const inserted = await db
    .insert(games)
    .values({
      userId: user.id,
      smallBlind: stakes.smallBlind,
      bigBlind: stakes.bigBlind,
      startingStack: stakes.startingStack,
      botCount: opponents,
      handsPlayed: state.handNumber,
      state,
    })
    .returning({ id: games.id });

  const game = inserted[0];
  if (!game) throw new Error("Could not create the table");

  if (state.lastHand) {
    await recordCompletedHand({ id: game.id, userId: user.id }, state);
  }

  // `redirect` throws to unwind, so it has to be the last thing we do.
  redirect(`/table/${game.id}`);
}

async function loadOwnedGame(gameId: string): Promise<
  ActionResult<{ game: Game; userId: string }>
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session expired. Start a new table." };

  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.userId, user.id)))
    .limit(1);

  const game = rows[0];
  if (!game) return { ok: false, error: "Table not found." };
  if (game.status === "finished") {
    return { ok: false, error: "You have already left this table." };
  }

  return { ok: true, data: { game, userId: user.id } };
}

/** Applies the player's action, then resolves every bot turn that follows. */
export async function submitPlayerAction(
  gameId: string,
  rawAction: unknown,
): Promise<ActionResult<TableView>> {
  const loaded = await loadOwnedGame(gameId);
  if (!loaded.ok) return loaded;

  const { game } = loaded.data;
  const action = parseAction(rawAction);
  if (!action) return { ok: false, error: "That action was not understood." };

  if (game.state.actingSeatId !== HERO_SEAT_ID) {
    return { ok: false, error: "It is not your turn." };
  }

  let state: TableState;
  try {
    state = applyAction(game.state, HERO_SEAT_ID, action);
  } catch (error) {
    if (error instanceof IllegalActionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }

  state = playBotTurns(state, HERO_SEAT_ID);

  await saveGameState(gameId, state);
  if (state.lastHand) {
    await recordCompletedHand({ id: game.id, userId: game.userId }, state);
  }

  return { ok: true, data: toTableView(state, gameId, HERO_SEAT_ID) };
}

/** Deals the next hand once the previous one has been settled. */
export async function dealNextHandAction(
  gameId: string,
): Promise<ActionResult<TableView>> {
  const loaded = await loadOwnedGame(gameId);
  if (!loaded.ok) return loaded;

  const { game } = loaded.data;

  if (game.state.phase === "table-complete") {
    return { ok: false, error: "This table is finished." };
  }
  if (game.state.phase === "awaiting-action") {
    return { ok: false, error: "Finish the current hand first." };
  }

  let state = startHand(game.state);
  state = playBotTurns(state, HERO_SEAT_ID);

  await saveGameState(gameId, state);
  if (state.lastHand) {
    await recordCompletedHand({ id: game.id, userId: game.userId }, state);
  }

  return { ok: true, data: toTableView(state, gameId, HERO_SEAT_ID) };
}

/** Ends the session and cashes the player out of the table. */
export async function leaveTableAction(gameId: string): Promise<void> {
  const loaded = await loadOwnedGame(gameId);
  if (loaded.ok) {
    await db
      .update(games)
      .set({ status: "finished", endedAt: new Date(), updatedAt: new Date() })
      .where(eq(games.id, gameId));
  }

  redirect("/");
}
