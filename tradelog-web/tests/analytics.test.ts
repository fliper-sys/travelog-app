import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcR,
  computeStats,
  cumulativeR,
  emotionGroups,
  equityCurve,
  filterRange,
  isHighPriority,
  maxDrawdown,
  psychologyHints,
  reviewQueue,
  scoredTrades,
  strategyBreakdown,
  tradeR,
  weekdayPerformance,
} from "../src/lib/analytics";
import { fmtPrice, normalizePair } from "../src/lib/format";
import { mk } from "./helpers";

/** A closed trade on a given UTC day (midday, so every time zone agrees on the date). */
const on = (day: string, over: Parameters<typeof mk>[0] = {}) =>
  mk({
    opened_at: `${day}T12:00:00.000Z`,
    closed_at: `${day}T12:00:00.000Z`,
    created_at: `${day}T12:00:00.000Z`,
    stop_loss: null,
    exit_price: null,
    ...over,
  });

describe("calcR", () => {
  it("measures the move in units of the risk taken", () => {
    assert.equal(calcR("Buy", 1.1, 1.103, 1.099), 3);
    assert.equal(calcR("Sell", 1.3, 1.295, 1.305), 1);
    assert.equal(calcR("Buy", 1.1, 1.098, 1.099), -2);
  });
  it("gives null when it cannot be worked out", () => {
    assert.equal(calcR("Buy", 1.1, null, 1.099), null);
    assert.equal(calcR("Buy", 1.1, 1.103, null), null);
    assert.equal(calcR("Buy", 1.1, 1.103, 1.1), null, "stop at entry means no risk to divide by");
  });
});

describe("tradeR", () => {
  it("prefers the stored value, then the calculation, then P&L / risk", () => {
    assert.equal(tradeR(mk({ r_multiple: 2.5, exit_price: 1.2, stop_loss: 1.0 })), 2.5);
    assert.equal(tradeR(mk({ r_multiple: null, entry_price: 1.1, exit_price: 1.103, stop_loss: 1.099 })), 3);
    assert.equal(tradeR(mk({ r_multiple: null, exit_price: null, stop_loss: null, pnl: -50, risk_amount: 100 })), -0.5);
    assert.equal(tradeR(mk({ r_multiple: null, exit_price: null, stop_loss: null, pnl: -50, risk_amount: null })), null);
  });
  it("accepts numbers that arrive from the database as strings", () => {
    assert.equal(tradeR(mk({ r_multiple: "1.5" as unknown as number })), 1.5);
  });
});

describe("computeStats", () => {
  const trades = [
    on("2026-03-02", { pnl: 100, r_multiple: 2 }),
    on("2026-03-03", { pnl: -50, r_multiple: -1 }),
    on("2026-03-04", { pnl: 0 }),
    on("2026-03-05", { pnl: 50, r_multiple: 1 }),
    on("2026-03-06", { status: "open", pnl: null, closed_at: null }),
    on("2026-03-07", { pnl: null }),
  ];

  it("counts only closed trades that have a P&L", () => {
    assert.equal(scoredTrades(trades).length, 4);
    const s = computeStats(trades);
    assert.equal(s.scored, 4);
    assert.deepEqual([s.wins, s.losses, s.breakeven], [2, 1, 1]);
  });
  it("computes net P&L, win rate, profit factor and average R", () => {
    const s = computeStats(trades);
    assert.equal(s.netPnl, 100);
    assert.equal(s.winRate, 0.5, "breakeven counts in the total");
    assert.equal(s.profitFactor, 3);
    assert.equal(s.avgR, 2 / 3, "mean of 2, -1, 1; the breakeven has no R to average");
    assert.equal(s.avgWin, 75);
    assert.equal(s.avgLoss, -50);
    assert.equal(s.best, 100);
    assert.equal(s.worst, -50);
  });
  it("handles empty and one-sided data", () => {
    const none = computeStats([]);
    assert.equal(none.winRate, null);
    assert.equal(none.profitFactor, null);
    assert.equal(none.avgR, null);
    assert.equal(computeStats([on("2026-03-02", { pnl: 10 })]).profitFactor, Infinity);
    assert.equal(computeStats([on("2026-03-02", { pnl: -10 })]).profitFactor, 0);
  });
  it("accepts P&L that arrives from the database as a string", () => {
    assert.equal(computeStats([on("2026-03-02", { pnl: "12.50" as unknown as number })]).netPnl, 12.5);
  });
});

describe("drawdown and curves", () => {
  const trades = [
    on("2026-03-02", { pnl: 100, r_multiple: 2 }),
    on("2026-03-03", { pnl: -50, r_multiple: -1 }),
    on("2026-03-04", { pnl: -80, r_multiple: -1.5 }),
    on("2026-03-05", { pnl: 30, r_multiple: 0.5 }),
  ];
  it("max drawdown is the biggest fall from a peak", () => {
    assert.equal(computeStats(trades).maxDrawdown, 130);
    assert.equal(maxDrawdown([]), 0);
  });
  it("equity curve is cumulative P&L, oldest first, whatever order they arrive in", () => {
    assert.deepEqual(equityCurve([...trades].reverse()).map((p) => p.value), [100, 50, -30, 0]);
  });
  it("cumulative R skips trades that have no R", () => {
    const withGap = [...trades, on("2026-03-06", { pnl: 5, r_multiple: null })];
    assert.deepEqual(cumulativeR(withGap).map((p) => p.value), [2, 1, -0.5, 0]);
  });
});

