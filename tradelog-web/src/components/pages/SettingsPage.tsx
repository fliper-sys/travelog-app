"use client";

import { useState, type FormEvent } from "react";
import { downloadCsv, tradesToCsv } from "@/lib/csv";
import type { Identity } from "@/lib/offline/types";
import type { TradeData } from "@/lib/offline/useTradeData";
import { fmtMoney } from "@/lib/format";
import { useOfflineReady } from "../ServiceWorker";
import SyncStatus, { timeAgo } from "../SyncStatus";

interface Props {
  data: TradeData;
  identity: Identity;
  onSignOut: () => void;
  toast: (message: string) => void;
}

export default function SettingsPage({ data, identity, onSignOut, toast }: Props) {
  const offlineReady = useOfflineReady();
  const [balance, setBalance] = useState(String(data.startBalance));
  const [error, setError] = useState<string | null>(null);

  async function saveBalance(e: FormEvent) {
    e.preventDefault();
    const n = Number(balance);
    if (!balance.trim() || !Number.isFinite(n) || n <= 0) {
      setError("Enter an amount above 0.");
      return;
    }
    setError(null);
    try {
      await data.setStartBalance(n);
      toast("Starting balance updated.");
    } catch {
      setError("Could not save. Try again.");
    }
  }

  function exportCsv() {
    downloadCsv("tradelog-trades.csv", tradesToCsv(data.trades));
    toast(`Exported ${data.trades.length} trade${data.trades.length === 1 ? "" : "s"}.`);
  }

  const initials = identity.email.slice(0, 2).toUpperCase() || "TL";

  return (
    <>
      <div className="card">
        <div className="profile">
          <div className="avatar" aria-hidden="true">
            {initials}
          </div>
          <div>
            <div className="strong" style={{ fontSize: 17 }}>
              {identity.email || "Signed in"}
            </div>
            <div className="sub">Personal workspace</div>
          </div>
          <span className={`tag ${offlineReady ? "" : "warn"}`} style={{ marginLeft: "auto" }}>
            {offlineReady ? "OFFLINE READY" : "ONLINE ONLY"}
          </span>
        </div>
      </div>

      <div className="card gap">
        <h2 style={{ marginBottom: 12 }}>Account</h2>
        <form onSubmit={saveBalance} noValidate>
          <div className={`field${error ? " invalid" : ""}`} style={{ maxWidth: 300 }}>
            <label htmlFor="start-balance">Starting balance ($)</label>
            <div className="inline-form">
              <input
                id="start-balance"
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                aria-describedby="start-balance-note"
                aria-invalid={error ? true : undefined}
                style={{ flex: 1, minWidth: 120 }}
              />
              <button className="btn" type="submit">
                Save
              </button>
            </div>
            {error ? (
              <span className="err" id="start-balance-note" role="alert">
                {error}
              </span>
            ) : (
              <span className="hint" id="start-balance-note">
                Used to calculate return % on the equity curve. Currently {fmtMoney(data.startBalance)}.
              </span>
            )}
          </div>
        </form>
      </div>

      <div className="card gap">
        <div className="section-head">
          <h2>Sync &amp; offline storage</h2>
          <SyncStatus data={data} />
        </div>
        <dl className="kv">
          <dt>Status</dt>
          <dd>
            {data.state === "offline"
              ? "You are offline. Everything you add is saved on this device."
              : data.state === "problem"
                ? "Some changes could not be saved to the server."
                : data.pendingCount > 0
                  ? "Changes are waiting to upload."
                  : "Everything on this device is on the server."}
          </dd>
          <dt>Last synced</dt>
          <dd>{timeAgo(data.lastSync)}</dd>
          <dt>Waiting to upload</dt>
          <dd>
            {data.pendingCount} change{data.pendingCount === 1 ? "" : "s"}
          </dd>
          <dt>Trades on this device</dt>
          <dd>{data.trades.length}</dd>
          <dt>Offline storage</dt>
          <dd>
            {data.persistent
              ? "Saved in this browser (survives closing the app)."
              : "Unavailable in this window. Changes are kept in memory only and are lost when you close it."}
          </dd>
          <dt>App available offline</dt>
          <dd>
            {offlineReady
              ? "Yes. The app opens without internet."
              : "Not yet. Open the app once online, then reload it. (Not active while running npm run dev.)"}
          </dd>
        </dl>
        <button className="btn" onClick={() => void data.syncNow()} disabled={!data.online || data.state === "syncing"}>
          {data.state === "syncing" ? "Syncing…" : "Sync now"}
        </button>
      </div>

      <div className="card gap">
        <h2 style={{ marginBottom: 12 }}>Your data</h2>
        <p className="sub" style={{ marginTop: 0 }}>
          Download every trade as a CSV file. This works offline too.
        </p>
        <button className="btn" onClick={exportCsv} disabled={data.trades.length === 0}>
          ⇩ Export CSV
        </button>
      </div>

      <div className="card gap">
        <h2 style={{ marginBottom: 12 }}>Sign out</h2>
        <p className="sub" style={{ marginTop: 0 }}>
          Signing out removes your trades from this device (they stay safe on the server). Unsynced changes
          would be lost, so connect and sync first if you can.
        </p>
        <button className="btn danger" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </>
  );
}
