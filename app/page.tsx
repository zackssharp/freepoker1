import { ArrowRight, Brain, Layers, Trophy } from "lucide-react";
import Link from "next/link";

import { NewTableForm } from "@/components/new-table-form";
import { Button } from "@/components/ui/button";
import { getActiveGameId, getLeaderboard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { formatChips, formatSigned, hueFromString } from "@/lib/table-config";

export default async function LobbyPage() {
  const user = await getCurrentUser();
  const [activeGameId, leaders] = await Promise.all([
    user ? getActiveGameId(user.id) : Promise.resolve(null),
    getLeaderboard(5),
  ]);

  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-10 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:py-16">
      <section className="flex flex-col justify-center gap-6">
        <div className="flex flex-col gap-4">
          <span className="border-primary/30 bg-primary/10 text-primary w-fit rounded-full border px-3 py-1 text-xs font-medium">
            No signup · No chips to buy
          </span>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Texas Hold&apos;em against bots that actually think.
          </h1>
          <p className="text-muted-foreground max-w-prose text-lg text-pretty">
            Every bot runs a Monte Carlo equity simulation on the server before
            it acts, then plays that read through its own personality. Real side
            pots, real showdowns, and a hand history that follows you.
          </p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          <Feature icon={<Brain className="size-4" />} title="Five personalities">
            Rocks, maniacs, calling stations, sharks and one balanced pro.
          </Feature>
          <Feature icon={<Layers className="size-4" />} title="Full rules">
            Side pots, short all-ins, split pots and odd-chip rules.
          </Feature>
          <Feature icon={<Trophy className="size-4" />} title="It counts">
            Every hand updates your stats and your leaderboard position.
          </Feature>
        </dl>

        {activeGameId && (
          <div className="border-primary/30 bg-primary/5 flex flex-wrap items-center gap-3 rounded-2xl border p-4">
            <p className="text-sm">You have a table still running.</p>
            <Button
              size="sm"
              className="ml-auto"
              nativeButton={false}
              render={<Link href={`/table/${activeGameId}`} />}
            >
              Return to table
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        )}

        {leaders.length > 0 && (
          <div className="border-border/70 bg-card/50 rounded-2xl border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Top of the leaderboard</h2>
              <Link
                href="/leaderboard"
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                See all
              </Link>
            </div>
            <ol className="flex flex-col gap-2">
              {leaders.map((leader) => (
                <li key={leader.userId} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground w-4 font-mono text-xs tabular-nums">
                    {leader.rank}
                  </span>
                  <span
                    className="size-6 shrink-0 rounded-full ring-1 ring-white/20"
                    style={{
                      background: `linear-gradient(140deg, oklch(0.66 0.14 ${hueFromString(
                        leader.username,
                      )}), oklch(0.45 0.12 ${
                        (hueFromString(leader.username) + 40) % 360
                      }))`,
                    }}
                    aria-hidden
                  />
                  <span className="truncate">{leader.displayName}</span>
                  <span
                    className={`ml-auto font-mono tabular-nums ${
                      leader.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatSigned(leader.netProfit)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="lg:sticky lg:top-24 lg:self-start">
        <div className="border-border/70 bg-card/70 rounded-3xl border p-6 shadow-2xl shadow-black/30 backdrop-blur">
          <h2 className="mb-1 text-xl font-semibold">Deal me in</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            Pick your stakes and how many bots you want to beat.
          </p>
          <NewTableForm defaultName={user?.displayName} />
          <p className="text-muted-foreground mt-4 text-center text-xs">
            Chips are play money. Starting stack is{" "}
            {formatChips(2000)} at low stakes.
          </p>
        </div>
      </section>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="flex items-center gap-2 text-sm font-semibold">
        <span className="bg-primary/15 text-primary grid size-7 place-items-center rounded-md">
          {icon}
        </span>
        {title}
      </dt>
      <dd className="text-muted-foreground text-sm text-pretty">{children}</dd>
    </div>
  );
}
