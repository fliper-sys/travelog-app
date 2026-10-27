"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type { Trade, TradeInput } from "@/lib/types";
import {
  computeStats,
  equityCurve,
  psychologyHints,
  rMultiple,
  reviewQueue,
  strategyBreakdown,
} from "@/lib/analytics";
import {
  fmtDate,
  fmtPercent,
  fmtR,
  fmtRatio,
  fmtSigned,
} from "@/lib/format";
import EquityChart from "./EquityChart";
import TradeForm from "./TradeForm";

async function fetchTrades(client: SupabaseClient) {
  const { data, error } = await client
    .from("trades")
    .select("*")
    .order("opened_at", { ascending: false });
  return { trades: (data ?? []) as Trade[], error: error?.message ?? null };
}

const byOpenedDesc = (a: Trade, b: Trade) =>
  new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime();

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg";
}) {
  return (
    <div className="card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${tone ?? ""}`}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard({
  client,
  session,
}: {
  client: SupabaseClient;
  session: Session;
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTrades(client).then((res) => {
      if (cancelled) return;
      setTrades(res.trades);
      setError(res.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const stats = useMemo(() => computeStats(trades), [trades]);
  const curve = useMemo(() => equityCurve(trades), [trades]);
  const strategies = useMemo(() => strategyBreakdown(trades), [trades]);
  const queue = useMemo(() => reviewQueue(trades), [trades]);
  const hints = useMemo(() => psychologyHints(trades), [trades]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trades;
    return trades.filter((t) =>
      [t.pair, t.strategy, t.notes, t.direction, t.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [trades, query]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(trade: Trade) {
    setEditing(trade);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function saveTrade(input: TradeInput): Promise<string | null> {
    if (editing) {
      const { data, error: err } = await client
        .from("trades")
        .update(input)
        .eq("id", editing.id)
        .select()
        .single();
      if (err) return err.message;
      setTrades((prev) =>
        prev.map((t) => (t.id === editing.id ? (data as Trade) : t)).sort(byOpenedDesc),
      );
    } else {
      const { data, error: err } = await client
        .from("trades")
        .insert(input)
        .select()
        .single();
      if (err) return err.message;
      setTrades((prev) => [data as Trade, ...prev].sort(byOpenedDesc));
    }
    setError(null);
    closeForm();
    return null;
  }

  async function deleteTrade(trade: Trade) {
    if (!window.confirm(`Delete this ${trade.pair} trade? This cannot be undone.`)) {
      return;
    }
    const { error: err } = await client.from("trades").delete().eq("id", trade.id);
    if (err) {
      setError(err.message);
      return;
    }
    setError(null);
    setTrades((prev) => prev.filter((t) => t.id !== trade.id));
  }

  const net = stats.netPnl;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          TRADELOG
        </div>
        <div className="topbar-right">
          <span className="muted small">{session.user.email}</span>
          <button className="btn ghost" onClick={() => client.auth.signOut()}>
            Sign out
          </button>
          <button className="btn primary" onClick={openAdd}>
            + Add trade
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      <section className="kpis">
        <StatCard
          label="Net P&L"
          value={stats.scored ? fmtSigned(net) : "—"}
          tone={stats.scored ? (net >= 0 ? "pos" : "neg") : undefined}
          sub={`${stats.scored} closed trade${stats.scored === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Win rate"
          value={fmtPercent(stats.winRate)}
          sub={`${stats.wins}W · ${stats.losses}L · ${stats.breakeven}BE`}
        />
        <StatCard
          label="Profit factor"
          value={fmtRatio(stats.profitFactor)}
          sub="Gross profit ÷ gross loss"
        />
        <StatCard
          label="Average R"
          value={fmtR(stats.avgR)}
          sub="Needs a risk amount on trades"
          tone={stats.avgR == null ? undefined : stats.avgR >= 0 ? "pos" : "neg"}
        />
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Equity curve</h2>
          <EquityChart data={curve} />
        </div>

        <div className="card">
          <h2>Trade review queue</h2>
          {queue.length === 0 ? (
            <div className="empty">
              {trades.length === 0
                ? "No trades yet."
                : "Every closed trade has notes. Nice work."}
            </div>
          ) : (
            <ul className="list">
              {queue.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <span>
                    <strong>{t.pair}</strong>{" "}
                    <span className="muted small">{fmtDate(t.closed_at ?? t.opened_at)}</span>
                    <br />
                    <span className={`small ${Number(t.pnl) < 0 ? "neg" : "pos"}`}>
                      {fmtSigned(t.pnl == null ? null : Number(t.pnl))}
                    </span>
                  </span>
                  <button className="btn tiny" onClick={() => openEdit(t)}>
                    Review
                  </button>
                </li>
              ))}
            </ul>
          )}
          {queue.length > 6 && (
            <div className="muted small" style={{ marginTop: 10 }}>
              +{queue.length - 6} more waiting for review
            </div>
          )}
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <div className="card-head">
            <h2>Recent trades</h2>
            <input
              className="input search"
              placeholder="Search pair, strategy, notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="empty">Loading trades…</div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              {trades.length === 0
                ? "No trades yet. Click “Add trade” to log your first one."
                : "No trades match your search."}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Pair</th>
                    <th>Side</th>
                    <th>Status</th>
                    <th className="num">Entry</th>
                    <th className="num">Exit</th>
                    <th className="num">P&amp;L</th>
                    <th className="num">R</th>
                    <th>Strategy</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 50).map((t) => {
                    const pnl = t.pnl == null ? null : Number(t.pnl);
                    return (
                      <tr key={t.id}>
                        <td className="muted">{fmtDate(t.opened_at)}</td>
                        <td>
                          <strong>{t.pair}</strong>
                        </td>
                        <td>
                          <span className={`badge ${t.direction === "Buy" ? "buy" : "sell"}`}>
                            {t.direction}
                          </span>
                        </td>
                        <td>
                          {t.status === "open" ? (
                            <span className="badge open">Open</span>
                          ) : (
                            <span className="muted">Closed</span>
                          )}
                        </td>
                        <td className="num mono">{Number(t.entry_price)}</td>
                        <td className="num mono">
                          {t.exit_price == null ? "—" : Number(t.exit_price)}
                        </td>
                        <td className={`num mono ${pnl == null ? "" : pnl >= 0 ? "pos" : "neg"}`}>
                          {fmtSigned(pnl)}
                        </td>
                        <td className="num mono">{fmtR(rMultiple(t))}</td>
                        <td className="muted">{t.strategy || "—"}</td>
                        <td>
                          <div className="row-actions">
                            <button className="btn tiny" onClick={() => openEdit(t)}>
                              Edit
                            </button>
                            <button className="btn tiny danger" onClick={() => deleteTrade(t)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length > 50 && (
                <div className="muted small" style={{ marginTop: 10 }}>
                  Showing the 50 most recent of {filtered.length} trades. Use search to narrow down.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card">
            <h2>Strategy analytics</h2>
            {strategies.length === 0 ? (
              <div className="empty">Close a few trades to compare strategies.</div>
            ) : (
              <ul className="list">
                {strategies.map((s) => (
                  <li key={s.strategy}>
                    <span>
                      <strong>{s.strategy}</strong>
                      <br />
                      <span className="muted small">
                        {s.trades} trade{s.trades === 1 ? "" : "s"} · {fmtPercent(s.winRate)} win
                      </span>
                    </span>
                    <span className={`mono ${s.netPnl >= 0 ? "pos" : "neg"}`}>
                      {fmtSigned(s.netPnl)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2>Psychology hints</h2>
            {hints.length === 0 ? (
              <div className="empty">
                Hints appear once you have at least 5 closed trades with P&amp;L.
              </div>
            ) : (
              <div className="list">
                {hints.map((h) => (
                  <span key={h} className="hint">
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {formOpen && (
        <TradeForm
          key={editing?.id ?? "new"}
          initial={editing}
          onCancel={closeForm}
          onSave={saveTrade}
        />
      )}
    </div>
  );
}
