"use client";

import { useMemo, useState } from "react";
import { byNewest, isHighPriority, isPending, reviewQueue, tradeDate } from "@/lib/analytics";
import { fmtPair, fmtSigned, parseLocalDate, shortDate, todayLocal, tone } from "@/lib/format";
import type { Trade } from "@/lib/types";
import { PairIcon, ReviewTag } from "../ui";
import type { PageProps } from "./shared";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export default function CalendarPage(p: PageProps) {
  const [cursor, setCursor] = useState(() => {
    const d = parseLocalDate(todayLocal());
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const t of p.trades) {
      const key = tradeDate(t);
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [p.trades]);

  const { year, month } = cursor;
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayLocal();

  function shift(step: number) {
    const d = new Date(year, month + step, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(null);
  }

  function jumpToLatest() {
    const newest = [...p.trades].sort(byNewest)[0];
    const d = parseLocalDate(newest ? tradeDate(newest) : today);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(null);
  }

  const queue = useMemo(() => reviewQueue(p.trades), [p.trades]);
  const list = selected ? (byDay.get(selected) ?? []) : queue.slice(0, 5);

  return (
    <div className="card">
      <div className="section-head">
        <div>
          <h2>{new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
          <div className="small">Click a day to see its trades</div>
        </div>
        <div className="cal-nav">
          <button className="btn sm" onClick={() => shift(-1)} aria-label="Previous month">
            ←
          </button>
          <button className="btn sm" onClick={jumpToLatest}>
            Latest
          </button>
          <button className="btn sm" onClick={() => shift(1)} aria-label="Next month">
            →
          </button>
        </div>
      </div>

      <div className="calendar">
        {DAY_NAMES.map((n) => (
          <div className="dayname" key={n}>
            {n}
          </div>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = `${year}-${pad(month + 1)}-${pad(day)}`;
          const trades = byDay.get(key) ?? [];
          const waiting = trades.filter(isPending);
          const cls = !trades.length ? "" : waiting.some(isHighPriority) ? "high" : waiting.length ? "pending" : "";
          return (
            <button
              key={key}
              className={`day ${cls} ${key === today ? "today" : ""} ${key === selected ? "sel" : ""}`}
              onClick={() => setSelected(selected === key ? null : key)}
              aria-pressed={key === selected}
              aria-label={`${shortDate(key)}${
                trades.length ? `, ${trades.length} trade${trades.length === 1 ? "" : "s"}, ${waiting.length} pending` : ""
              }`}
            >
              {day}
              {trades.length > 0 && (
                <>
                  <span className="dot" />
                  <span className="cnt">{trades.length}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="filters" style={{ marginTop: 14 }}>
        <span className="tag">● Reviewed</span>
        <span className="tag warn">● Pending</span>
        <span className="tag pending">● High priority</span>
      </div>

      <h2 style={{ margin: "18px 0 4px", fontSize: 15 }}>
        {selected ? `Trades on ${shortDate(selected)}` : "Upcoming reviews"}
      </h2>
      {list.length === 0 ? (
        <div className="empty">{selected ? "No trades on this day." : "No pending reviews."}</div>
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
                  {tradeDate(t)} · <span className={tone(pnl)}>{fmtSigned(pnl)}</span>
                </div>
              </div>
              <ReviewTag trade={t} />
              {t.status === "closed" ? (
                <button className="btn sm" onClick={() => p.onReview(t)}>
                  {t.review_status === "pending" ? "Review" : "Edit"}
                </button>
              ) : (
                <button className="btn sm" onClick={() => p.onEdit(t)}>
                  Edit
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

