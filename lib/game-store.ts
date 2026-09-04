import "server-only";

import { eq, sql } from "drizzle-orm";

import { db, games, handPlayers, hands, playerStats, type Game } from "@/db";
import type { TableState } from "@/lib/poker/engine";
import { HERO_SEAT_ID } from "@/lib/table-config";

/** Persists the authoritative table state, closing the game once it is over. */
export async function saveGameState(
  gameId: string,
  state: TableState,
): Promise<void> {
  const finished = state.phase === "table-complete";

  await db
    .update(games)
    .set({
      state,
      handsPlayed: state.handNumber,
      status: finished ? "finished" : "active",
      endedAt: finished ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId));
}

/**
 * Writes the hand history for the hand that just finished, and folds the
 * result into the player's lifetime stats.
 *
 * Idempotent: the unique index on (game_id, hand_number) means a retried
 * Server Action cannot double count a player's stats.
 */
export async function recordCompletedHand(
  game: Pick<Game, "id" | "userId">,
  state: TableState,
): Promise<void> {
  const summary = state.lastHand;
  if (!summary) return;

  const inserted = await db
    .insert(hands)
    .values({
      gameId: game.id,
      handNumber: summary.handNumber,
      board: summary.board,
      potSize: summary.potSize,
      wentToShowdown: summary.wentToShowdown,
    })
    .onConflictDoNothing()
    .returning({ id: hands.id });

  const handRow = inserted[0];
  if (!handRow) return; // Already recorded by an earlier attempt.

  const hero = summary.players.find((player) => player.seatId === HERO_SEAT_ID);
  const heroWon = hero?.result === "won" || hero?.result === "chopped";

  await Promise.all([
    db.insert(handPlayers).values(
      summary.players.map((player) => ({
        handId: handRow.id,
        seatId: player.seatId,
        name: player.name,
        isHuman: player.kind === "human",
        holeCards: player.holeCards,
        startingStack: player.startingStack,
        endingStack: player.endingStack,
        net: player.net,
        result: player.result,
        handLabel: player.handLabel,
      })),
    ),
    db
      .insert(playerStats)
      .values({
        userId: game.userId,
        handsPlayed: 1,
        handsWon: heroWon ? 1 : 0,
        showdownsWon: heroWon && summary.wentToShowdown ? 1 : 0,
        biggestPot: heroWon ? summary.potSize : 0,
        netProfit: hero?.net ?? 0,
      })
      .onConflictDoUpdate({
        target: playerStats.userId,
        set: {
          handsPlayed: sql`${playerStats.handsPlayed} + 1`,
          handsWon: sql`${playerStats.handsWon} + ${heroWon ? 1 : 0}`,
          showdownsWon: sql`${playerStats.showdownsWon} + ${
            heroWon && summary.wentToShowdown ? 1 : 0
          }`,
          biggestPot: sql`GREATEST(${playerStats.biggestPot}, ${
            heroWon ? summary.potSize : 0
          })`,
          netProfit: sql`${playerStats.netProfit} + ${hero?.net ?? 0}`,
          updatedAt: new Date(),
        },
      }),
  ]);
}
