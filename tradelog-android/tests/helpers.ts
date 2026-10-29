import type { Trade } from "../src/core/types";

let n = 0;

/** A closed, reviewed-pending trade with sensible defaults. Override anything. */
export function mk(over: Partial<Trade> = {}): Trade {
  n += 1;
  const day = String(((n - 1) % 27) + 1).padStart(2, "0");
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    user_id: "user-1",
    pair: "EUR/USD",
    direction: "Buy",
    status: "closed",
    entry_price: 1.1,
    exit_price: 1.101,
    stop_loss: 1.099,
    take_profit: null,
    lot_size: 1,
    pnl: null,
    risk_amount: null,
    strategy: null,
    notes: null,
    opened_at: `2026-03-${day}T10:00:00.000Z`,
    closed_at: `2026-03-${day}T12:00:00.000Z`,
    created_at: `2026-03-${day}T12:00:00.000Z`,
    updated_at: `2026-03-${day}T12:00:00.000Z`,
    timeframe: "1H",
    r_multiple: null,
    review_status: "pending",
    adherence: null,
    emotion: null,
    confidence: null,
    mistake: null,
    lesson: null,
    reviewed_at: null,
    ...over,
  };
}
