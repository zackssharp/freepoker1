"use client";

import { Loader2, Play } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { createGameAction } from "@/app/actions/game";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  formatChips,
  MAX_OPPONENTS,
  MIN_OPPONENTS,
  STAKES_LIST,
  type StakesId,
} from "@/lib/table-config";
import { cn } from "@/lib/utils";

/** Base UI reports either a scalar or a tuple depending on the thumb count. */
function firstValue(value: number | readonly number[], fallback: number): number {
  if (typeof value === "number") return value;
  return value[0] ?? fallback;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="w-full font-semibold" disabled={pending}>
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Play className="size-4" aria-hidden />
      )}
      {pending ? "Shuffling up…" : "Take a seat"}
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
        <Label htmlFor="displayName">Your name at the table</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={defaultName}
          placeholder="Guest"
          maxLength={24}
          autoComplete="nickname"
        />
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
                "rounded-xl border px-3 py-2.5 text-left transition-colors",
                stakes === entry.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40 hover:bg-accent/50",
              )}
            >
              <span className="block text-sm font-semibold">{entry.label}</span>
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
          <Label htmlFor="opponents">Bots at the table</Label>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {opponents}
          </span>
        </div>
        <Slider
          id="opponents"
          value={[opponents]}
          min={MIN_OPPONENTS}
          max={MAX_OPPONENTS}
          step={1}
          onValueChange={(value) => setOpponents(firstValue(value, 4))}
        />
        <p className="text-muted-foreground text-xs">
          Each bot is dealt one of five personalities — rocks fold, maniacs
          raise, and the pro adjusts.
        </p>
      </div>

      <SubmitButton />
    </form>
  );
}
