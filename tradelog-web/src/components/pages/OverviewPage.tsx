"use client";

import { useMemo } from "react";
import {
  byNewest,
  computeStats,
  equityCurve,
  isHighPriority,
  reviewQueue,
  tradeDate,
  tradeR,
} from "@/lib/analytics";
import { fmtPair, fmtPercent, fmtR, fmtShort, fmtSigned, tone } from "@/lib/format";
import TrendChart from "../TrendChart";
import { HeadlineMetrics, PairIcon, ReviewTag } from "../ui";
import { RANGE_LABEL, type PageProps } from "./shared";

export default function OverviewPage(p: PageProps) {
  const stats = useMemo(() => computeStats(p.ranged), [p.ranged]);
  const curve = useMemo(() => equityCurve(p.ranged), [p.ranged]);
  const queue = useMemo(() => reviewQueue(p.trades), [p.trades]);
  const recent = useMemo(() => [...p.trades].sort(byNewest).slice(0, 5), [p.trades]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const returnPct = stats.netPnl / (p.startBalance || 1);

  if (p.trades.length === 0) {
    return (
      <div className="hero">
        <div>
          <div className="eyebrow">{greeting}</div>
          <h2>Record. Review. Refine.</h2>
          <div className="sub">
            Log your first trade to start building your journal. Everything is saved on this device first,
            so it works with no internet and syncs when you are back online.
          </div>
        </div>
        <button className="btn primary" onClick={p.onAdd}>
          ＋ Add your first trade
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="hero">
        <div>
          <div className="eyebrow">{greeting}</div>
          <h2>Record. Review. Refine.</h2>
          <div className="sub">
            {queue.length
              ? `You have ${queue.length} trade${queue.length === 1 ? "" : "s"} waiting for review. Small, consistent reviews turn history into decisions.`
              : "All caught up. Keep the review habit going."}
          </div>
        </div>
        {queue.length > 0 && (
          <button className="btn" onClick={() => p.navigate("reviews")}>
            Start reviewing →
          </button>
        )}
      </div>

      <HeadlineMetrics stats={stats} />

      {stats.scored === 0 && (
        <div className="notice" style={{ marginBottom: 14 }}>
          No closed trades with a P&amp;L in “{RANGE_LABEL[p.range]}”.{" "}
          {p.range !== "all" && (
            <button className="link-btn" onClick={() => p.setRange("all")}>
              Show all time
            </button>
          )}
        </div>
      )}

      <div className="grid layout2">
        <div className="card">
          <div className="section-head">
            <h2>Equity curve</h2>
            {stats.scored > 0 && (
              <span className={tone(stats.netPnl)}>
                {stats.netPnl >= 0 ? "↗" : "↘"} {returnPct >= 0 ? "+" : ""}
                {fmtPercent(returnPct)} · {fmtShort(stats.netPnl)}
              </span>
            )}
          </div>
          <TrendChart
            data={curve}
            format={fmtShort}
            name="Equity"
            gradientId="equityFill"
            ariaLabel={`Equity curve, net ${fmtShort(stats.netPnl)} over ${stats.scored} trades`}
          />
        </div>

        <div className="card">
          <div className="section-head">
            <h2>Review queue</h2>
            <button className="btn ghost sm" onClick={() => p.navigate("reviews")}>
              View all →
            </button>
          </div>
          {queue.length === 0 ? (
            <div className="empty">All caught up. Great work.</div>
          ) : (
            queue.slice(0, 4).map((t) => (
              <div className="queue-item" key={t.id}>
                <PairIcon pair={t.pair} />
                <div className="grow">
                  <div className="strong">
                    {fmtPair(t.pair)} {t.strategy && <span className="muted">· {t.strategy}</span>}
                  </div>
                  <div className="small">
                    {tradeDate(t)} · {t.direction.toUpperCase()}
                    {isHighPriority(t) && <span className="negative"> · High priority</span>}
                  </div>
                </div>
                <button className="btn sm" onClick={() => p.onReview(t)}>
                  Review
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card gap">
        <div className="section-head">
          <h2>Recent trades</h2>
          <button className="btn ghost sm" onClick={() => p.navigate("journal")}>
            Open journal →
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pair / Strategy</th>
                <th>Direction</th>
                <th>Net P&amp;L</th>
                <th>R multiple</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => {
                const pnl = t.pnl == null ? null : Number(t.pnl);
                const r = tradeR(t);
                return (
                  <tr key={t.id}>
                    <td>
                      <div className="strong">{fmtPair(t.pair)}</div>
                      <div className="subline">{t.strategy || "No strategy"}</div>
                    </td>
                    <td>{t.direction.toUpperCase()}</td>
                    <td className={tone(pnl)}>{fmtSigned(pnl)}</td>
                    <td className={tone(r)}>{fmtR(r)}</td>
                    <td>
                      <ReviewTag trade={t} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
