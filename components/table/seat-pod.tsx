import { Bot } from "lucide-react";

import type { SeatView } from "@/lib/poker/view";
import { formatChips, hueFromString } from "@/lib/table-config";
import { cn } from "@/lib/utils";

import { HiddenHand, PlayingCard } from "./playing-card";

const ACTION_LABEL: Record<string, string> = {
  fold: "Fold",
  check: "Check",
  call: "Call",
  bet: "Bet",
  raise: "Raise",
};

function Avatar({ seat }: { seat: SeatView }) {
  const hue = hueFromString(seat.name);

  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold text-white ring-1 ring-white/25"
      style={{
        background: `linear-gradient(140deg, oklch(0.66 0.14 ${hue}), oklch(0.45 0.12 ${
          (hue + 40) % 360
        }))`,
      }}
      aria-hidden
    >
      {seat.kind === "bot" ? (
        <Bot className="size-4" />
      ) : (
        seat.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function PositionChip({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={cn(
        "grid size-5 place-items-center rounded-full text-[10px] font-bold shadow-sm",
        tone,
      )}
    >
      {label}
    </span>
  );
}

export function SeatPod({
  seat,
  /** Cards sit above the pod for opponents and below it for the hero. */
  cardsBelow = false,
}: {
  seat: SeatView;
  cardsBelow?: boolean;
}) {
  const folded = seat.status === "folded";
  const busted = seat.status === "busted";
  const showCards = seat.holeCards.length > 0;

  const cards = (
    <div className="flex h-10 items-center justify-center gap-0.5">
      {showCards
        ? seat.holeCards.map((card) => (
            <PlayingCard
              key={card}
              card={card}
              size={seat.isHero ? "md" : "sm"}
              dimmed={folded}
              className="animate-deal-in"
            />
          ))
        : (
            <HiddenHand count={folded ? 0 : seat.cardCount} size="sm" />
          )}
    </div>
  );

  return (
    <div
      className={cn(
        "flex w-[8.5rem] flex-col items-center gap-1",
        seat.isHero && "w-[10rem]",
      )}
    >
      {!cardsBelow && cards}

      <div
        className={cn(
          "relative w-full rounded-xl border px-2 py-1.5 backdrop-blur-sm transition-all",
          "border-white/10 bg-slate-950/70",
          seat.isActing &&
            "border-primary/70 shadow-primary/25 ring-primary/50 shadow-lg ring-2",
          (folded || busted) && "opacity-50",
        )}
      >
        <div className="absolute -top-2 -right-1 flex gap-1">
          {seat.isButton && (
            <PositionChip label="D" tone="bg-white text-slate-900" />
          )}
          {seat.isSmallBlind && (
            <PositionChip label="SB" tone="bg-sky-500 text-white text-[8px]" />
          )}
          {seat.isBigBlind && (
            <PositionChip label="BB" tone="bg-amber-500 text-white text-[8px]" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Avatar seat={seat} />
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold" title={seat.tell ?? undefined}>
              {seat.name}
            </p>
            <p className="text-primary font-mono text-xs tabular-nums">
              {busted ? "busted" : formatChips(seat.stack)}
            </p>
          </div>
        </div>

        {seat.handLabel && (
          <p className="text-muted-foreground mt-1 truncate text-[10px]">
            {seat.handLabel}
          </p>
        )}
      </div>

      <div className="flex h-5 items-center gap-1.5">
        {seat.lastAction && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              seat.lastAction === "fold"
                ? "bg-slate-700/70 text-slate-300"
                : seat.lastAction === "check"
                  ? "bg-slate-600/70 text-slate-100"
                  : "bg-emerald-600/80 text-white",
            )}
          >
            {ACTION_LABEL[seat.lastAction]}
          </span>
        )}
        {seat.committed > 0 && (
          <span className="bg-primary/15 text-primary ring-primary/30 flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums ring-1">
            <span className="bg-primary size-1.5 rounded-full" aria-hidden />
            {formatChips(seat.committed)}
          </span>
        )}
        {seat.status === "all-in" && seat.committed === 0 && (
          <span className="rounded-full bg-rose-600/80 px-2 py-0.5 text-[10px] font-semibold text-white">
            All in
          </span>
        )}
      </div>

      {cardsBelow && cards}
    </div>
  );
}
