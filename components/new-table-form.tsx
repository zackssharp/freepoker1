"use client";

import { ArrowRight, Check, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { createGameAction } from "@/app/actions/game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatChips,
  MAX_OPPONENTS,
  MIN_OPPONENTS,
  STAKES_LIST,
  type StakesId,
} from "@/lib/table-config";
import { cn } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="h-12 w-full rounded-xl font-semibold" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <ArrowRight className="size-4" aria-hidden />
      )}
      {pending ? "Shuffling up…" : "Start playing"}
    </Button>
  );
}

export function NewTableForm({ defaultName }: { defaultName?: string }) {
  const [stakes, setStakes] = useState<StakesId>("low");
  const [opponents, setOpponents] = useState(4);

  const selected = STAKES_LIST.find((entry) => entry.id === stakes);

  return (
    <form action={createGameAction} className="flex flex-col gap-5">
      <input type="hidden" name="stakes" value={stakes} />
      <input type="hidden" name="opponents" value={opponents} />

      <div className="grid gap-2">
        <Label htmlFor="displayName">Your display name</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={defaultName}
          placeholder="Guest"
          className="h-11 rounded-xl"
          aria-describedby="name-hint"
          maxLength={24}
          autoComplete="nickname"
        />
        <p id="name-hint" className="text-xs text-muted-foreground">Optional. This is how you’ll appear at the table.</p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Stakes</legend>
        <div className="grid grid-cols-3 gap-2">
          {STAKES_LIST.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setStakes(entry.id)}
              aria-pressed={stakes === entry.id}
              className={cn(
                "relative min-h-20 rounded-xl border px-3 py-3 text-left transition-colors",
                stakes === entry.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40 hover:bg-accent/50",
              )}
            >
              <span className="mb-2 flex items-center justify-between text-sm font-semibold">{entry.label}{stakes === entry.id && <Check className="size-3.5 text-primary" aria-hidden />}</span>
              <span className="text-muted-foreground block font-mono text-xs tabular-nums">
                {formatChips(entry.smallBlind)}/{formatChips(entry.bigBlind)}
              </span>
            </button>
          ))}
        </div>
        {selected && (
          <p className="text-muted-foreground text-xs">
            Everyone starts with {formatChips(selected.startingStack)} chips —{" "}
            {Math.round(selected.startingStack / selected.bigBlind)} big blinds.
          </p>
        )}
      </fieldset>

      <div className="grid gap-3">
        <div className="flex items-baseline justify-between">
          <span id="opponents-label" className="text-sm font-medium">Opponents</span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {opponents}
          </span>
        </div>
        <div role="group" aria-labelledby="opponents-label" className="grid grid-cols-5 gap-2">
          {Array.from({ length: MAX_OPPONENTS - MIN_OPPONENTS + 1 }, (_, index) => index + MIN_OPPONENTS).map((count) => (
            <button key={count} type="button" aria-pressed={opponents === count} aria-label={`${count} ${count === 1 ? "opponent" : "opponents"}`} onClick={() => setOpponents(count)} className={cn("flex h-11 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors", opponents === count ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent")}><Users className="size-3.5" aria-hidden />{count}</button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {opponents === 1 ? "Heads-up: just you and one bot." : `${opponents + 1} seats: you and ${opponents} bots with different playing styles.`}
        </p>
      </div>

      {selected && (
        <div aria-live="polite" aria-atomic="true" className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-background/40 p-4">
          <div><p className="mb-1 text-xs text-muted-foreground">Your starting stack</p><p className="font-mono text-lg font-semibold text-primary">{formatChips(selected.startingStack)} <span className="font-sans text-xs font-normal text-muted-foreground">chips</span></p></div>
          <div className="border-l border-border pl-4"><p className="mb-1 text-xs text-muted-foreground">Small / big blind</p><p className="font-mono text-lg font-semibold">{formatChips(selected.smallBlind)} / {formatChips(selected.bigBlind)}</p></div>
        </div>
      )}
      <SubmitButton />
    </form>
  );
}
