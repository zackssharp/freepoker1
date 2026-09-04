/**
 * End-to-end check against the database `DATABASE_URL` points at.
 *
 * Plays a real hand through the same modules the Server Actions use, writes it,
 * reads it back through the real read-side queries, then deletes everything it
 * created. Verifies the parts that unit tests cannot: jsonb round-tripping of
 * TableState, text[] columns, the pg enums, and the stats upsert.
 *
 * Run with: npx tsx scripts/verify-db.ts
 */
import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

import { db, games, playerStats, users } from "../db";
import { recordCompletedHand, saveGameState } from "../lib/game-store";
import {
  getActiveGameId,
  getLeaderboard,
  getPlayerRank,
  getPlayerStats,
  getRecentHands,
  getTableView,
} from "../lib/queries";
import { decideBotAction } from "../lib/poker/ai";
import { playBotTurns } from "../lib/poker/autoplay";
import { applyAction, createTable, startHand } from "../lib/poker/engine";
import { BOT_ROSTER } from "../lib/poker/profiles";
import { HERO_SEAT_ID } from "../lib/table-config";

/**
 * Postgres `jsonb` stores a normalised binary form and does not preserve object
 * key order (arrays keep theirs). Compare canonically so the check is about
 * data, not key ordering.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ok      ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL    ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  const marker = `verify-${Date.now().toString(36)}`;
  let userId: string | undefined;

  try {
    // --- 1. A player -----------------------------------------------------
    const insertedUser = await db
      .insert(users)
      .values({
        username: marker,
        displayName: "Verification Bot",
        avatarHue: 200,
        isGuest: true,
      })
      .returning();

    const user = insertedUser[0];
    if (!user) throw new Error("could not insert a user");
    userId = user.id;
    check("insert user", true);

    // --- 2. A table, dealt and advanced to the hero's turn ---------------
    let state = createTable({
      seats: [
        { id: HERO_SEAT_ID, name: "Verification Bot", kind: "human", profileId: null },
        ...BOT_ROSTER.slice(0, 3).map((bot, index) => ({
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
    state = startHand(state);
    state = playBotTurns(state, HERO_SEAT_ID);

    const insertedGame = await db
      .insert(games)
      .values({
        userId: user.id,
        smallBlind: 10,
        bigBlind: 20,
        startingStack: 2_000,
        botCount: 3,
        handsPlayed: state.handNumber,
        state,
      })
      .returning({ id: games.id });

    const game = insertedGame[0];
    if (!game) throw new Error("could not insert a game");
    check("insert game with jsonb state", true);

    // --- 3. jsonb must survive the round trip exactly ---------------------
    const readBack = await db
      .select({ state: games.state })
      .from(games)
      .where(eq(games.id, game.id))
      .limit(1);

    const stored = readBack[0]?.state;
    check(
      "jsonb TableState round-trips without data loss",
      JSON.stringify(canonical(stored)) === JSON.stringify(canonical(state)),
    );
    check(
      "stored state keeps the deck server-side",
      Array.isArray(stored?.deck) && (stored?.deck.length ?? 0) > 0,
      `deck length ${stored?.deck.length}`,
    );
    // Array order is what makes a shuffle a shuffle; jsonb must not touch it.
    check(
      "deck order survives jsonb exactly",
      JSON.stringify(stored?.deck) === JSON.stringify(state.deck),
    );
    check(
      "hole cards survive in dealt order",
      JSON.stringify(stored?.seats.map((seat) => seat.holeCards)) ===
        JSON.stringify(state.seats.map((seat) => seat.holeCards)),
    );

    // --- 4. Play the hand out --------------------------------------------
    let guard = 0;
    while (state.phase === "awaiting-action" && guard++ < 200) {
      const decision = decideBotAction(state, HERO_SEAT_ID, { iterations: 60 });
      state = applyAction(state, HERO_SEAT_ID, decision.action);
      state = playBotTurns(state, HERO_SEAT_ID);
    }
    check("hand played to completion", state.phase !== "awaiting-action", state.phase);
    check("hand produced a summary", state.lastHand !== null);

    await saveGameState(game.id, state);
    await recordCompletedHand({ id: game.id, userId: user.id }, state);
    check("write hand history (text[] arrays and pg enums)", true);

    // --- 5. Idempotency: a retried action must not double count ----------
    await recordCompletedHand({ id: game.id, userId: user.id }, state);
    const statsAfterRetry = await getPlayerStats(user.id);
    check(
      "replaying a hand does not double count",
      statsAfterRetry.handsPlayed === 1,
      `handsPlayed = ${statsAfterRetry.handsPlayed}`,
    );

    const heroNet =
      state.lastHand?.players.find((p) => p.seatId === HERO_SEAT_ID)?.net ?? 0;
    check(
      "stats upsert recorded the hero's net",
      statsAfterRetry.netProfit === heroNet,
      `${statsAfterRetry.netProfit} vs ${heroNet}`,
    );

    // --- 6. The read side ------------------------------------------------
    const view = await getTableView(game.id, user.id);
    check("getTableView returns a redacted view", view !== null);
    check(
      "the view drops the deck",
      view !== null && !JSON.stringify(view).includes('"deck"'),
    );

    const wrongOwner = await getTableView(
      game.id,
      "00000000-0000-0000-0000-000000000000",
    );
    check("another player cannot load the table", wrongOwner === null);

    const recent = await getRecentHands(user.id, 5);
    check("getRecentHands returns the hand", recent.length === 1, `${recent.length} rows`);
    check(
      "text[] columns decode as arrays",
      recent[0] !== undefined &&
        Array.isArray(recent[0].board) &&
        Array.isArray(recent[0].holeCards),
    );

    const leaders = await getLeaderboard(50);
    check(
      "getLeaderboard includes the player",
      leaders.some((row) => row.userId === user.id),
    );

    const rank = await getPlayerRank(user.id);
    check("getPlayerRank returns a rank", typeof rank === "number", String(rank));

    const activeId = await getActiveGameId(user.id);
    check(
      "getActiveGameId finds the open table",
      state.phase === "table-complete" ? activeId === null : activeId === game.id,
    );
  } catch (error) {
    failures += 1;
    console.log(`  FAIL    threw — ${(error as Error).message}`);
  } finally {
    // --- 7. Clean up: cascades remove sessions, games, hands, stats -------
    if (userId) {
      await db.delete(users).where(eq(users.id, userId));
      const leftover = await db
        .select({ id: playerStats.userId })
        .from(playerStats)
        .where(eq(playerStats.userId, userId));
      check("cleanup removed every test row", leftover.length === 0);
    }
  }
}

void main().then(() => {
  console.log(
    failures === 0
      ? "database: end-to-end verified"
      : `database: ${failures} FAILURES`,
  );
  process.exit(failures === 0 ? 0 : 1);
});
