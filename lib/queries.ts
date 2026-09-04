import "server-only";

import { and, count, desc, eq, gt } from "drizzle-orm";

import {
  db,
  games,
  handPlayers,
  hands,
  playerStats,
  users,
} from "@/db";
import { toTableView, type TableView } from "@/lib/poker/view";
import { HERO_SEAT_ID } from "@/lib/table-config";

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarHue: number;
  handsPlayed: number;
  handsWon: number;
  biggestPot: number;
  netProfit: number;
  winRate: number;
}

/** Top players by lifetime chips won. Backed by the index on `net_profit`. */
export async function getLeaderboard(limit = 25): Promise<LeaderboardRow[]> {
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarHue: users.avatarHue,
      handsPlayed: playerStats.handsPlayed,
      handsWon: playerStats.handsWon,
      biggestPot: playerStats.biggestPot,
      netProfit: playerStats.netProfit,
    })
    .from(playerStats)
    .innerJoin(users, eq(playerStats.userId, users.id))
    .where(gt(playerStats.handsPlayed, 0))
    .orderBy(desc(playerStats.netProfit), desc(playerStats.handsWon))
    .limit(limit);

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    winRate: row.handsPlayed > 0 ? row.handsWon / row.handsPlayed : 0,
  }));
}

export async function getPlayerStats(userId: string) {
  const rows = await db
    .select()
    .from(playerStats)
    .where(eq(playerStats.userId, userId))
    .limit(1);

  return (
    rows[0] ?? {
      userId,
      handsPlayed: 0,
      handsWon: 0,
      showdownsWon: 0,
      biggestPot: 0,
      netProfit: 0,
      updatedAt: new Date(),
    }
  );
}

/** The player's rank on the leaderboard, or null before their first hand. */
export async function getPlayerRank(userId: string): Promise<number | null> {
  const mine = await db
    .select({
      netProfit: playerStats.netProfit,
      handsPlayed: playerStats.handsPlayed,
    })
    .from(playerStats)
    .where(eq(playerStats.userId, userId))
    .limit(1);

  const me = mine[0];
  if (!me || me.handsPlayed === 0) return null;

  const ahead = await db
    .select({ total: count() })
    .from(playerStats)
    .where(
      and(
        gt(playerStats.handsPlayed, 0),
        gt(playerStats.netProfit, me.netProfit),
      ),
    );

  return (ahead[0]?.total ?? 0) + 1;
}

export interface RecentHandRow {
  id: string;
  handNumber: number;
  board: string[];
  potSize: number;
  wentToShowdown: boolean;
  endedAt: Date;
  net: number;
  result: string;
  handLabel: string | null;
  holeCards: string[];
}

/** The player's most recent hands across every table they have sat at. */
export async function getRecentHands(
  userId: string,
  limit = 12,
): Promise<RecentHandRow[]> {
  return db
    .select({
      id: hands.id,
      handNumber: hands.handNumber,
      board: hands.board,
      potSize: hands.potSize,
      wentToShowdown: hands.wentToShowdown,
      endedAt: hands.endedAt,
      net: handPlayers.net,
      result: handPlayers.result,
      handLabel: handPlayers.handLabel,
      holeCards: handPlayers.holeCards,
    })
    .from(handPlayers)
    .innerJoin(hands, eq(handPlayers.handId, hands.id))
    .innerJoin(games, eq(hands.gameId, games.id))
    .where(and(eq(games.userId, userId), eq(handPlayers.seatId, HERO_SEAT_ID)))
    .orderBy(desc(hands.endedAt))
    .limit(limit);
}

/** The player's most recent unfinished table, if there is one to resume. */
export async function getActiveGameId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.userId, userId), eq(games.status, "active")))
    .orderBy(desc(games.updatedAt))
    .limit(1);

  return rows[0]?.id ?? null;
}

/** Loads a table the given player owns, redacted for the browser. */
export async function getTableView(
  gameId: string,
  userId: string,
): Promise<TableView | null> {
  const rows = await db
    .select()
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.userId, userId)))
    .limit(1);

  const game = rows[0];
  if (!game) return null;

  return toTableView(game.state, game.id, HERO_SEAT_ID);
}
