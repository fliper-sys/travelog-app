import type { RangeKey } from "@/lib/analytics";
import type { PageId } from "@/lib/pages";
import type { Trade } from "@/lib/types";

/** What every page needs; each page uses the parts it shows. */
export interface PageProps {
  /** Every trade on this device. */
  trades: Trade[];
  /** Trades inside the selected date range. */
  ranged: Trade[];
  range: RangeKey;
  setRange: (range: RangeKey) => void;
  startBalance: number;
  /** Trades whose latest change has not reached the server yet. */
  pendingIds: Set<string>;
  navigate: (page: PageId) => void;
  onAdd: () => void;
  onReview: (trade: Trade) => void;
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
  toast: (message: string) => void;
}

export const RANGE_LABEL: Record<RangeKey, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  "90": "Last 90 days",
  all: "All time",
};
