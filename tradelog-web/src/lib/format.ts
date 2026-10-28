// Change CURRENCY if your trading account is not in USD.
const CURRENCY = "USD";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const bad = (v: number | null | undefined): v is null | undefined =>
  v == null || Number.isNaN(v);

/** "-$85.00" / "$245.00" */
export function fmtMoney(value: number | null | undefined): string {
  return bad(value) ? "—" : money.format(value);
}

/** "+$245.00" / "-$85.00" */
export function fmtSigned(value: number | null | undefined): string {
  if (bad(value)) return "—";
  return `${value > 0 ? "+" : ""}${money.format(value)}`;
}

/** "+$1,235" (whole dollars, for chart axes and compact labels) */
export function fmtShort(value: number | null | undefined): string {
  if (bad(value)) return "—";
  const r = Math.round(value);
  return `${r > 0 ? "+" : ""}${moneyWhole.format(r)}`;
}

/** 0.456 -> "45.6%" */
export function fmtPercent(ratio: number | null | undefined, digits = 1): string {
  return bad(ratio) ? "—" : `${(ratio * 100).toFixed(digits)}%`;
}

export function fmtRatio(value: number | null | undefined): string {
  if (bad(value)) return "—";
  return Number.isFinite(value) ? value.toFixed(2) : "∞";
}

/** "+2.1R" */
export function fmtR(value: number | null | undefined, digits = 1): string {
  if (bad(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}R`;
}

/** A price without floating-point noise: 1.1900000000000002 -> "1.19". */
export function fmtPrice(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? String(Number(n.toFixed(6))) : "—";
}

/** CSS class for the sign of a number. */
export function tone(value: number | null | undefined): string {
  if (bad(value)) return "";
  return value > 0 ? "positive" : value < 0 ? "negative" : "";
}

// ---------- dates (all local time, "YYYY-MM-DD" strings) ----------

const pad = (n: number) => String(n).padStart(2, "0");

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO timestamp -> local "YYYY-MM-DD" ("" if invalid). */
export function localDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateKey(d);
}

export function todayLocal(): string {
  return dateKey(new Date());
}

export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** "YYYY-MM-DD" -> ISO timestamp at local noon (avoids day-boundary shifts). */
export function dateToIso(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toISOString();
}

/** "2026-10-24" -> "Oct 24" */
export function shortDate(s: string): string {
  if (!s) return "—";
  return parseLocalDate(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------- pairs ----------

/** "eurusd" / "EUR USD" -> "EUR/USD". Anything else is just upper-cased. */
export function normalizePair(input: string): string {
  const p = input.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z]{6}$/.test(p) ? `${p.slice(0, 3)}/${p.slice(3)}` : p;
}

export const fmtPair = normalizePair;
