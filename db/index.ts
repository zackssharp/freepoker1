import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | undefined;

/**
 * Neon's HTTP driver: one round trip per query with no connection to keep
 * warm, which is what a serverless function wants. Multi-statement atomicity
 * comes from `db.batch([...])` rather than an interactive transaction.
 */
function connect(): Database {
  if (instance) return instance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon pooled connection string.",
    );
  }

  instance = drizzle(neon(connectionString), { schema, casing: "snake_case" });
  return instance;
}

/**
 * Connects on first query rather than on import, so `next build` can collect
 * page data (and CI can typecheck) without a database reachable.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = connect();
    const value = Reflect.get(database, property, database) as unknown;
    return typeof value === "function" ? value.bind(database) : value;
  },
});

export * from "./schema";
