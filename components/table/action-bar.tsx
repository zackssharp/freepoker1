"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { Action, LegalActions } from "@/lib/poker/engine";
import { formatChips } from "@/lib/table-config";
import { cn } from "@/lib/utils";

const QUICK_SIZES = [
  { label: "½ pot", fraction: 0.5 },
  { label: "¾ pot", fraction: 0.75 },
  { label: "Pot", fraction: 1 },
] as const;

export function ActionBar({
  legal,
  currentBet,
  pot,
  bigBlind,
  pending,
  onAction,
}: {
  legal: LegalActions;
  currentBet: number;
  pot: number;
  bigBlind: number;
  pending: boolean;
  onAction: (action: Action) => void;
}) {
  // The parent remounts this component for each new decision (see the `key` in
  // PokerTable), so the slider starts at the minimum legal raise every time.
  const [target, setTarget] = useState(legal.minRaiseTo);

  const clamp = useMemo(
    () => (value: number) =>
      Math.min(Math.max(Math.round(value), legal.minRaiseTo), legal.maxRaiseTo),
    [legal.minRaiseTo, legal.maxRaiseTo],
  );

  const isShove = target >= legal.maxRaiseTo;
  const raiseLabel = legal.isOpen ? "Bet" : "Raise to";

  return (
    <div className="border-border/70 bg-card/80 rounded-2xl border p-3 backdrop-blur sm:p-4">
      {legal.canRaise && (
        <div className="mb-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium">
              {raiseLabel}
            </span>
            <span className="text-primary font-mono text-lg font-semibold tabular-nums">
              {formatChips(target)}
            </span>
            {isShove && (
              <span className="rounded-full bg-rose-600/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                All in
              </span>
            )}

            <div className="ml-auto flex flex-wrap gap-1">
              {QUICK_SIZES.map((size) => (
                <Button
                  key={size.label}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    setTarget(clamp(currentBet + pot * size.fraction))
                  }
                  className="h-7 px-2 text-xs"
                >
                  {size.label}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setTarget(legal.maxRaiseTo)}
                className="h-7 px-2 text-xs"
              >
                All in
              </Button>
            </div>
          </div>

          <Slider
            value={[target]}
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            step={Math.max(1, Math.min(bigBlind, legal.maxRaiseTo - legal.minRaiseTo))}
            disabled={pending || legal.minRaiseTo >= legal.maxRaiseTo}
            onValueChange={(value) =>
              setTarget(
                clamp(typeof value === "number" ? value : (value[0] ?? legal.minRaiseTo)),
              )
            }
            aria-label={`${raiseLabel} amount`}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={pending}
          onClick={() => onAction({ type: "fold" })}
          className={cn(
            "font-semibold",
            "hover:bg-destructive/20 hover:text-destructive-foreground",
          )}
        >
          Fold
        </Button>

        {legal.canCheck ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending}
            onClick={() => onAction({ type: "check" })}
            className="font-semibold"
          >
            Check
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={pending || !legal.canCall}
            onClick={() => onAction({ type: "call" })}
            className="font-semibold"
          >
            Call{" "}
            <span className="font-mono tabular-nums">
              {formatChips(legal.callAmount)}
            </span>
          </Button>
        )}

        <Button
          type="button"
          size="lg"
          disabled={pending || !legal.canRaise}
          onClick={() =>
            onAction({
              type: legal.isOpen ? "bet" : "raise",
              amount: clamp(target),
            })
          }
          className="col-span-2 font-semibold sm:col-span-1"
        >
          {isShove ? "All in" : raiseLabel}{" "}
          <span className="font-mono tabular-nums">{formatChips(target)}</span>
        </Button>
      </div>
    </div>
  );
}
