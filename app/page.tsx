import { ArrowRight, Brain, Layers, Spade, Trophy } from "lucide-react";
import Link from "next/link";

import { NewTableForm } from "@/components/new-table-form";
import { Button } from "@/components/ui/button";
import { getActiveGameId, getLeaderboard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { formatSigned, hueFromString } from "@/lib/table-config";

export default async function LobbyPage() {
  const user = await getCurrentUser();
  const [activeGameId, leaders] = await Promise.all([
    user ? getActiveGameId(user.id) : Promise.resolve(null),
    getLeaderboard(5),
  ]);

  return (
    <div className="lobby-shell mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-14 lg:py-14">
      <section className="flex min-w-0 flex-col gap-7">
        <div className="flex flex-col gap-4">
          <span className="border-primary/30 bg-primary/10 text-primary w-fit rounded-full border px-3 py-1 text-xs font-medium">
            FREE TO PLAY · ALWAYS
          </span>
          <h1 className="text-5xl leading-[1.05] font-semibold tracking-[-0.05em] text-balance sm:text-6xl">
            Good hands. Good practice. <span className="text-primary">Your table.</span>
          </h1>
          <p className="text-muted-foreground max-w-prose text-lg text-pretty">
            Settle in for Texas Hold&apos;em against five distinct bot personalities.
            Find your rhythm, sharpen your reads, and make the next hand yours.
          </p>
        </div>

        <a href="#table-setup" className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground lg:hidden">Set up your table <ArrowRight className="size-4" aria-hidden /></a>

        <div className="lobby-table-art" aria-hidden="true">
          <div className="lobby-table-outline"><Spade className="size-8 opacity-20" /><span>THE NEXT HAND IS YOURS</span></div>
          <div className="lobby-card lobby-card-back">A<span>♠</span></div>
          <div className="lobby-card lobby-card-front">A<span>♥</span></div>
          <div className="lobby-chip lobby-chip-one" /><div className="lobby-chip lobby-chip-two" />
          <span className="lobby-art-caption">TEXAS HOLD’EM / PLAY MONEY</span>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          <Feature icon={<Brain className="size-4" />} title="Five personalities">
            Read your opponents. Every bot plays a little differently.
          </Feature>
          <Feature icon={<Layers className="size-4" />} title="Full rules">
            Authentic Hold’em, from the first blind to the showdown.
          </Feature>
          <Feature icon={<Trophy className="size-4" />} title="It counts">
            Follow your progress and climb the leaderboard.
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

      <section id="table-setup" className="scroll-mt-24 min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="border-border/70 bg-card/90 rounded-3xl border p-5 shadow-2xl shadow-black/20 sm:p-7">
          <div className="mb-5 flex items-center justify-between border-b border-border pb-5"><span className="text-xs font-medium tracking-[0.18em] text-muted-foreground">YOUR NEXT GAME</span><Spade className="size-5 text-primary" aria-hidden /></div>
          <h2 className="mb-2 text-2xl font-semibold tracking-tight">Take a seat.</h2>
          <p className="text-muted-foreground mb-6 text-sm">
            A few choices. Then you’re in.
          </p>
          <NewTableForm defaultName={user?.displayName} />
          <p className="text-muted-foreground mt-4 text-center text-xs">
            No signup. No deposits. Just poker.
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
