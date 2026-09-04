import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Local dev reads .env.local (Next.js convention); Vercel injects env vars directly.
config({ path: ".env.local" });

// `generate` works offline, so a missing URL is only fatal for the commands
// that actually connect (`migrate`, `push`, `studio`) -- they will fail loudly
// against this placeholder.
const url =
  process.env.DATABASE_URL ??
  "postgresql://unset:unset@localhost:5432/set-DATABASE_URL-in-env-local";

if (!process.env.DATABASE_URL) {
  console.warn(
    "[drizzle] DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon pooled connection string.",
  );
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
