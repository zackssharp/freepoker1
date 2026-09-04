import { decideBotAction, type BotDecisionOptions } from "./ai";
import { applyAction, type TableState } from "./engine";

/** Hard stop so a logic bug can never spin a serverless function forever. */
const MAX_BOT_TURNS = 400;

/**
 * Resolves every bot decision until the hand is over or it is the human's
 * turn again. Runs entirely on the server: the browser only ever sees the
 * resulting state.
 */
export function playBotTurns(
  state: TableState,
  humanSeatId: string,
  options: BotDecisionOptions = {},
): TableState {
  let current = state;

  for (let turn = 0; turn < MAX_BOT_TURNS; turn++) {
    if (current.phase !== "awaiting-action") return current;
    if (!current.actingSeatId || current.actingSeatId === humanSeatId) {
      return current;
    }

    const decision = decideBotAction(current, current.actingSeatId, options);
    current = applyAction(current, current.actingSeatId, decision.action);
  }

  throw new Error("Bot turn limit exceeded; the hand did not resolve");
}
