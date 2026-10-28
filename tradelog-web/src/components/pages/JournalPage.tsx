"use client";

import { useMemo, useState } from "react";
import { byNewest, tradeDate, tradeR, tradeTime } from "@/lib/analytics";
import { downloadCsv, tradesToCsv } from "@/lib/csv";
import { fmtPair, fmtPrice, fmtR, fmtSigned, tone } from "@/lib/format";
import { ReviewTag } from "../ui";
import type { PageProps } from "./shared";

type Sort = "new" | "old" | "best" | "worst";
type StatusFilter = "all" | "pending" | "reviewed" | "open";
const PAGE_SIZE = 100;

const pnlOf = (p: number | null) => (p == null ? 0 : Number(p));

export default function JournalPage(p: PageProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [direction, setDirection] = useState<"all" | "Buy" | "Sell">("all");
  const [sort, setSort] = useState<Sort>("new");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = p.trades.filter((t) => {
      if (q && !`${t.pair} ${t.strategy ?? ""} ${t.notes ?? ""} ${t.lesson ?? ""}`.toLowerCase().includes(q)) {
        return false;
      }
      if (direction !== "all" && t.direction !== direction) return false;
      if (status === "open") return t.status === "open";
      if (status === "pending") return t.status === "closed" && t.review_status === "pending";
      if (status === "reviewed") return t.review_status === "reviewed";
      return true;
    });
    const order: Record<Sort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      new: byNewest,
      old: (a, b) => tradeTime(a) - tradeTime(b),
      best: (a, b) => pnlOf(b.pnl) - pnlOf(a.pnl),
      worst: (a, b) => pnlOf(a.pnl) - pnlOf(b.pnl),
    };
    return rows.sort(order[sort]);
  }, [p.trades, query, status, direction, sort]);

  function exportCsv() {
    downloadCsv("tradelog-trades.csv", tradesToCsv(p.trades));
    p.toast(`Exported ${p.trades.length} trade${p.trades.length === 1 ? "" : "s"}.`);
  }

  return (
    <div className="card">
      <div className="section-head">
        <h2>All trades</h2>
        <span>
          {list.length} of {p.trades.length} trades
        </span>
      </div>

      <div className="filters">
        <label className="sr" htmlFor="j-search">
          Search trades
        </label>
        <input
          id="j-search"
          type="search"
          placeholder="Search pair, strategy or notes…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE_SIZE);
          }}
        />
        <select
          aria-label="Review status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending review</option>
          <option value="reviewed">Reviewed</option>
          <option value="open">Open trades</option>
        </select>
        <select
          aria-label="Direction"
          value={direction}
          onChange={(e) => setDirection(e.target.value as "all" | "Buy" | "Sell")}
        >
          <option value="all">Buy &amp; Sell</option>
          <option value="Buy">Buy</option>
          <option value="Sell">Sell</option>
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
          <option value="best">Best P&amp;L</option>
          <option value="worst">Worst P&amp;L</option>
        </select>
        <button className="btn" onClick={exportCsv} disabled={p.trades.length === 0}>
          ⇩ Export CSV
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pair / Strategy</th>
              <th>Date</th>
              <th>Side</th>
              <th>Entry → Exit</th>
              <th>Net P&amp;L</th>
              <th>R</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.slice(0, limit).map((t) => {
              const pnl = t.pnl == null ? null : Number(t.pnl);
              const r = tradeR(t);
              const label = `${fmtPair(t.pair)} ${tradeDate(t)}`;
              return (
                <tr key={t.id}>
                  <td>
                    <div className="strong">{fmtPair(t.pair)}</div>
                    <div className="subline">
                      {t.strategy || "No strategy"}
                      {t.timeframe ? ` · ${t.timeframe}` : ""}
                    </div>
                  </td>
                  <td>{tradeDate(t)}</td>
                  <td>
                    <span className="tag dim">{t.direction.toUpperCase()}</span>
                  </td>
                  <td>
                    {fmtPrice(t.entry_price)} → {fmtPrice(t.exit_price)}
                  </td>
                  <td className={tone(pnl)}>{fmtSigned(pnl)}</td>
                  <td className={tone(r)}>{fmtR(r)}</td>
                  <td>
                    <ReviewTag trade={t} />{" "}
                    {p.pendingIds.has(t.id) && (
                      <span className="tag warn" title="Saved on this device. It will upload when you are online.">
                        Not synced
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      {t.status === "closed" && (
                        <button className="btn sm" onClick={() => p.onReview(t)}>
                          {t.review_status === "pending" ? "Review" : "Edit review"}
                        </button>
                      )}
                      <button
                        className="btn icon"
                        onClick={() => p.onEdit(t)}
                        aria-label={`Edit trade ${label}`}
                        title="Edit trade"
                      >
                        ✎
                      </button>
                      <button
                        className="btn icon danger"
                        onClick={() => p.onDelete(t)}
                        aria-label={`Delete trade ${label}`}
                        title="Delete trade"
                      >
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="empty">
                  {p.trades.length === 0 ? "No trades yet. Add your first one." : "No trades match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {list.length > limit && (
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button className="btn" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, list.length - limit)} more
          </button>
        </div>
      )}
    </div>
  );
}
