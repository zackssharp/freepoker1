import { Trophy } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLeaderboard } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";
import { formatChips, formatSigned, hueFromString } from "@/lib/table-config";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Leaderboard",
  description: "The players up the most chips across every hand they have played.",
};

const MEDALS = ["text-amber-400", "text-slate-300", "text-amber-700"];

export default async function LeaderboardPage() {
  const [rows, user] = await Promise.all([getLeaderboard(50), getCurrentUser()]);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <Trophy className="text-primary size-7" aria-hidden />
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Ranked by lifetime chips won across every table.
          </p>
        </div>
        <Button
          className="ml-auto"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Play a hand
        </Button>
      </header>

      {rows.length === 0 ? (
        <div className="border-border/70 bg-card/50 rounded-2xl border p-10 text-center">
          <p className="text-muted-foreground text-sm">
            Nobody has finished a hand yet. Be the first name up here.
          </p>
        </div>
      ) : (
        <div className="border-border/70 bg-card/50 overflow-hidden rounded-2xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-right">Hands</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Win rate
                </TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  Biggest pot
                </TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.userId}
                  className={cn(
                    row.userId === user?.id && "bg-primary/10 hover:bg-primary/15",
                  )}
                >
                  <TableCell
                    className={cn(
                      "font-mono font-semibold tabular-nums",
                      MEDALS[row.rank - 1],
                    )}
                  >
                    {row.rank}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span
                        className="size-7 shrink-0 rounded-full ring-1 ring-white/20"
                        style={{
                          background: `linear-gradient(140deg, oklch(0.66 0.14 ${hueFromString(
                            row.username,
                          )}), oklch(0.45 0.12 ${
                            (hueFromString(row.username) + 40) % 360
                          }))`,
                        }}
                        aria-hidden
                      />
                      <span className="truncate font-medium">
                        {row.displayName}
                        {row.userId === user?.id && (
                          <span className="text-primary ml-2 text-xs">you</span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatChips(row.handsPlayed)}
                  </TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">
                    {Math.round(row.winRate * 100)}%
                  </TableCell>
                  <TableCell className="hidden text-right font-mono tabular-nums sm:table-cell">
                    {formatChips(row.biggestPot)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono font-semibold tabular-nums",
                      row.netProfit >= 0 ? "text-emerald-400" : "text-rose-400",
                    )}
                  >
                    {formatSigned(row.netProfit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
