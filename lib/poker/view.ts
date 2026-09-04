import type { Card } from "./cards";
import {
  legalActions,
  potSize,
  type ActionType,
  type HandSummary,
  type LegalActions,
  type LogEntry,
  type SeatKind,
  type SeatStatus,
  type Street,
  type TablePhase,
  type TableState,
} from "./engine";
import { evaluateHand } from "./evaluator";
import { BOT_PROFILES, type BotProfileId } from "./profiles";

export interface SeatView {
  id: string;
  name: string;
  kind: SeatKind;
  profileId: BotProfileId | null;
  /** The personality blurb, for the seat tooltip. Null for the human seat. */
  tell: string | null;
  stack: number;
  committed: number;
  status: SeatStatus;
  lastAction: ActionType | null;
  lastAmount: number;
  /** Face-up cards. Empty while an opponent's hand is still concealed. */
  holeCards: Card[];
  /** How many cards this seat is holding, whether or not they are face up. */
  cardCount: number;
  isHero: boolean;
  isActing: boolean;
  isButton: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  /** Chips won or lost on the hand that just finished. */
  handNet: number | null;
  /** Made hand at showdown, e.g. "Two Pair, Aces and Nines". */
  handLabel: string | null;
}

/**
 * Everything the browser is allowed to know. Built on the server from the full
 * `TableState`; the deck and concealed hole cards never leave the server.
 */
export interface TableView {
  gameId: string;
  handNumber: number;
  street: Street;
  phase: TablePhase;
  board: Card[];
  pot: number;
  currentBet: number;
  smallBlind: number;
  bigBlind: number;
  startingStack: number;
  heroSeatId: string;
  actingSeatId: string | null;
  seats: SeatView[];
  /** Present only while it is the hero's turn. */
  legal: LegalActions | null;
  /** The hero's best five-card hand right now, once there is a board. */
  heroHandLabel: string | null;
  log: LogEntry[];
  lastHand: HandSummary | null;
}

export function toTableView(
  state: TableState,
  gameId: string,
  heroSeatId: string,
): TableView {
  const revealed = new Set(state.lastHand?.revealedSeatIds ?? []);
  const netBySeat = new Map(
    (state.lastHand?.players ?? []).map((player) => [player.seatId, player.net]),
  );
  const labelBySeat = new Map(
    (state.lastHand?.players ?? [])
      .filter((player) => player.handLabel !== null)
      .map((player) => [player.seatId, player.handLabel as string]),
  );

  const legal = legalActions(state);

  const seats: SeatView[] = state.seats.map((seat, index) => {
    const isHero = seat.id === heroSeatId;
    const showCards = isHero || revealed.has(seat.id);

    return {
      id: seat.id,
      name: seat.name,
      kind: seat.kind,
      profileId: seat.profileId,
      tell: seat.profileId ? BOT_PROFILES[seat.profileId].tell : null,
      stack: seat.stack,
      committed: seat.committed,
      status: seat.status,
      lastAction: seat.lastAction,
      lastAmount: seat.lastAmount,
      holeCards: showCards ? seat.holeCards.slice() : [],
      cardCount: seat.holeCards.length,
      isHero,
      isActing: state.actingSeatId === seat.id,
      isButton: index === state.buttonIndex && state.handNumber > 0,
      isSmallBlind: state.smallBlindSeatId === seat.id,
      isBigBlind: state.bigBlindSeatId === seat.id,
      handNet: netBySeat.get(seat.id) ?? null,
      handLabel: labelBySeat.get(seat.id) ?? null,
    };
  });

  const hero = state.seats.find((seat) => seat.id === heroSeatId);
  const heroHandLabel =
    hero && hero.holeCards.length === 2 && state.board.length >= 3
      ? evaluateHand([...hero.holeCards, ...state.board]).label
      : null;

  return {
    gameId,
    handNumber: state.handNumber,
    street: state.street,
    phase: state.phase,
    board: state.board.slice(),
    pot: potSize(state),
    currentBet: state.currentBet,
    smallBlind: state.smallBlind,
    bigBlind: state.bigBlind,
    startingStack: state.startingStack,
    heroSeatId,
    actingSeatId: state.actingSeatId,
    seats,
    legal: legal && legal.seatId === heroSeatId ? legal : null,
    heroHandLabel,
    log: state.log.slice(-60),
    lastHand: state.lastHand,
  };
}
