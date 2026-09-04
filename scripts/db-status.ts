/**
 * Prints what actually exists in the database `DATABASE_URL` points at.
 * Run with: npx tsx scripts/db-status.ts
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const connectionString: string = url;
const sql = neon(connectionString);

const EXPECTED = [
  "users",
  "sessions",
  "games",
  "hands",
  "hand_players",
  "player_stats",
];

async function main(): Promise<void> {
  const tables = (await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name
  `) as { table_name: string }[];

  const present = new Set(tables.map((row) => row.table_name));

  console.log(`connected to ${new URL(connectionString).hostname}`);
  console.log(`public tables: ${tables.length}`);
  for (const name of EXPECTED) {
    console.log(`  ${present.has(name) ? "ok     " : "MISSING"} ${name}`);
  }

  const extra = [...present].filter((name) => !EXPECTED.includes(name));
  if (extra.length > 0) console.log(`  other: ${extra.join(", ")}`);

  if (present.size > 0 && EXPECTED.every((name) => present.has(name))) {
    const counts = (await sql`
      select
        (select count(*) from users) as users,
        (select count(*) from games) as games,
        (select count(*) from hands) as hands
    `) as { users: string; games: string; hands: string }[];
    const row = counts[0];
    if (row) {
      console.log(
        `rows: ${row.users} users, ${row.games} games, ${row.hands} hands`,
      );
    }
  }
}

void main();
