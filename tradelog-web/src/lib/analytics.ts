import type { Trade } from "./types";

/**
 * Metric definitions (kept deliberately simple and documented in the README):
 *
 * - Only CLOSED trades that have a P&L value are "scored". Open trades and
 *   closed trades with a missing P&L are ignored by every metric.
 * - Win = P&L > 0, loss = P&L < 0, breakeven = P&L === 0. Breakeven trades
 *   count toward the trade total (so they lower the win rate) but are neither
 *   a win nor a loss.
 * - P&L is taken as entered. Fees/commission are not modelled separately;
 *   enter P&L net of fees.
 * - Win rate = wins / scored trades.
 * - Profit factor = gross profit / gross loss (∞ if there are profits and no
 *   losses, null if there is nothing to compare).
 * - R multiple = P&L / risk_amount, for scored trades with risk_amount > 0.
 *   Average R is the mean of those.
 */

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
  avgLoss: number | null; // positive magnitude
  grossProfit: number;
  grossLoss: number; // positive magnitude
}

export interface EquityPoint {
  label: string;
  equity: number;
  pnl: number;
}

export interface StrategyRow {
  strategy: string;
  trades: number;
  winRate: number | null;
  netPnl: number;
}

const toNum = (v: unknown): number => Number(v);

export function tradeTime(t: Trade): number {
  return new Date(t.closed_at ?? t.opened_at).getTime();
}

export function scoredTrades(trades: Trade[]): Trade[] {
  return trades.filter((t) => t.status === "closed" && t.pnl != null);
}

export function rMultiple(t: Trade): number | null {
  if (t.pnl == null || t.risk_amount == null) return null;
  const risk = toNum(t.risk_amount);
  if (!(risk > 0)) return null;
  return toNum(t.pnl) / risk;
}

export function computeStats(trades: Trade[]): Stats {
  const scored = scoredTrades(trades);
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

  const rs = scored
    .map(rMultiple)
    .filter((r): r is number => r != null && Number.isFinite(r));

  let profitFactor: number | null = null;
  if (grossLoss > 0) profitFactor = grossProfit / grossLoss;
  else if (grossProfit > 0) profitFactor = Infinity;

  return {
    scored: scored.length,
    netPnl: grossProfit - grossLoss,
    wins,
    losses,
    breakeven,
    winRate: scored.length ? wins / scored.length : null,
    profitFactor,
    avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    avgWin: wins ? grossProfit / wins : null,
    avgLoss: losses ? grossLoss / losses : null,
    grossProfit,
    grossLoss,
  };
}

/** Cumulative P&L over scored trades in chronological order. */
export function equityCurve(trades: Trade[]): EquityPoint[] {
  const ordered = [...scoredTrades(trades)].sort(
    (a, b) => tradeTime(a) - tradeTime(b),
  );
  let equity = 0;
  return ordered.map((t) => {
    const pnl = toNum(t.pnl);
    equity += pnl;
    return {
      label: new Date(tradeTime(t)).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
      }),
      equity: Math.round(equity * 100) / 100,
      pnl,
    };
  });
}

export function strategyBreakdown(trades: Trade[]): StrategyRow[] {
  const groups = new Map<string, Trade[]>();
  for (const t of scoredTrades(trades)) {
    const key = t.strategy?.trim() || "Unassigned";
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return [...groups.entries()]
    .map(([strategy, rows]) => {
      const s = computeStats(rows);
      return {
        strategy,
        trades: s.scored,
        winRate: s.winRate,
        netPnl: s.netPnl,
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl);
}

/**
 * Closed trades that still need a written review (no notes). Losing trades
 * come first because they usually teach the most; then newest first.
 */
export function reviewQueue(trades: Trade[]): Trade[] {
  return trades
    .filter((t) => t.status === "closed" && !t.notes?.trim())
    .sort((a, b) => {
      const aLoss = a.pnl != null && toNum(a.pnl) < 0 ? 0 : 1;
      const bLoss = b.pnl != null && toNum(b.pnl) < 0 ? 0 : 1;
      if (aLoss !== bLoss) return aLoss - bLoss;
      return tradeTime(b) - tradeTime(a);
    });
}

/**
 * Rule-based psychology / discipline hints computed from the trade data.
 * These are prompts to reflect on, not advice. Returns [] until there is
 * enough data to say anything meaningful.
 */
export function psychologyHints(trades: Trade[]): string[] {
  const hints: string[] = [];
  const scored = [...scoredTrades(trades)].sort(
    (a, b) => tradeTime(a) - tradeTime(b),
  );
  if (scored.length < 5) return hints;

  const stats = computeStats(trades);

  // Do results dip right after a loss?
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

  // Losers bigger than winners?
  if (stats.avgWin != null && stats.avgLoss != null && stats.avgLoss > stats.avgWin) {
    hints.push(
      "Your average loss is larger than your average win. Check whether stops are moved or winners are cut early.",
    );
  }

  // Trading without a stop loss
  const noStop = scored.filter((t) => t.stop_loss == null).length;
  if (noStop / scored.length >= 0.2) {
    hints.push(
      `${noStop} of ${scored.length} scored trades have no stop loss recorded.`,
    );
  }

  // Not enough reviews
  const unreviewed = scored.filter((t) => !t.notes?.trim()).length;
  if (unreviewed / scored.length >= 0.5) {
    hints.push(
      "More than half of your closed trades have no notes. Reviews are where the improvement comes from.",
    );
  }

  return hints;
}
