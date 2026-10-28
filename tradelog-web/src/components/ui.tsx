import type { ReactNode } from "react";
import type { Stats } from "@/lib/analytics";
import type { Trade } from "@/lib/types";
import { fmtPair, fmtPercent, fmtR, fmtRatio, fmtSigned, tone } from "@/lib/format";

export function PairIcon({ pair }: { pair: string }) {
  return <span className="pair-icon">{fmtPair(pair).slice(0, 3)}</span>;
}

/** Open / Pending / Reviewed tag for a trade. */
export function ReviewTag({ trade }: { trade: Trade }) {
  if (trade.status === "open") return <span className="tag dim">Open</span>;
  return trade.review_status === "pending" ? (
    <span className="tag pending">Pending</span>
  ) : (
    <span className="tag">Reviewed</span>
  );
}

export interface MetricItem {
  label: string;
  value: ReactNode;
  sub: string;
  tone?: string;
}

export function MetricGrid({ items, id }: { items: MetricItem[]; id?: string }) {
  return (
    <div className="grid metrics" id={id}>
      {items.map((m) => (
        <div className="card" key={m.label}>
          <div className="metric-label">{m.label}</div>
          <div className={`metric ${m.tone ?? ""}`}>{m.value}</div>
          <div className="small">{m.sub}</div>
        </div>
      ))}
    </div>
  );
}

/** The four headline numbers shared by Overview and Analytics. */
export function HeadlineMetrics({ stats }: { stats: Stats }) {
  return (
    <MetricGrid
      items={[
        {
          label: "Net P&L",
          value: stats.scored ? fmtSigned(stats.netPnl) : "—",
          tone: stats.scored ? tone(stats.netPnl) : "",
          sub: `${stats.scored} closed trade${stats.scored === 1 ? "" : "s"} in range`,
        },
        {
          label: "Win rate",
          value: fmtPercent(stats.winRate),
          sub: `${stats.wins} wins / ${stats.scored} trades`,
        },
        {
          label: "Profit factor",
          value: fmtRatio(stats.profitFactor),
          sub: "Gross profit ÷ gross loss",
        },
        {
          label: "Average R",
          value: fmtR(stats.avgR, 2),
          tone: tone(stats.avgR),
          sub: "Per trade with an R multiple",
        },
      ]}
    />
  );
}
