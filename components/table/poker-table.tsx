"use client";

import { Loader2, LogOut, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  dealNextHandAction,
  leaveTableAction,
  submitPlayerAction,
} from "@/app/actions/game";
import { Button } from "@/components/ui/button";
import type { Action } from "@/lib/poker/engine";
import type { TableView } from "@/lib/poker/view";
import {
  formatChips,
  formatSigned,
  hueFromString,
  STREET_LABELS,
} from "@/lib/table-config";
import { cn } from "@/lib/utils";

import { ActionBar } from "./action-bar";
import { HandLog } from "./hand-log";
import { HiddenHand, PlayingCard } from "./playing-card";
import { SeatPod } from "./seat-pod";

/**
 * Opponents sit on the top half of the ellipse. The hero gets their own strip
 * below the felt, where there is room for readable cards and the bet controls.
 */
function opponentPosition(index: number, count: number) {
  const degrees = 180 + ((index + 0.5) / count) * 180;
  const radians = (degrees * Math.PI) / 180;
  const left = 50 + 40 * Math.cos(radians);
  const top = 50 + 33 * Math.sin(radians);
  return {
    left: `${Math.min(88, Math.max(12, left))}%`,
    top: `${top}%`,
  };
}

export function PokerTable({ initialView }: { initialView: TableView }) {
  const [view, setView] = useState(initialView);
  const [pending, startTransition] = useTransition();

  const opponents = view.seats.filter((seat) => !seat.isHero);
  const hero = view.seats.find((seat) => seat.isHero);
  const summary = view.lastHand;

  const run = useCallback(
    (work: () => Promise<{ ok: true; data: TableView } | { ok: false; error: string }>) => {
      startTransition(async () => {
        const result = await work();
        if (result.ok) setView(result.data);
        else toast.error(result.error);
      });
    },
    [],
  );

  const act = useCallback(
    (action: Action) => run(() => submitPlayerAction(view.gameId, action)),
    [run, view.gameId],
  );

  const dealNext = useCallback(
    () => run(() => dealNextHandAction(view.gameId)),
    [run, view.gameId],
  );

  return (
    <div className="game-shell mx-auto grid w-full max-w-7xl flex-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="game-main flex min-w-0 flex-col gap-4">
        {/* --- Felt ------------------------------------------------------ */}
        <div className="poker-rail rounded-[2.5rem] p-2 sm:p-3">
          <div
            className={cn(
              "poker-felt felt-weave relative aspect-[5/4] w-full rounded-[2rem] sm:aspect-[16/9]",
            )}
          >
            <div className="opponent-seats">
            {opponents.map((seat, index) => (
              <div
                key={seat.id}
                className="opponent-seat absolute"
                style={{
                  ...opponentPosition(index, opponents.length),
                }}
              >
                <SeatPod seat={seat} />
              </div>
            ))}
            </div>

            {/* --- Pot and board --- */}
            <div className="community-board absolute top-[60%] left-1/2 flex w-full flex-col items-center gap-2 px-4">
              <div className="flex items-center gap-2 text-white/90">
                <span className="text-[10px] font-semibold tracking-[0.2em] uppercase opacity-70">
                  {STREET_LABELS[view.street]}
                </span>
                <span className="bg-black/35 ring-primary/25 rounded-full px-3 py-1 font-mono text-sm font-semibold tabular-nums ring-1">
                  {formatChips(view.pot)}
                </span>
              </div>

              <div className="flex min-h-20 items-center justify-center gap-1 sm:gap-1.5">
                {view.board.length === 0 ? (
                  <span className="text-xs text-white/40">
                    {view.phase === "table-complete"
                      ? "Table closed"
                      : "Waiting for the flop"}
                  </span>
                ) : (
                  view.board.map((card) => (
                    <PlayingCard
                      key={card}
                      card={card}
                      size="lg"
                      className="animate-deal-in"
                    />
                  ))
                )}
              </div>

              {summary && summary.awards.length > 0 && (
                <div className="animate-log-in max-w-full rounded-full bg-black/45 px-3 py-1 text-center text-xs text-white ring-1 ring-white/15">
                  {summary.awards
                    .map(
                      (award) =>
                        `${award.name} wins ${formatChips(award.amount)}${
                          award.handLabel ? ` — ${award.handLabel}` : ""
                        }`,
                    )
                    .join(" · ")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- Hero strip ------------------------------------------------ */}
        {hero && (
          <div className="border-border/70 bg-card/70 flex flex-wrap items-center gap-3 rounded-2xl border px-3 py-2.5 backdrop-blur">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ring-1 ring-white/25"
              style={{
                background: `linear-gradient(140deg, oklch(0.66 0.14 ${hueFromString(
                  hero.name,
                )}), oklch(0.45 0.12 ${(hueFromString(hero.name) + 40) % 360}))`,
              }}
              aria-hidden
            >
              {hero.name.slice(0, 1).toUpperCase()}
            </span>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{hero.name}</p>
              <p className="text-primary font-mono text-sm tabular-nums">
                {formatChips(hero.stack)}
                {hero.committed > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatChips(hero.committed)} in
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-1">
              {hero.holeCards.length > 0 ? (
                hero.holeCards.map((card) => (
                  <PlayingCard
                    key={card}
                    card={card}
                    size="lg"
                    dimmed={hero.status === "folded"}
                    className="animate-deal-in"
                  />
                ))
              ) : (
                <HiddenHand count={hero.cardCount} size="lg" />
              )}
            </div>

            <div className="ml-auto text-right">
              {view.heroHandLabel && hero.status !== "folded" && (
                <p className="text-sm font-medium">{view.heroHandLabel}</p>
              )}
              {summary && hero.handNet !== null && (
                <p
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    hero.handNet > 0
                      ? "text-emerald-400"
                      : hero.handNet < 0
                        ? "text-rose-400"
                        : "text-muted-foreground",
                  )}
                >
                  {formatSigned(hero.handNet)} this hand
                </p>
              )}
            </div>
          </div>
        )}

        {/* --- Controls -------------------------------------------------- */}
        {view.phase === "awaiting-action" && view.legal && (
          <ActionBar
            // A fresh decision means fresh bet-sizing state.
            key={`${view.handNumber}:${view.street}:${view.legal.minRaiseTo}:${view.legal.maxRaiseTo}`}
            legal={view.legal}
            currentBet={view.currentBet}
            pot={view.pot}
            bigBlind={view.bigBlind}
            pending={pending}
            onAction={act}
          />
        )}

        {view.phase === "awaiting-action" && !view.legal && (
          <div className="border-border/70 bg-card/60 text-muted-foreground flex items-center justify-center gap-2 rounded-2xl border p-4 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Waiting on the other players…
          </div>
        )}

        {view.phase === "hand-complete" && (
          <div className="border-border/70 bg-card/70 flex flex-wrap items-center gap-3 rounded-2xl border p-3">
            <p className="text-muted-foreground text-sm">
              Hand #{view.handNumber} is complete.
            </p>
            <Button
              type="button"
              size="lg"
              className="ml-auto font-semibold"
              disabled={pending}
              onClick={dealNext}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Play className="size-4" aria-hidden />
              )}
              Deal next hand
            </Button>
          </div>
        )}

        {view.phase === "table-complete" && (
          <div className="border-border/70 bg-card/70 flex flex-wrap items-center gap-3 rounded-2xl border p-4">
            <div>
              <p className="text-base font-semibold">
                {hero && hero.stack > 0
                  ? "You took the table."
                  : "You are out of chips."}
              </p>
              <p className="text-muted-foreground text-sm">
                {view.handNumber} hands played at {formatChips(view.smallBlind)}/
                {formatChips(view.bigBlind)}.
              </p>
            </div>
            <Button
              size="lg"
              className="ml-auto font-semibold"
              nativeButton={false}
              render={<Link href="/" />}
            >
              New table
            </Button>
          </div>
        )}
      </div>

      {/* --- Side panel -------------------------------------------------- */}
      <aside className="flex flex-col gap-4">
        <div className="border-border/70 bg-card/60 grid grid-cols-3 gap-2 rounded-2xl border p-3 text-center lg:grid-cols-1 lg:text-left">
          <Stat label="Blinds">
            {formatChips(view.smallBlind)} / {formatChips(view.bigBlind)}
          </Stat>
          <Stat label="Hand">#{view.handNumber}</Stat>
          <Stat label="Players left">
            {view.seats.filter((seat) => seat.stack > 0).length}
          </Stat>
        </div>

        <HandLog entries={view.log} className="max-h-[26rem] min-h-40 flex-1" />

        {/* Cashing out marks the table finished, so the lobby stops offering
            to resume it. */}
        <form action={leaveTableAction.bind(null, view.gameId)}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-muted-foreground w-full"
          >
            <LogOut className="size-4" aria-hidden />
            Leave table
          </Button>
        </form>
      </aside>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold tabular-nums">{children}</p>
    </div>
  );
}
