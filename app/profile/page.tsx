import Link from "next/link";

import { PlayingCard } from "@/components/table/playing-card";
import { Button } from "@/components/ui/button";
import { isCard, type Card } from "@/lib/poker/cards";
import { getPlayerRank, getPlayerStats, getRecentHands } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { formatChips, formatSigned, hueFromString } from "@/lib/table-config";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Profile",
  description: "Your lifetime results and recent hands.",
};

const RESULT_TONE: Record<string, string> = {
  won: "text-emerald-400",
  chopped: "text-sky-400",
  folded: "text-muted-foreground",
  lost: "text-rose-400",
};

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold">No player yet</h1>
        <p className="text-muted-foreground text-sm">
          Sit down at a table and your profile starts tracking every hand.
        </p>
        <Button nativeButton={false} render={<Link href="/" />}>
          Take a seat
        </Button>
      </div>
    );
  }

  const [stats, rank, recent] = await Promise.all([
    getPlayerStats(user.id),
    getPlayerRank(user.id),
    getRecentHands(user.id, 15),
  ]);

  const hue = hueFromString(user.username);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <header className="mb-8 flex flex-wrap items-center gap-4">
        <span
          className="grid size-14 shrink-0 place-items-center rounded-full text-xl font-semibold text-white ring-1 ring-white/20"
          style={{
            background: `linear-gradient(140deg, oklch(0.66 0.14 ${hue}), oklch(0.45 0.12 ${
              (hue + 40) % 360
            }))`,
          }}
          aria-hidden
        >
          {user.displayName.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.displayName}
          </h1>
          <p className="text-muted-foreground font-mono text-xs">
            @{user.username}
          </p>
        </div>
        <Button
          className="ml-auto"
          nativeButton={false}
          render={<Link href="/" />}
        >
          New table
        </Button>
      </header>

      <dl className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Net chips" tone={stats.netProfit >= 0 ? "up" : "down"}>
          {formatSigned(stats.netProfit)}
        </Stat>
        <Stat label="Hands played">{formatChips(stats.handsPlayed)}</Stat>
        <Stat label="Hands won">
          {formatChips(stats.handsWon)}
          <span className="text-muted-foreground ml-1 text-xs">
            {stats.handsPlayed > 0
              ? `${Math.round((stats.handsWon / stats.handsPlayed) * 100)}%`
              : "—"}
          </span>
        </Stat>
        <Stat label="Leaderboard">{rank ? `#${rank}` : "Unranked"}</Stat>
      </dl>

      <h2 className="mb-3 text-lg font-semibold">Recent hands</h2>

      {recent.length === 0 ? (
        <div className="border-border/70 bg-card/50 rounded-2xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            No hands yet. Your history shows up here as soon as you play one.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {recent.map((hand) => {
            const hole = hand.holeCards.filter(isCard);
            const board = hand.board.filter(isCard);

            return (
              <li
                key={hand.id}
                className="border-border/70 bg-card/50 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5"
              >
                <div className="flex w-16 shrink-0 gap-0.5">
                  {hole.length > 0 ? (
                    hole.map((card: Card) => (
                      <PlayingCard key={card} card={card} size="sm" />
                    ))
                  ) : (
                    <span className="text-muted-foreground text-xs">mucked</span>
                  )}
                </div>

                <div className="flex gap-0.5 opacity-80">
                  {board.map((card: Card) => (
                    <PlayingCard key={card} card={card} size="sm" />
                  ))}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {hand.handLabel ?? (hand.wentToShowdown ? "Showdown" : "No showdown")}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Hand #{hand.handNumber} · {formatChips(hand.potSize)} pot
                  </p>
                </div>

                <p
                  className={cn(
                    "ml-auto font-mono text-sm font-semibold tabular-nums",
                    RESULT_TONE[hand.result] ?? "text-muted-foreground",
                  )}
                >
                  {formatSigned(hand.net)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "up" | "down";
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/70 bg-card/50 rounded-2xl border p-4">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 font-mono text-xl font-semibold tabular-nums",
          tone === "up" && "text-emerald-400",
          tone === "down" && "text-rose-400",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
