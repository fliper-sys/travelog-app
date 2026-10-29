// GENERATED COPY of tradelog-web/src/lib. Do not edit here.
// Change the web file, then run: npm run sync-core
import type { Trade } from "./types";
import { fmtPair, localDate } from "./format";
import { byNewest } from "./analytics";

type Column = { header: string; value: (t: Trade) => unknown; text?: boolean };

const COLUMNS: Column[] = [
  { header: "date", value: (t) => localDate(t.closed_at ?? t.opened_at) },
  { header: "pair", value: (t) => fmtPair(t.pair), text: true },
  { header: "direction", value: (t) => t.direction },
  { header: "strategy", value: (t) => t.strategy, text: true },
  { header: "timeframe", value: (t) => t.timeframe },
  { header: "entry", value: (t) => t.entry_price },
  { header: "exit", value: (t) => t.exit_price },
  { header: "stop_loss", value: (t) => t.stop_loss },
  { header: "take_profit", value: (t) => t.take_profit },
  { header: "lot_size", value: (t) => t.lot_size },
  { header: "pnl", value: (t) => t.pnl },
  { header: "r_multiple", value: (t) => t.r_multiple },
  { header: "trade_status", value: (t) => t.status },
  { header: "review_status", value: (t) => t.review_status },
  { header: "emotion", value: (t) => t.emotion },
  { header: "plan_adherence", value: (t) => t.adherence },
  { header: "confidence", value: (t) => t.confidence },
  { header: "mistake", value: (t) => t.mistake, text: true },
  { header: "lesson", value: (t) => t.lesson, text: true },
  { header: "notes", value: (t) => t.notes, text: true },
];

/** Quote a cell; neutralise spreadsheet formulas in free-text columns. */
function cell(value: unknown, text: boolean | undefined): string {
  let v = value == null ? "" : String(value);
  if (text && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function tradesToCsv(trades: Trade[]): string {
  // oldest first, so the file reads like a journal
  const rows = [...trades].sort((a, b) => byNewest(b, a));
  return [
    COLUMNS.map((c) => c.header).join(","),
    ...rows.map((t) => COLUMNS.map((c) => cell(c.value(t), c.text)).join(",")),
  ].join("\n");
}

/** Triggers a browser download of the CSV text. */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
