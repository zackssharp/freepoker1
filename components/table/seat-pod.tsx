import type { SeatView } from "@/lib/poker/view";
import { formatChips } from "@/lib/table-config";
import { cn } from "@/lib/utils";
import { HiddenHand, PlayingCard } from "./playing-card";

const ACTION_LABEL = { fold: "Fold", check: "Check", call: "Call", bet: "Bet", raise: "Raise" };

export function ChipStack({ silver = false }: { silver?: boolean }) {
  return <span className={cn("classic-chips", silver && "classic-chips-silver")} aria-hidden="true">
    <i /><i /><i /><i />
  </span>;
}

export function SeatPod({ seat }: { seat: SeatView }) {
  const folded = seat.status === "folded";
  const busted = seat.status === "busted";
  return (
    <div className={cn("classic-seat", seat.isHero && "classic-seat-hero", seat.isActing && "classic-seat-active", (folded || busted) && "classic-seat-folded")}
      aria-label={(seat.isHero ? "You" : seat.name) + ", " + formatChips(seat.stack) + " chips" + (seat.isActing ? ", acting" : "")}>
      <div className="classic-hand">
        {seat.holeCards.length > 0
          ? seat.holeCards.map((card) => <PlayingCard key={card} card={card} size={seat.isHero ? "lg" : "md"} dimmed={folded} />)
          : <HiddenHand count={folded ? 0 : seat.cardCount} size="md" />}
      </div>
      {seat.stack > 0 && <ChipStack />}
      <div className="classic-bankroll">{busted ? "Out" : "$" + formatChips(seat.stack)}</div>
      <div className="classic-name" title={seat.tell ?? seat.name}>{seat.isHero ? "You" : seat.name}</div>
      {seat.isButton && <span className="classic-dealer" title="Dealer" aria-label="Dealer">D</span>}
      {(seat.isSmallBlind || seat.isBigBlind) && <span className="sr-only">{seat.isSmallBlind ? "Small blind" : "Big blind"}</span>}
      {!seat.isHero && (seat.lastAction || seat.status === "all-in") && <div className="classic-bubble">
        {seat.status === "all-in" ? "All in" : seat.lastAction ? ACTION_LABEL[seat.lastAction] : ""}
      </div>}
      <span className="sr-only">{seat.committed > 0 ? formatChips(seat.committed) + " chips committed. " : ""}{seat.handLabel}</span>
    </div>
  );
}
