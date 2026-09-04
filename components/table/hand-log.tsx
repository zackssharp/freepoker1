"use client";

import { useEffect, useRef } from "react";

import type { LogEntry } from "@/lib/poker/engine";
import { cn } from "@/lib/utils";

/**
 * The running commentary.
 *
 * Lines are keyed by their engine id, so React keeps existing rows mounted and
 * only the rows that arrived with the latest server response are new DOM nodes.
 * A CSS mount animation therefore plays exactly once per line, with no need to
 * track which ids have already been seen.
 */
export function HandLog({
  entries,
  className,
}: {
  entries: LogEntry[];
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries]);

  return (
    <div
      ref={scroller}
      className={cn(
        "border-border/70 bg-card/60 flex flex-col gap-1 overflow-y-auto rounded-2xl border p-3 text-xs",
        className,
      )}
      aria-live="polite"
      aria-label="Hand history"
    >
      {entries.length === 0 && (
        <p className="text-muted-foreground">The table is waiting on you.</p>
      )}

      {entries.map((entry, index) => {
        const fromEnd = entries.length - 1 - index;
        const isHeading = entry.text.startsWith("Hand #");

        return (
          <p
            key={entry.id}
            className={cn(
              "animate-log-in leading-snug",
              isHeading
                ? "text-primary mt-2 font-semibold first:mt-0"
                : "text-muted-foreground",
            )}
            // Newest lines cascade in; older rows never re-animate because they
            // are never remounted.
            style={{ animationDelay: `${Math.max(0, 8 - fromEnd) * 45}ms` }}
          >
            {entry.text}
          </p>
        );
      })}
    </div>
  );
}
