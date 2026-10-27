"use client";

import { useState, type FormEvent } from "react";
import type { Direction, Trade, TradeInput, TradeStatus } from "@/lib/types";
import { fromLocalInput, toLocalInput } from "@/lib/format";

const MAJOR_PAIRS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "XAUUSD",
];

interface Props {
  initial: Trade | null;
  onCancel: () => void;
  /** Resolves to an error message, or null on success. */
  onSave: (input: TradeInput) => Promise<string | null>;
}

const str = (v: number | string | null | undefined) =>
  v == null ? "" : String(v);

/** Empty -> null, valid number -> number, anything else -> NaN. */
function parseOptional(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export default function TradeForm({ initial, onCancel, onSave }: Props) {
  const [pair, setPair] = useState(initial?.pair ?? "");
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? "Buy");
  const [status, setStatus] = useState<TradeStatus>(initial?.status ?? "closed");
  const [entry, setEntry] = useState(str(initial?.entry_price));
  const [exit, setExit] = useState(str(initial?.exit_price));
  const [stopLoss, setStopLoss] = useState(str(initial?.stop_loss));
  const [takeProfit, setTakeProfit] = useState(str(initial?.take_profit));
  const [lot, setLot] = useState(str(initial?.lot_size));
  const [pnl, setPnl] = useState(str(initial?.pnl));
  const [risk, setRisk] = useState(str(initial?.risk_amount));
  const [strategy, setStrategy] = useState(initial?.strategy ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [openedAt, setOpenedAt] = useState(
    toLocalInput(initial?.opened_at ?? new Date().toISOString()),
  );
  const [closedAt, setClosedAt] = useState(toLocalInput(initial?.closed_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const entryN = parseOptional(entry);
    const exitN = parseOptional(exit);
    const slN = parseOptional(stopLoss);
    const tpN = parseOptional(takeProfit);
    const lotN = parseOptional(lot);
    const pnlN = parseOptional(pnl);
    const riskN = parseOptional(risk);

    const numbers = [entryN, exitN, slN, tpN, lotN, pnlN, riskN];
    if (numbers.some((n) => n != null && Number.isNaN(n))) {
      setError("One of the number fields is not a valid number.");
      return;
    }
    if (!pair.trim()) return setError("Pair is required.");
    if (entryN == null || entryN <= 0) return setError("Entry price must be greater than 0.");
    if (exitN != null && exitN <= 0) return setError("Exit price must be greater than 0.");
    if (lotN != null && lotN <= 0) return setError("Lot size must be greater than 0.");
    if (riskN != null && riskN < 0) return setError("Risk amount cannot be negative.");
    if (status === "closed" && pnlN == null) {
      return setError("Enter the P&L for a closed trade (net of fees).");
    }

    const input: TradeInput = {
      pair: pair.trim().toUpperCase(),
      direction,
      status,
      entry_price: entryN,
      exit_price: exitN,
      stop_loss: slN,
      take_profit: tpN,
      lot_size: lotN,
      pnl: pnlN,
      risk_amount: riskN,
      strategy: strategy.trim() || null,
      notes: notes.trim() || null,
      opened_at: fromLocalInput(openedAt) ?? new Date().toISOString(),
      closed_at:
        status === "closed"
          ? (fromLocalInput(closedAt) ?? new Date().toISOString())
          : null,
    };

    setBusy(true);
    const message = await onSave(input);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={onSubmit}>
        <h2>{initial ? "Edit trade" : "Add trade"}</h2>
        {error && <div className="alert">{error}</div>}

        <div className="form-grid">
          <label className="field">
            <span>Pair</span>
            <input
              className="input"
              list="pairs"
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              placeholder="EURUSD"
              required
            />
            <datalist id="pairs">
              {MAJOR_PAIRS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Direction</span>
            <select
              className="input"
              value={direction}
              onChange={(e) => setDirection(e.target.value as Direction)}
            >
              <option>Buy</option>
              <option>Sell</option>
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as TradeStatus)}
            >
              <option value="closed">Closed</option>
              <option value="open">Open</option>
            </select>
          </label>

          <label className="field">
            <span>Entry price</span>
            <input className="input" inputMode="decimal" value={entry} onChange={(e) => setEntry(e.target.value)} />
          </label>
          <label className="field">
            <span>Exit price</span>
            <input className="input" inputMode="decimal" value={exit} onChange={(e) => setExit(e.target.value)} />
          </label>
          <label className="field">
            <span>Lot size</span>
            <input className="input" inputMode="decimal" value={lot} onChange={(e) => setLot(e.target.value)} />
          </label>

          <label className="field">
            <span>Stop loss</span>
            <input className="input" inputMode="decimal" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
          </label>
          <label className="field">
            <span>Take profit</span>
            <input className="input" inputMode="decimal" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} />
          </label>
          <label className="field">
            <span>Risk amount</span>
            <input className="input" inputMode="decimal" value={risk} onChange={(e) => setRisk(e.target.value)} placeholder="e.g. 50" />
          </label>

          <label className="field">
            <span>P&amp;L (net of fees){status === "closed" ? " *" : ""}</span>
            <input className="input" inputMode="decimal" value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="-25.50" />
          </label>
          <label className="field span-2">
            <span>Strategy</span>
            <input className="input" value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder="Breakout, London open, …" />
          </label>

          <label className="field">
            <span>Opened</span>
            <input className="input" type="datetime-local" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} />
          </label>
          {status === "closed" && (
            <label className="field">
              <span>Closed</span>
              <input className="input" type="datetime-local" value={closedAt} onChange={(e) => setClosedAt(e.target.value)} />
            </label>
          )}

          <label className="field span-3">
            <span>Notes / review: what happened, what did you learn?</span>
            <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Add trade"}
          </button>
        </div>
      </form>
    </div>
  );
}
