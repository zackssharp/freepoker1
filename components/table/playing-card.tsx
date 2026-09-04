import { SUIT_SYMBOL, describeCard, rankOf, suitOf, type Card } from "@/lib/poker/cards";
import { cn } from "@/lib/utils";

export type CardSize = "sm" | "md" | "lg";

const SIZES: Record<CardSize, { box: string; rank: string; pip: string }> = {
  sm: {
    box: "w-7 h-10 rounded-[5px]",
    rank: "text-[10px] leading-none",
    pip: "text-sm leading-none",
  },
  md: {
    box: "w-11 h-[3.9rem] rounded-md",
    rank: "text-xs leading-none",
    pip: "text-xl leading-none",
  },
  lg: {
    box: "w-14 h-20 rounded-lg",
    rank: "text-sm leading-none",
    pip: "text-3xl leading-none",
  },
};

export function PlayingCard({
  card,
  size = "md",
  className,
  dimmed = false,
}: {
  card: Card;
  size?: CardSize;
  className?: string;
  dimmed?: boolean;
}) {
  const style = SIZES[size];
  const suit = suitOf(card);
  const isRed = suit === "h" || suit === "d";

  return (
    <div
      role="img"
      aria-label={describeCard(card)}
      className={cn(
        "relative grid select-none place-items-center bg-white shadow-md ring-1 shadow-black/40 ring-black/15",
        style.box,
        dimmed && "opacity-45 saturate-50",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-1 left-1 font-semibold tabular-nums",
          style.rank,
          isRed ? "pip-red" : "pip-black",
        )}
        aria-hidden
      >
        {rankOf(card)}
      </span>
      <span
        className={cn(style.pip, isRed ? "pip-red" : "pip-black")}
        aria-hidden
      >
        {SUIT_SYMBOL[suit]}
      </span>
    </div>
  );
}

export function CardBack({
  size = "md",
  className,
}: {
  size?: CardSize;
  className?: string;
}) {
  const style = SIZES[size];

  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden bg-slate-800 shadow-md ring-1 shadow-black/40 ring-white/10",
        style.box,
        className,
      )}
    >
      <div
        className="absolute inset-[3px] rounded-[3px] opacity-70"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, oklch(0.62 0.16 258) 0 3px, oklch(0.34 0.09 258) 3px 6px)",
        }}
      />
    </div>
  );
}

/** A face-down hand, or nothing when the seat is not holding cards. */
export function HiddenHand({
  count,
  size = "sm",
  className,
}: {
  count: number;
  size?: CardSize;
  className?: string;
}) {
  if (count <= 0) return null;

  return (
    <div className={cn("flex gap-0.5", className)}>
      {Array.from({ length: count }, (_, index) => (
        <CardBack key={index} size={size} />
      ))}
    </div>
  );
}
