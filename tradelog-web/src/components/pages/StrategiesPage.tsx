"use client";

import { useMemo } from "react";
import { strategyBreakdown } from "@/lib/analytics";
import { fmtR, fmtRatio, fmtShort, tone } from "@/lib/format";
import type { PageProps } from "./shared";

export default function StrategiesPage({ ranged }: PageProps) {
  const rows = useMemo(() => strategyBreakdown(ranged), [ranged]);

  return (
    <>
      <div className="hero">
        <div>
          <h2 style={{ marginTop: 0 }}>Find what works for you.</h2>
          <div className="sub">Compare your setups using win rate, average R and net P&amp;L.</div>
        </div>
      </div>

      <div className="card gap">
        <div className="section-head">
          <h2>Strategy performance</h2>
          <span>Ranked by net P&amp;L</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty">No closed trades in this range.</div>
        ) : (
          rows.map((r) => (
            <div className="barrow" key={r.strategy}>
              <div className="strong">{r.strategy}</div>
              <div>
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${(r.winRate ?? 0) * 100}%` }} />
                </div>
                <div className="small" style={{ marginTop: 4 }}>
                  {r.trades} trade{r.trades === 1 ? "" : "s"} · {Math.round((r.winRate ?? 0) * 100)}% win rate ·
                  Avg {fmtR(r.avgR, 2)}
                  {r.profitFactor != null && ` · PF ${fmtRatio(r.profitFactor)}`}
                </div>
              </div>
              <div className={tone(r.netPnl)}>{fmtShort(r.netPnl)}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
