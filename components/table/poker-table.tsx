"use client";

import { Home, Loader2, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { dealNextHandAction, leaveTableAction, submitPlayerAction } from "@/app/actions/game";
import { Button } from "@/components/ui/button";
import type { Action } from "@/lib/poker/engine";
import type { TableView } from "@/lib/poker/view";
import { formatChips, STREET_LABELS } from "@/lib/table-config";
import { ActionBar } from "./action-bar";
import { HandLog } from "./hand-log";
import { PlayingCard } from "./playing-card";
import { ChipStack, SeatPod } from "./seat-pod";
import { useTableSounds } from "./use-table-sounds";
import "./classic-table.css";

function opponentPosition(index: number, count: number) {
  const positions = count === 1 ? [[87, 28]]
    : count === 2 ? [[12, 28], [88, 28]]
    : count === 3 ? [[10, 28], [90, 28], [86, 61]]
    : count === 4 ? [[8, 28], [90, 28], [86, 61], [12, 61]]
    : [[8, 28], [50, 27], [90, 28], [86, 61], [12, 61]];
  const [left, top] = positions[index] ?? [50, 27];
  return { left: left + "%", top: top + "%" };
}

export function PokerTable({ initialView }: { initialView: TableView }) {
  const [view, setView] = useState(initialView);
  const [pending, startTransition] = useTransition();
  const { muted, toggleMuted, unlock, playResult } = useTableSounds();
  const opponents = view.seats.filter((seat) => !seat.isHero);
  const hero = view.seats.find((seat) => seat.isHero);

  const run = (
    work: () => Promise<{ ok: true; data: TableView } | { ok: false; error: string }>,
    action?: Action["type"],
  ) => {
    unlock();
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        playResult(view, result.data, action);
        setView(result.data);
      } else toast.error(result.error);
    });
  };
  const act = (action: Action) => run(() => submitPlayerAction(view.gameId, action), action.type);

  return (
    <div className="classic-table">
      <section className="classic-stage" aria-label="Poker table" data-opponents={opponents.length}>
        <Link href="/" className="classic-icon classic-home" aria-label="Return to lobby" title="Return to lobby">
          <Home aria-hidden />
        </Link>
        <button type="button" className="classic-icon classic-sound" onClick={toggleMuted}
          aria-label={muted ? "Unmute sound effects" : "Mute sound effects"} aria-pressed={muted}
          title={muted ? "Sound off" : "Sound on"}>
          {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
        </button>
        <div className="classic-pot" aria-label={"Pot: " + formatChips(view.pot) + " chips"}>
          <ChipStack silver />
          <strong>${formatChips(view.pot)}</strong>
        </div>
        {opponents.map((seat, index) => (
          <div key={seat.id} className="classic-opponent" style={opponentPosition(index, opponents.length)}>
            <SeatPod seat={seat} />
          </div>
        ))}
        <div className="classic-board" aria-label="Community cards">
          {view.board.map((card) => <PlayingCard key={card} card={card} size="lg" className="animate-deal-in" />)}
        </div>
        {hero && <div className="classic-hero"><SeatPod seat={hero} /></div>}
        <div className="classic-result" aria-live="polite">
          {view.lastHand?.awards.map((award) => award.name + " wins $" + formatChips(award.amount) + (award.handLabel ? " — " + award.handLabel : "")).join(" · ")
            || (hero?.status !== "folded" ? view.heroHandLabel : "")}
        </div>
        <div className="classic-controls">
          {view.phase === "awaiting-action" && view.legal && (
            <ActionBar key={[view.handNumber, view.street, view.legal.minRaiseTo, view.legal.maxRaiseTo].join(":")}
              legal={view.legal} currentBet={view.currentBet} pot={view.pot} bigBlind={view.bigBlind}
              pending={pending} onAction={act} classic />
          )}
          {view.phase === "awaiting-action" && !view.legal && <p className="classic-wait"><Loader2 className="size-4 animate-spin" /> Waiting on the other players…</p>}
          {view.phase === "hand-complete" && <Button disabled={pending} onClick={() => run(() => dealNextHandAction(view.gameId))}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Deal next hand
          </Button>}
          {view.phase === "table-complete" && <div className="classic-finished">
            <p>{hero && hero.stack > 0 ? "You took the table." : "You are out of chips."}</p>
            <Button nativeButton={false} render={<Link href="/" />}>New table</Button>
          </div>}
        </div>
      </section>
      <details className="classic-details">
        <summary>Table details &amp; hand history</summary>
        <div className="classic-details-content">
          <p>Hand #{view.handNumber} · {STREET_LABELS[view.street]} · Blinds ${formatChips(view.smallBlind)} / ${formatChips(view.bigBlind)} · {view.seats.filter((seat) => seat.stack > 0).length} players left</p>
          <HandLog entries={view.log} className="max-h-64" />
          <form action={leaveTableAction.bind(null, view.gameId)}><Button type="submit" variant="ghost" size="sm">Leave table &amp; cash out</Button></form>
        </div>
      </details>
    </div>
  );
}
