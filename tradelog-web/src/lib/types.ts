export type Direction = "Buy" | "Sell";
export type TradeStatus = "open" | "closed";
export type ReviewStatus = "pending" | "reviewed";
export type Emotion = "Calm" | "Confident" | "Fearful" | "Greedy" | "Frustrated";
export type Adherence = "Yes" | "Partially" | "No";

/**
 * A row of public.trades (supabase/schema.sql plus 002_review_fields.sql).
 * The review fields are null/"pending" until the trade has been reviewed.
 */
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
  // added by 002_review_fields.sql
  timeframe: string | null;
  r_multiple: number | null;
  review_status: ReviewStatus;
  adherence: Adherence | null;
  emotion: Emotion | null;
  confidence: number | null;
  mistake: string | null;
  lesson: string | null;
  reviewed_at: string | null;
}

/** Fields the trade form controls when adding or editing a trade. */
export type TradeInput = Pick<
  Trade,
  | "pair"
  | "direction"
  | "status"
  | "entry_price"
  | "exit_price"
  | "stop_loss"
  | "take_profit"
  | "lot_size"
  | "pnl"
  | "r_multiple"
  | "strategy"
  | "timeframe"
  | "notes"
  | "opened_at"
  | "closed_at"
>;

/** Fields the review form writes. */
export interface ReviewInput {
  adherence: Adherence;
  emotion: Emotion;
  confidence: number;
  mistake: string;
  lesson: string;
  review_status: "reviewed";
  reviewed_at: string;
}
