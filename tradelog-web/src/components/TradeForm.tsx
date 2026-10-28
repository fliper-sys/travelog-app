"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import type { Direction, Trade, TradeInput, TradeStatus } from "@/lib/types";
import { DEFAULT_STRATEGIES, PAIRS, TIMEFRAMES } from "@/lib/constants";
import { calcR, tradeDate } from "@/lib/analytics";
import { dateToIso, fmtPair, fmtR, normalizePair, todayLocal } from "@/lib/format";
import Modal from "./Modal";

type FieldKey = "pair" | "date" | "entry" | "exit" | "stop" | "target" | "lot" | "pnl" | "r";
type Errors = Partial<Record<FieldKey, string>>;

const FIELD_ORDER: FieldKey[] = [
  "pair",
  "date",
  "entry",
  "exit",
  "stop",
  "target",
  "pnl",
  "r",
  "lot",
];

interface Props {
  initial: Trade | null;
  /** Strategies already used, offered as suggestions next to the defaults. */
  knownStrategies: string[];
  onCancel: () => void;
  /** Resolves to an error message, or null on success. */
  onSave: (input: TradeInput) => Promise<string | null>;
}

const str = (v: number | null | undefined) => (v == null ? "" : String(v));

/** "" -> null, a number -> number, anything else -> NaN. */
function parse(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

const isNum = (n: number | null): n is number => n != null && !Number.isNaN(n);

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field${error ? " invalid" : ""}`}>
      <label htmlFor={id}>
        {label}
        {required && <span className="req"> *</span>}
      </label>
      {children}
      {error ? (
        <span className="err" id={`${id}-note`} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="hint" id={`${id}-note`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Dates: keep the original timestamps when the trade date is unchanged. */
function buildDates(date: string, status: TradeStatus, initial: Trade | null) {
  const unchanged = initial != null && tradeDate(initial) === date;
  const opened = unchanged ? initial.opened_at : dateToIso(date);
  const closed =
    status === "closed"
      ? unchanged && initial.closed_at
        ? initial.closed_at
        : dateToIso(date)
      : null;
  return { opened, closed };
}

export default function TradeForm({ initial, knownStrategies, onCancel, onSave }: Props) {
  const [pair, setPair] = useState(initial ? fmtPair(initial.pair) : "");
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? "Buy");
  const [status, setStatus] = useState<TradeStatus>(initial?.status ?? "closed");
  const [strategy, setStrategy] = useState(initial?.strategy ?? "");
  const [timeframe, setTimeframe] = useState(initial?.timeframe ?? "1H");
  const [date, setDate] = useState(() => (initial ? tradeDate(initial) : todayLocal()));
  const [entry, setEntry] = useState(str(initial?.entry_price));
  const [exit, setExit] = useState(str(initial?.exit_price));
  const [stop, setStop] = useState(str(initial?.stop_loss));
  const [target, setTarget] = useState(str(initial?.take_profit));
  const [lot, setLot] = useState(str(initial?.lot_size));
  const [pnl, setPnl] = useState(str(initial?.pnl));
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // R multiple: auto-calculated unless the user types their own value.
  const initialAuto = initial
    ? calcR(
        initial.direction,
        Number(initial.entry_price),
        initial.exit_price == null ? null : Number(initial.exit_price),
        initial.stop_loss == null ? null : Number(initial.stop_loss),
      )
    : null;
  const [rInput, setRInput] = useState(str(initial?.r_multiple));
  const [rManual, setRManual] = useState(
    initial?.r_multiple != null &&
      (initialAuto == null || Math.abs(initialAuto - Number(initial.r_multiple)) > 0.005),
  );

  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ---- derived values ----
  const entryN = parse(entry);
  const exitN = parse(exit);
  const stopN = parse(stop);
  const targetN = parse(target);
  const pnlN = parse(pnl);

  const autoR = isNum(entryN)
    ? calcR(direction, entryN, isNum(exitN) ? exitN : null, isNum(stopN) ? stopN : null)
    : null;
  const rShown = rManual ? rInput : autoR != null ? String(autoR) : "";
  const rValue = parse(rShown);

  const riskReward =
    isNum(entryN) && isNum(stopN) && isNum(targetN) && entryN !== stopN
      ? Math.abs(targetN - entryN) / Math.abs(entryN - stopN)
      : null;

  const warnings: string[] = [];
  if (isNum(entryN) && isNum(stopN)) {
    if (direction === "Buy" && stopN >= entryN) warnings.push("For a Buy, the stop loss is normally below entry.");
    if (direction === "Sell" && stopN <= entryN) warnings.push("For a Sell, the stop loss is normally above entry.");
  }
  if (isNum(entryN) && isNum(targetN)) {
    if (direction === "Buy" && targetN <= entryN) warnings.push("For a Buy, the take profit is normally above entry.");
    if (direction === "Sell" && targetN >= entryN) warnings.push("For a Sell, the take profit is normally below entry.");
  }
  if (isNum(pnlN) && isNum(rValue) && pnlN !== 0 && rValue !== 0 && pnlN > 0 !== rValue > 0) {
    warnings.push("P&L and R multiple have opposite signs. Check both.");
  }

  const strategyOptions = [...new Set([...DEFAULT_STRATEGIES, ...knownStrategies])];

  function validate(): Errors {
    const e: Errors = {};
    const p = normalizePair(pair);
    if (!p) e.pair = "Choose or type a pair.";
    else if (!/^[A-Z0-9/]{3,12}$/.test(p)) e.pair = "Use a pair like EUR/USD.";
    if (!date) e.date = "Pick the trade date.";

    if (entry.trim() === "") e.entry = "Entry price is required.";
    else if (!isNum(entryN) || entryN <= 0) e.entry = "Enter a number above 0.";

    if (exit.trim() !== "" && (!isNum(exitN) || exitN <= 0)) e.exit = "Enter a number above 0.";
    if (stop.trim() !== "" && (!isNum(stopN) || stopN <= 0)) e.stop = "Enter a number above 0.";
    if (target.trim() !== "" && (!isNum(targetN) || targetN <= 0)) e.target = "Enter a number above 0.";
    if (lot.trim() !== "" && (!isNum(parse(lot)) || (parse(lot) as number) <= 0)) {
      e.lot = "Enter a number above 0.";
    }

    if (status === "closed" && pnl.trim() === "") e.pnl = "Enter the net P&L (after fees).";
    else if (pnl.trim() !== "" && !isNum(pnlN)) e.pnl = "Enter a number, like 245 or -85.";

    if (rManual && rInput.trim() !== "" && !isNum(parse(rInput))) e.r = "Enter a number, like 1.5 or -1.";
    return e;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitError(null);

    const found = validate();
    setErrors(found);
    const firstBad = FIELD_ORDER.find((k) => found[k]);
    if (firstBad) {
      document.getElementById(`tf-${firstBad}`)?.focus();
      return;
    }

    const dates = buildDates(date, status, initial);
    const input: TradeInput = {
      pair: normalizePair(pair),
      direction,
      status,
      entry_price: entryN as number,
      exit_price: isNum(exitN) ? exitN : null,
      stop_loss: isNum(stopN) ? stopN : null,
      take_profit: isNum(targetN) ? targetN : null,
      lot_size: isNum(parse(lot)) ? (parse(lot) as number) : null,
      pnl: isNum(pnlN) ? pnlN : null,
      r_multiple: isNum(rValue) ? rValue : null,
      strategy: strategy.trim() || null,
      timeframe,
      notes: notes.trim() || null,
      opened_at: dates.opened,
      closed_at: dates.closed,
    };

    setBusy(true);
    const message = await onSave(input);
    setBusy(false);
    if (message) setSubmitError(message);
  }

  const describe = (id: FieldKey) => ({
    id: `tf-${id}`,
    "aria-invalid": errors[id] ? (true as const) : undefined,
    "aria-describedby": `tf-${id}-note`,
  });

  return (
    <Modal title={initial ? "Edit trade" : "Add a trade"} onClose={onCancel} initialFocus="#tf-pair">
      <form onSubmit={onSubmit} noValidate>
        {submitError && (
          <div className="alert" role="alert">
            {submitError}
          </div>
        )}

        <div className="formgrid">
          <Field id="tf-pair" label="Currency pair" required error={errors.pair}>
            <input
              {...describe("pair")}
              list="tf-pairs"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              onBlur={() => setPair(normalizePair(pair))}
              placeholder="EUR/USD"
              autoComplete="off"
            />
            <datalist id="tf-pairs">
              {PAIRS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </Field>

          <div className="field">
            <span className="label" id="tf-direction-label">
              Direction
            </span>
            <div className="seg" role="group" aria-labelledby="tf-direction-label">
              <button type="button" aria-pressed={direction === "Buy"} onClick={() => setDirection("Buy")}>
                BUY
              </button>
              <button
                type="button"
                className="sell"
                aria-pressed={direction === "Sell"}
                onClick={() => setDirection("Sell")}
              >
                SELL
              </button>
            </div>
          </div>

          <Field id="tf-strategy" label="Strategy" hint="Pick one or type a new one.">
            <input
              id="tf-strategy"
              list="tf-strategies"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder="Breakout"
              autoComplete="off"
              aria-describedby="tf-strategy-note"
            />
            <datalist id="tf-strategies">
              {strategyOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>

          <Field id="tf-timeframe" label="Timeframe">
            <select id="tf-timeframe" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
              {TIMEFRAMES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>

          <Field id="tf-date" label="Trade date" required error={errors.date}>
            <input {...describe("date")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <div className="field">
            <span className="label" id="tf-status-label">
              Trade status
            </span>
            <div className="seg" role="group" aria-labelledby="tf-status-label">
              <button type="button" aria-pressed={status === "closed"} onClick={() => setStatus("closed")}>
                Closed
              </button>
              <button type="button" aria-pressed={status === "open"} onClick={() => setStatus("open")}>
                Open
              </button>
            </div>
          </div>

          <div className="form-section">Prices</div>

          <Field id="tf-entry" label="Entry price" required error={errors.entry}>
            <input {...describe("entry")} inputMode="decimal" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="1.08250" />
          </Field>
          <Field id="tf-exit" label="Exit price" error={errors.exit}>
            <input {...describe("exit")} inputMode="decimal" value={exit} onChange={(e) => setExit(e.target.value)} placeholder="1.08620" />
          </Field>
          <Field id="tf-stop" label="Stop loss" error={errors.stop}>
            <input {...describe("stop")} inputMode="decimal" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="1.07900" />
          </Field>
          <Field id="tf-target" label="Take profit" error={errors.target}>
            <input {...describe("target")} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="1.09000" />
          </Field>

          <div className="form-section">Result</div>

          <Field
            id="tf-pnl"
            label="Net P&L ($)"
            required={status === "closed"}
            error={errors.pnl}
            hint="After fees and commission."
          >
            <input {...describe("pnl")} inputMode="decimal" value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="245" />
          </Field>
          <Field
            id="tf-r"
            label="R multiple"
            error={errors.r}
            hint={
              rManual
                ? "Your own value. Clear it to calculate automatically."
                : autoR != null
                  ? `Calculated from entry, stop and exit: ${fmtR(autoR, 2)}`
                  : "Add stop loss and exit price to calculate it, or type your own."
            }
          >
            <input
              {...describe("r")}
              inputMode="decimal"
              value={rShown}
              onChange={(e) => {
                setRInput(e.target.value);
                setRManual(e.target.value.trim() !== "");
              }}
              placeholder="Auto"
            />
          </Field>
          <Field id="tf-lot" label="Lot size" error={errors.lot}>
            <input {...describe("lot")} inputMode="decimal" value={lot} onChange={(e) => setLot(e.target.value)} placeholder="0.50" />
          </Field>
          <div className="field">
            <span className="label">Risk : reward (planned)</span>
            <div className="readout">
              {riskReward != null ? `1 : ${riskReward.toFixed(2)}` : "Add entry, stop and target"}
            </div>
          </div>

          <Field id="tf-notes" label="Notes / setup context">
            <textarea
              id="tf-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why did you take this trade?"
            />
          </Field>
        </div>

        {warnings.length > 0 && (
          <ul className="warnings" aria-label="Things to double-check">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Save trade"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
