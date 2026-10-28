import type { Direction, Emotion, Trade } from "./types";
import { EMOTIONS } from "./constants";
import { addDays, fmtR, fmtSigned, localDate, parseLocalDate } from "./format";

/**
 * Metric definitions (also documented in the README):
 *
 * - Only CLOSED trades that have a P&L are "scored". Open trades and closed
 *   trades with no P&L are ignored by every metric.
 * - Win = P&L > 0, loss = P&L < 0, breakeven = P&L === 0. Breakeven trades
 *   count toward the total (so they lower the win rate) but are neither a
 *   win nor a loss.
 * - P&L is used as entered. Fees are not modelled; enter P&L net of fees.
 * - Win rate = wins / scored trades.
 * - Profit factor = gross profit / gross loss (∞ with profits and no losses,
 *   null when there is nothing to compare).
 * - R multiple, in order of preference: the stored value, else calculated
 *   from entry, exit and stop loss, else P&L / risk amount. Average R is the
 *   mean over scored trades that have an R.
 * - Max drawdown = largest fall from a cumulative-P&L peak (starting at 0).
 * - A trade's date is its close date (or open date if it has none).
 */

export type RangeKey = "7" | "30" | "90" | "all";

export interface Stats {
  scored: number;
  netPnl: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number | null;
  profitFactor: number | null;
  avgR: number | null;
  avgWin: number | null;
  avgLoss: number | null; // negative number
  grossProfit: number;
  grossLoss: number; // positive magnitude
  best: number | null;
  worst: number | null;
  maxDrawdown: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface StrategyRow {
  strategy: string;
  trades: number;
  winRate: number | null;
  avgR: number | null;
  profitFactor: number | null;
  netPnl: number;
}

export interface EmotionRow {
  emotion: Emotion;
  trades: number;
  winRate: number | null;
  avgR: number | null;
  netPnl: number;
}

export interface WeekdayRow {
  day: string;
  trades: number;
  pnl: number;
}

export interface Insight {
  icon: string;
  tone: "mint" | "coral" | "amber" | "blue";
  title: string;
  detail: string;
}

const toNum = (v: unknown): number => Number(v);
const sumBy = (list: Trade[], f: (t: Trade) => number) =>
  list.reduce((s, t) => s + f(t), 0);

// ---------- dates & ordering ----------

export function tradeDate(t: Trade): string {
  return localDate(t.closed_at ?? t.opened_at);
}

export function tradeTime(t: Trade): number {
  return new Date(t.closed_at ?? t.opened_at).getTime();
}

const byTimeAsc = (a: Trade, b: Trade) =>
  tradeTime(a) - tradeTime(b) || a.created_at.localeCompare(b.created_at);

export const byNewest = (a: Trade, b: Trade) => byTimeAsc(b, a);

/** Trades whose date falls inside the range ending today (inclusive). */
export function filterRange(trades: Trade[], range: RangeKey, today: string): Trade[] {
  if (range === "all") return trades;
  const from = addDays(today, -(Number(range) - 1));
  return trades.filter((t) => tradeDate(t) >= from);
}

// ---------- R multiple ----------

export function calcR(
  direction: Direction,
  entry: number,
  exit: number | null,
  stop: number | null,
): number | null {
  if (exit == null || stop == null) return null;
  const risk = Math.abs(entry - stop);
  if (!risk) return null;
  const move = direction === "Buy" ? exit - entry : entry - exit;
  return Math.round((move / risk) * 100) / 100;
}

export function tradeR(t: Trade): number | null {
  if (t.r_multiple != null && !Number.isNaN(toNum(t.r_multiple))) {
    return toNum(t.r_multiple);
  }
  const calc = calcR(
    t.direction,
    toNum(t.entry_price),
    t.exit_price == null ? null : toNum(t.exit_price),
    t.stop_loss == null ? null : toNum(t.stop_loss),
  );
  if (calc != null) return calc;
  if (t.pnl != null && t.risk_amount != null && toNum(t.risk_amount) > 0) {
    return toNum(t.pnl) / toNum(t.risk_amount);
  }
  return null;
}

const meanR = (list: Trade[]): number | null => {
  const rs = list.map(tradeR).filter((r): r is number => r != null);
  return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null;
};

// ---------- core stats ----------

export function scoredTrades(trades: Trade[]): Trade[] {
  return trades.filter((t) => t.status === "closed" && t.pnl != null);
}

export function maxDrawdown(ascScored: Trade[]): number {
  let cum = 0;
  let peak = 0;
  let dd = 0;
  for (const t of ascScored) {
    cum += toNum(t.pnl);
    peak = Math.max(peak, cum);
    dd = Math.max(dd, peak - cum);
  }
  return dd;
}

export function computeStats(trades: Trade[]): Stats {
  const scored = [...scoredTrades(trades)].sort(byTimeAsc);
  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let losses = 0;
  let breakeven = 0;

  for (const t of scored) {
    const p = toNum(t.pnl);
    if (p > 0) {
      wins += 1;
      grossProfit += p;
    } else if (p < 0) {
      losses += 1;
      grossLoss += -p;
    } else {
      breakeven += 1;
    }
  }

  let profitFactor: number | null = null;
  if (grossLoss > 0) profitFactor = grossProfit / grossLoss;
  else if (grossProfit > 0) profitFactor = Infinity;

  const pnls = scored.map((t) => toNum(t.pnl));

  return {
    scored: scored.length,
    netPnl: grossProfit - grossLoss,
    wins,
    losses,
    breakeven,
    winRate: scored.length ? wins / scored.length : null,
    profitFactor,
    avgR: meanR(scored),
    avgWin: wins ? grossProfit / wins : null,
    avgLoss: losses ? -grossLoss / losses : null,
    grossProfit,
    grossLoss,
    best: pnls.length ? Math.max(...pnls) : null,
    worst: pnls.length ? Math.min(...pnls) : null,
    maxDrawdown: maxDrawdown(scored),
  };
}

// ---------- chart series ----------

const dayLabel = (t: Trade) =>
  parseLocalDate(tradeDate(t)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

/** Cumulative P&L over scored trades, oldest first. */
export function equityCurve(trades: Trade[]): TrendPoint[] {
  let equity = 0;
  return [...scoredTrades(trades)].sort(byTimeAsc).map((t) => {
    equity += toNum(t.pnl);
    return { label: dayLabel(t), value: Math.round(equity * 100) / 100 };
  });
}

/** Cumulative R over scored trades that have an R, oldest first. */
export function cumulativeR(trades: Trade[]): TrendPoint[] {
  let total = 0;
  const points: TrendPoint[] = [];
  for (const t of [...scoredTrades(trades)].sort(byTimeAsc)) {
    const r = tradeR(t);
    if (r == null) continue;
    total += r;
    points.push({ label: dayLabel(t), value: Math.round(total * 100) / 100 });
  }
  return points;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Net P&L per weekday. Mon-Fri always shown; weekends only when traded. */
export function weekdayPerformance(trades: Trade[]): WeekdayRow[] {
  const scored = scoredTrades(trades);
  return WEEKDAYS.map((day, i) => {
    const list = scored.filter((t) => parseLocalDate(tradeDate(t)).getDay() === i);
    return { day, trades: list.length, pnl: sumBy(list, (t) => toNum(t.pnl)) };
  }).filter((row, i) => (i >= 1 && i <= 5) || row.trades > 0);
}

// ---------- grouped views ----------

export function strategyBreakdown(trades: Trade[]): StrategyRow[] {
  const groups = new Map<string, Trade[]>();
  for (const t of scoredTrades(trades)) {
    const key = t.strategy?.trim() || "Unassigned";
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([strategy, list]) => {
      const s = computeStats(list);
      return {
        strategy,
        trades: s.scored,
        winRate: s.winRate,
        avgR: s.avgR,
        profitFactor: s.profitFactor,
        netPnl: s.netPnl,
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);
}

/** Scored trades with a logged emotion, grouped by emotion. */
export function emotionGroups(trades: Trade[]): EmotionRow[] {
  const withEmotion = scoredTrades(trades).filter((t) => t.emotion);
  return EMOTIONS.map((emotion) => {
    const s = computeStats(withEmotion.filter((t) => t.emotion === emotion));
    return {
      emotion,
      trades: s.scored,
      winRate: s.winRate,
      avgR: s.avgR,
      netPnl: s.netPnl,
    };
  });
}

// ---------- review workflow ----------

/** Closed trades are the ones that can be reviewed. */
export const reviewable = (trades: Trade[]): Trade[] =>
  trades.filter((t) => t.status === "closed");

export const isPending = (t: Trade) =>
  t.status === "closed" && t.review_status === "pending";

/** Pending losses and off-plan trades come first in the queue. */
export const isHighPriority = (t: Trade) =>
  isPending(t) && ((t.pnl != null && toNum(t.pnl) < 0) || t.adherence === "No");

/** Pending reviews: high priority first, then newest. */
export function reviewQueue(trades: Trade[]): Trade[] {
  return trades.filter(isPending).sort((a, b) => {
    const ha = isHighPriority(a) ? 0 : 1;
    const hb = isHighPriority(b) ? 0 : 1;
    return ha - hb || byNewest(a, b);
  });
}

// ---------- insights ----------

/**
 * Rule-based discipline hints computed from the trade data. These are prompts
 * to reflect on, not advice. Returns [] until there is enough data.
 */
export function psychologyHints(trades: Trade[]): string[] {
  const hints: string[] = [];
  const scored = [...scoredTrades(trades)].sort(byTimeAsc);
  if (scored.length < 5) return hints;
  const stats = computeStats(trades);

  let afterLoss = 0;
  let afterLossWins = 0;
  for (let i = 1; i < scored.length; i += 1) {
    if (toNum(scored[i - 1].pnl) < 0) {
      afterLoss += 1;
      if (toNum(scored[i].pnl) > 0) afterLossWins += 1;
    }
  }
  if (afterLoss >= 5 && stats.winRate != null) {
    const rate = afterLossWins / afterLoss;
    if (rate < stats.winRate - 0.1) {
      hints.push(
        `Your win rate right after a loss is ${(rate * 100).toFixed(0)}% versus ${(
          stats.winRate * 100
        ).toFixed(0)}% overall. Consider a pause before the next trade.`,
      );
    }
  }

  if (stats.avgWin != null && stats.avgLoss != null && -stats.avgLoss > stats.avgWin) {
    hints.push(
      "Your average loss is larger than your average win. Check whether stops are moved or winners are cut early.",
    );
  }

  const noStop = scored.filter((t) => t.stop_loss == null).length;
  if (noStop / scored.length >= 0.2) {
    hints.push(`${noStop} of ${scored.length} closed trades have no stop loss recorded.`);
  }

  const unreviewed = scored.filter((t) => t.review_status === "pending").length;
  if (unreviewed / scored.length >= 0.5) {
    hints.push(
      "More than half of your closed trades are still waiting for a review. Reviews are where the improvement comes from.",
    );
  }

  return hints;
}

export function insights(trades: Trade[]): Insight[] {
  const out: Insight[] = [];
  const scored = scoredTrades(trades);

  const groups = emotionGroups(trades)
    .filter((g) => g.trades >= 2 && g.avgR != null)
    .sort((a, b) => (b.avgR as number) - (a.avgR as number));
  if (groups.length > 1) {
    const best = groups[0];
    const worst = groups[groups.length - 1];
    out.push({
      icon: "✦",
      tone: "mint",
      title: `${best.emotion} trades perform best`,
      detail: `They average ${fmtR(best.avgR, 2)} across ${best.trades} trades in this range.`,
    });
    out.push({
      icon: "!",
      tone: "coral",
      title: `${worst.emotion} trades need review`,
      detail: `They average ${fmtR(worst.avgR, 2)}. Look for a repeatable trigger.`,
    });
  }

  const mistakes = scored.filter((t) => t.mistake && t.mistake !== "None");
  const counts = new Map<string, number>();
  for (const t of mistakes) counts.set(t.mistake as string, (counts.get(t.mistake as string) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) {
    out.push({
      icon: "↻",
      tone: "amber",
      title: `Most common mistake: ${top[0].toLowerCase()}`,
      detail: `Logged ${top[1]} time${top[1] === 1 ? "" : "s"}; trades with a logged mistake net ${fmtSigned(
        sumBy(mistakes, (t) => toNum(t.pnl)),
      )}. Add a pre-trade checklist item for it.`,
    });
  }

  const off = scored.filter((t) => t.adherence && t.adherence !== "Yes");
  if (off.length) {
    const on = scored.filter((t) => t.adherence === "Yes");
    out.push({
      icon: "☑",
      tone: "blue",
      title: "Plan adherence matters",
      detail: `${off.length} off-plan trade${off.length === 1 ? "" : "s"} netted ${fmtSigned(
        sumBy(off, (t) => toNum(t.pnl)),
      )}, versus ${fmtSigned(sumBy(on, (t) => toNum(t.pnl)))} on-plan.`,
    });
  }

  for (const hint of psychologyHints(trades)) {
    out.push({ icon: "◆", tone: "amber", title: "Discipline check", detail: hint });
  }

  return out;
}
