# Free Poker

Browser Texas Hold'em against bots that simulate their equity before they act.
Next.js App Router, Drizzle ORM on Neon serverless Postgres, deployed on Vercel.

The whole game runs on the server. Server Actions hold the deck, deal the
cards, resolve every bot turn, and hand the browser a redacted view — so no
amount of poking at the client reveals a hole card.

## Getting started

```bash
npm install
cp .env.example .env.local   # then paste your Neon URL into it
npm run db:migrate
npm run dev
```

Open <http://localhost:3000>.

### Environment variables

One variable, in `.env.local` for local work and in Vercel's project settings
for deployments:

| Variable       | Where it comes from                                                     |
| -------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL` | Neon dashboard → **Connect** → **Pooled connection**. Use the `-pooler` host. |

```
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
```

The pooled host matters: serverless functions open a connection per invocation,
and the pooler is what keeps that from exhausting Postgres. The app talks to
Neon over its HTTP driver, so there is no connection to keep warm.

### Database commands

| Command              | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `npm run db:generate` | Diffs `db/schema.ts` and writes a new SQL file to `db/migrations`. Works offline. |
| `npm run db:migrate`  | Applies pending migrations to `DATABASE_URL`.                    |
| `npm run db:push`     | Pushes the schema straight to the database, skipping migration files. Handy while iterating; not for production. |
| `npm run db:studio`   | Opens Drizzle Studio against your database.                      |
| `npm run db:status`   | Prints which tables exist and how many rows they hold.           |

The initial migration is already committed, so a fresh database only needs
`npm run db:migrate`.

### Deploying to Vercel

Import the repo, set `DATABASE_URL` in the project's environment variables, and
deploy. Preview branches work against the same Neon project, or point them at a
Neon branch by overriding `DATABASE_URL` for the Preview environment. Run
`npm run db:migrate` against a database before the first deploy that needs a
new column.

## How it fits together

```
app/
  actions/game.ts        Server Actions: create a table, act, deal, leave
  table/[gameId]/        The felt
  leaderboard/           Ranked by lifetime chips won
  profile/               Your stats and recent hands
components/
  table/                 Felt, seats, cards, bet controls, hand log
  ui/                    shadcn primitives (Base UI + Tailwind)
db/
  schema.ts              Drizzle tables, relations and indexes
  migrations/            Generated SQL
lib/
  poker/                 The game itself (see below)
  queries.ts             Read-side queries
  session.ts             Guest identity, cookie-backed
scripts/                 Verification harnesses
```

### The game

`lib/poker` is plain TypeScript with no framework or database imports, so it
can be exercised directly from a script:

| Module         | Responsibility                                                        |
| -------------- | --------------------------------------------------------------------- |
| `cards.ts`     | Card types, a CSPRNG-backed shuffle, and a seeded PRNG for simulations. |
| `evaluator.ts` | Best five-card hand out of seven, evaluated directly rather than by enumerating all 21 subsets. |
| `engine.ts`    | Blinds, betting rounds, min-raise rules, short all-ins, side pots, odd-chip distribution, showdown. |
| `ai.ts`        | Bot decisions: a hand-strength model preflop, Monte Carlo equity after the flop, filtered through a personality. |
| `view.ts`      | Turns the authoritative `TableState` into the `TableView` the browser is allowed to see. |

State lives in the `games.state` jsonb column: one row per table, holding the
deck order and every hole card. It is read, advanced, and written inside a
Server Action, and only ever leaves the server through `toTableView`.

### The bots

Five personalities, assigned by name at the table. Preflop they use a Chen-style
strength ranking; from the flop on they run a Monte Carlo simulation against the
live opponent count and compare the result to the pot odds.

| Bot             | Plays like                                                    |
| --------------- | ------------------------------------------------------------- |
| Rock            | Folds everything, then shows up with the nuts.                |
| Shark           | Tight, aggressive, punishes limpers.                          |
| Maniac          | Raises first, thinks later.                                   |
| Calling Station | Will not fold a pair. Bet your good hands.                    |
| Pro             | Balanced ranges, sizes to the board, mixes it up.             |

## Verification

```bash
npm test          # all three harnesses
npm run typecheck
npm run lint
```

- `test:cards` checks the evaluator against known hands, the full category
  ladder, kicker ordering, and 20,000 random seven-card hands.
- `test:engine` plays 2-, 3-, 4- and 6-handed bot tables and asserts chips are
  conserved on every action, stacks never go negative, pots always pay out
  exactly, and no card is ever dealt twice.
- `test:view` plays from the human seat and asserts the payload sent to the
  browser never contains the deck or a concealed hole card.

`npm run test:db` is separate because it needs a real database. It plays a hand
through the same modules the Server Actions use, writes it, reads it back
through the real queries, and then deletes everything it created — covering
what the offline harnesses cannot: jsonb round-tripping of `TableState`,
`text[]` columns, the pg enums, and the idempotent stats upsert. Point
`DATABASE_URL` at a scratch database rather than one with real players in it.

The engine harness also reports table statistics — flop-seen rate, showdown
rate, average pot — which is the quickest way to tell whether a change to the
bots has made them play badly.
