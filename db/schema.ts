import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { TableState } from "@/lib/poker/engine";

export const gameStatusEnum = pgEnum("game_status", ["active", "finished"]);
export const handResultEnum = pgEnum("hand_result", [
  "won",
  "lost",
  "folded",
  "chopped",
]);

/**
 * Players. Guests are real rows too -- they just get a generated username so
 * their stats and leaderboard position survive across sessions on the device.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    avatarHue: integer("avatar_hue").notNull().default(210),
    isGuest: boolean("is_guest").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_username_idx").on(table.username)],
);

/** Opaque bearer tokens stored in an httpOnly cookie. */
export const sessions = pgTable(
  "sessions",
  {
    token: text("token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

/**
 * A seat-at-a-table session against the bots. `state` holds the authoritative
 * `TableState` (deck order and every hole card included), so it must never be
 * sent to the browser unredacted -- see `lib/poker/view.ts`.
 */
export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: gameStatusEnum("status").notNull().default("active"),
    smallBlind: integer("small_blind").notNull(),
    bigBlind: integer("big_blind").notNull(),
    startingStack: integer("starting_stack").notNull(),
    botCount: integer("bot_count").notNull(),
    handsPlayed: integer("hands_played").notNull().default(0),
    state: jsonb("state").$type<TableState>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [
    index("games_user_id_idx").on(table.userId),
    index("games_user_status_idx").on(table.userId, table.status),
  ],
);

/** One completed hand. Written once, at award time. */
export const hands = pgTable(
  "hands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    handNumber: integer("hand_number").notNull(),
    board: text("board")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    potSize: integer("pot_size").notNull(),
    wentToShowdown: boolean("went_to_showdown").notNull().default(false),
    endedAt: timestamp("ended_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("hands_game_hand_number_idx").on(
      table.gameId,
      table.handNumber,
    ),
  ],
);

/** Per-seat result for a completed hand -- the hand-history detail rows. */
export const handPlayers = pgTable(
  "hand_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handId: uuid("hand_id")
      .notNull()
      .references(() => hands.id, { onDelete: "cascade" }),
    seatId: text("seat_id").notNull(),
    name: text("name").notNull(),
    isHuman: boolean("is_human").notNull().default(false),
    holeCards: text("hole_cards")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    startingStack: integer("starting_stack").notNull(),
    endingStack: integer("ending_stack").notNull(),
    net: integer("net").notNull(),
    result: handResultEnum("result").notNull(),
    handLabel: text("hand_label"),
  },
  (table) => [index("hand_players_hand_id_idx").on(table.handId)],
);

/**
 * Denormalised leaderboard source. Kept as its own table so the leaderboard is
 * a single indexed scan instead of an aggregate over every hand ever played.
 */
export const playerStats = pgTable(
  "player_stats",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    handsPlayed: integer("hands_played").notNull().default(0),
    handsWon: integer("hands_won").notNull().default(0),
    showdownsWon: integer("showdowns_won").notNull().default(0),
    biggestPot: integer("biggest_pot").notNull().default(0),
    netProfit: integer("net_profit").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("player_stats_net_profit_idx").on(table.netProfit.desc())],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  games: many(games),
  stats: one(playerStats, {
    fields: [users.id],
    references: [playerStats.userId],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  user: one(users, { fields: [games.userId], references: [users.id] }),
  hands: many(hands),
}));

export const handsRelations = relations(hands, ({ one, many }) => ({
  game: one(games, { fields: [hands.gameId], references: [games.id] }),
  players: many(handPlayers),
}));

export const handPlayersRelations = relations(handPlayers, ({ one }) => ({
  hand: one(hands, { fields: [handPlayers.handId], references: [hands.id] }),
}));

export const playerStatsRelations = relations(playerStats, ({ one }) => ({
  user: one(users, { fields: [playerStats.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Hand = typeof hands.$inferSelect;
export type HandPlayer = typeof handPlayers.$inferSelect;
export type PlayerStats = typeof playerStats.$inferSelect;
