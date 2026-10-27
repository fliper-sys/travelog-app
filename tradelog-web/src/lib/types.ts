export type Direction = "Buy" | "Sell";
export type TradeStatus = "open" | "closed";

/** A row of public.trades (see supabase/schema.sql). */
export interface Trade {
  id: string;
  user_id: string;
  pair: string;
  direction: Direction;
  status: TradeStatus;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  lot_size: number | null;
  pnl: number | null;
  risk_amount: number | null;
  strategy: string | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields the user controls when adding or editing a trade. */
export type TradeInput = Omit<
  Trade,
  "id" | "user_id" | "created_at" | "updated_at"
>;
