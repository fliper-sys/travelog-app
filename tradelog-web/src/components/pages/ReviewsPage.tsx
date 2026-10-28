"use client";

import { useState } from "react";
import { byNewest, isHighPriority, isPending, reviewable, tradeDate } from "@/lib/analytics";
import { fmtPair, fmtSigned, tone } from "@/lib/format";
import { MetricGrid, PairIcon, ReviewTag } from "../ui";
import type { PageProps } from "./shared";

type Filter = "all" | "pending" | "reviewed";

export default function ReviewsPage(p: PageProps) {
  const [filter, setFilter] = useState<Filter>("all");

  // No manual memoization: the React Compiler caches these for us.
  const closed = reviewable(p.trades);
  const pending = closed.filter(isPending);
  const done = closed.length - pending.length;

  const list = closed
    .filter((t) => filter === "all" || t.review_status === filter)
    .sort((a, b) =>
      a.review_status === b.review_status ? byNewest(a, b) : a.review_status === "pending" ? -1 : 1,
    );

  return (
    <>
      <MetricGrid
        items={[
          { label: "Pending reviews", value: pending.length, sub: "Trades waiting for reflection" },
          { label: "Reviewed", value: done, sub: "Completed review forms" },
          {
            label: "Review completion",
            value: `${closed.length ? Math.round((done / closed.length) * 100) : 0}%`,
            sub: "Of all closed trades",
          },
          {
            label: "High priority",
            value: pending.filter(isHighPriority).length,
            sub: "Pending losses or off-plan trades",
          },
        ]}
      />

      <div className="card">
        <div className="section-head">
          <h2>Trade review queue</h2>
          <span>Review the process, not just the result.</span>
        </div>

        <div className="tabs" role="group" aria-label="Filter reviews">
          {(["all", "pending", "reviewed"] as Filter[]).map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "pending" ? "Pending" : "Reviewed"}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="empty">
            {closed.length === 0 ? "Close a trade with a P&L to start reviewing." : "Nothing here."}
          </div>
        ) : (
          list.map((t) => {
            const pnl = t.pnl == null ? null : Number(t.pnl);
            return (
              <div className="queue-item" key={t.id}>
                <PairIcon pair={t.pair} />
                <div className="grow">
                  <div className="strong">
                    {fmtPair(t.pair)} {t.strategy && <>· {t.strategy}</>}
                  </div>
                  <div className="small">
                    {tradeDate(t)} · {t.direction.toUpperCase()} ·{" "}
                    <span className={tone(pnl)}>{fmtSigned(pnl)}</span>
                    {isHighPriority(t) && <span className="negative"> · High priority</span>}
                  </div>
                  <div className="small">{t.lesson || "Add a lesson learned during review."}</div>
                </div>
                <ReviewTag trade={t} />
                <button className="btn sm" onClick={() => p.onReview(t)}>
                  {t.review_status === "pending" ? "Review" : "Edit"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