describe("filterRange", () => {
  const list = [on("2026-03-01"), on("2026-03-04"), on("2026-03-10")];
  it("keeps the last N days including today", () => {
    assert.equal(filterRange(list, "7", "2026-03-10").length, 2, "Mar 4 to Mar 10");
    assert.equal(filterRange(list, "30", "2026-03-10").length, 3);
    assert.equal(filterRange(list, "all", "2026-03-10").length, 3);
  });
});

describe("grouped views", () => {
  it("ranks strategies by net P&L", () => {
    const rows = strategyBreakdown([
      on("2026-03-02", { pnl: 100, strategy: "Breakout" }),
      on("2026-03-03", { pnl: -20, strategy: "Breakout" }),
      on("2026-03-04", { pnl: 30, strategy: "Pullback" }),
      on("2026-03-05", { pnl: 5, strategy: null }),
    ]);
    assert.deepEqual(rows.map((r) => [r.strategy, r.netPnl]), [["Breakout", 80], ["Pullback", 30], ["Unassigned", 5]]);
    assert.equal(rows[0].winRate, 0.5);
  });
  it("groups results by emotion", () => {
    const rows = emotionGroups([
      on("2026-03-02", { pnl: 50, emotion: "Calm" }),
      on("2026-03-03", { pnl: -40, emotion: "Greedy" }),
      on("2026-03-04", { pnl: 10, emotion: null }),
    ]);
    assert.equal(rows.find((r) => r.emotion === "Calm")?.netPnl, 50);
    assert.equal(rows.find((r) => r.emotion === "Greedy")?.trades, 1);
    assert.equal(rows.reduce((n, r) => n + r.trades, 0), 2, "trades with no emotion are left out");
  });
  it("always lists Monday to Friday, weekends only when traded", () => {
    const rows = weekdayPerformance([on("2026-03-02", { pnl: 10 })]); // a Monday
    assert.deepEqual(rows.map((r) => r.day), ["Mon", "Tue", "Wed", "Thu", "Fri"]);
    assert.equal(rows[0].pnl, 10);
    const sat = weekdayPerformance([on("2026-03-07", { pnl: 3 })]); // a Saturday
    assert.ok(sat.some((r) => r.day === "Sat"));
  });
});

describe("review queue", () => {
  it("lists pending closed trades, losses and off-plan first, then newest", () => {
    const win = on("2026-03-09", { pnl: 10 });
    const loss = on("2026-03-02", { pnl: -10 });
    const offPlan = on("2026-03-03", { pnl: 5, adherence: "No" });
    const reviewed = on("2026-03-04", { pnl: -5, review_status: "reviewed" });
    const open = on("2026-03-05", { status: "open", pnl: null });
    const queue = reviewQueue([win, reviewed, loss, open, offPlan]);
    assert.deepEqual(queue.map((t) => t.id), [offPlan.id, loss.id, win.id]);
    assert.ok(isHighPriority(loss) && isHighPriority(offPlan) && !isHighPriority(win));
  });
});

describe("psychology hints", () => {
  it("stay quiet until there is enough data", () => {
    assert.deepEqual(psychologyHints([on("2026-03-02", { pnl: 1 })]), []);
  });
  it("flag weaker results right after a loss, missing stops and piled-up reviews", () => {
    const pattern = [-10, -10, -10, -10, -10, -10, 10, 10, 10, 10, 10, 10];
    const trades = pattern.map((p, i) => on(`2026-03-${String(i + 1).padStart(2, "0")}`, { pnl: p }));
    const hints = psychologyHints(trades);
    assert.ok(hints.some((h) => h.includes("right after a loss")), hints.join(" | "));
    assert.ok(hints.some((h) => h.includes("no stop loss")));
    assert.ok(hints.some((h) => h.includes("waiting for a review")));
  });
});

describe("formatting helpers", () => {
  it("removes floating-point noise from prices", () => {
    assert.equal(fmtPrice(1.1900000000000002), "1.19");
    assert.equal(fmtPrice("1.08250000"), "1.0825");
    assert.equal(fmtPrice(149.25), "149.25");
    assert.equal(fmtPrice(null), "—");
  });
  it("normalises pairs", () => {
    assert.equal(normalizePair("eurusd"), "EUR/USD");
    assert.equal(normalizePair(" gbp usd "), "GBP/USD");
    assert.equal(normalizePair("EUR/USD"), "EUR/USD");
    assert.equal(normalizePair("xau/usd"), "XAU/USD");
  });
});
