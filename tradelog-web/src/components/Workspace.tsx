"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { filterRange, reviewQueue, type RangeKey } from "@/lib/analytics";
import { todayLocal } from "@/lib/format";
import type { Identity } from "@/lib/offline/types";
import { useTradeData } from "@/lib/offline/useTradeData";
import { NAV, PAGES, RANGED_PAGES, isPageId, type PageId } from "@/lib/pages";
import type { ReviewInput, Trade, TradeInput } from "@/lib/types";
import ReviewForm from "./ReviewForm";
import SyncStatus from "./SyncStatus";
import TradeForm from "./TradeForm";
import AnalyticsPage from "./pages/AnalyticsPage";
import CalendarPage from "./pages/CalendarPage";
import JournalPage from "./pages/JournalPage";
import OverviewPage from "./pages/OverviewPage";
import PsychologyPage from "./pages/PsychologyPage";
import ReviewsPage from "./pages/ReviewsPage";
import SettingsPage from "./pages/SettingsPage";
import StrategiesPage from "./pages/StrategiesPage";
import { RANGE_LABEL, type PageProps } from "./pages/shared";

interface Props {
  client: SupabaseClient;
  identity: Identity;
  /** Called after this user's local data has been removed. */
  onSignedOut: () => void;
  /** Sign in again without deleting local data (session expired). */
  onReauth: () => void;
}

interface ToastState {
  message: string;
  action?: { label: string; run: () => void };
}

const subscribeHash = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export default function Workspace({ client, identity, onSignedOut, onReauth }: Props) {
  const data = useTradeData(client, identity);

  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.slice(1),
    () => "",
  );
  const page: PageId = isPageId(hash) ? hash : "dashboard";
  const navigate = useCallback((id: PageId) => {
    window.location.hash = id;
  }, []);

  const [range, setRange] = useState<RangeKey>("30");
  const [tradeForm, setTradeForm] = useState<{ trade: Trade | null } | null>(null);
  const [reviewing, setReviewing] = useState<Trade | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const showToast = useCallback((message: string, action?: ToastState["action"]) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, action });
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 3500);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // New page: set the title, move focus to the content, scroll to the top.
  useEffect(() => {
    document.title = `${PAGES[page].title} · TRADELOG`;
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [page]);

  const today = todayLocal();
  const ranged = useMemo(() => filterRange(data.trades, range, today), [data.trades, range, today]);
  const waiting = useMemo(() => reviewQueue(data.trades).length, [data.trades]);
  const knownStrategies = useMemo(
    () => [...new Set(data.trades.map((t) => t.strategy?.trim()).filter((s): s is string => !!s))],
    [data.trades],
  );

  // ---------- actions ----------
  async function saveTrade(input: TradeInput): Promise<string | null> {
    const editing = tradeForm?.trade ?? null;
    try {
      await data.saveTrade(input, editing);
    } catch (e) {
      return errorText(e, "Could not save this trade.");
    }
    setTradeForm(null);
    showToast(
      editing
        ? "Trade updated."
        : data.online
          ? "Trade saved."
          : "Trade saved on this device. It will upload when you are back online.",
    );
    if (!editing) navigate("journal");
    return null;
  }

  async function saveReview(review: ReviewInput): Promise<string | null> {
    if (!reviewing) return null;
    try {
      await data.saveReview(reviewing, review);
    } catch (e) {
      return errorText(e, "Could not save this review.");
    }
    setReviewing(null);
    showToast("Review saved. Nice work.");
    return null;
  }

  async function deleteTrade(trade: Trade) {
    try {
      await data.removeTrade(trade);
    } catch (e) {
      showToast(errorText(e, "Could not delete this trade."));
      return;
    }
    showToast("Trade deleted.", {
      label: "Undo",
      run: () => void data.restoreTrade(trade).catch(() => showToast("Could not restore the trade.")),
    });
  }

  async function signOut() {
    const left = await data.flushAndCountPending();
    const lines: string[] = [];
    if (left > 0) {
      lines.push(
        `${left} change${left === 1 ? " has" : "s have"} not reached the server and will be lost if you sign out.`,
      );
    }
    if (!data.online) lines.push("You are offline, so you will not be able to sign back in until you are online again.");
    lines.push("Signing out removes your trades from this device (they stay on the server). Sign out?");
    if (!window.confirm(lines.join("\n\n"))) return;
    await data.wipe();
    onSignedOut();
  }

  // ---------- page ----------
  const pageProps: PageProps = {
    trades: data.trades,
    ranged,
    range,
    setRange,
    startBalance: data.startBalance,
    pendingIds: data.pendingIds,
    navigate,
    onAdd: () => setTradeForm({ trade: null }),
    onReview: (t) => setReviewing(t),
    onEdit: (t) => setTradeForm({ trade: t }),
    onDelete: (t) => void deleteTrade(t),
    toast: showToast,
  };

  function renderPage() {
    switch (page) {
      case "journal":
        return <JournalPage {...pageProps} />;
      case "reviews":
        return <ReviewsPage {...pageProps} />;
      case "analytics":
        return <AnalyticsPage {...pageProps} />;
      case "strategies":
        return <StrategiesPage {...pageProps} />;
      case "psychology":
        return <PsychologyPage {...pageProps} />;
      case "calendar":
        return <CalendarPage {...pageProps} />;
      case "settings":
        return <SettingsPage data={data} identity={identity} onSignOut={() => void signOut()} toast={showToast} />;
      default:
        return <OverviewPage {...pageProps} />;
    }
  }

  const failedCount = data.problem?.kind === "rejected" ? data.pendingCount : 0;

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="app">
        <aside className="sidebar" aria-label="Primary">
          <div className="brand">
            <span className="logo" aria-hidden="true">
              ▥
            </span>{" "}
            TRADELOG
          </div>
          <div className="nav-label">WORKSPACE</div>
          <nav className="nav">
            {NAV.filter((n) => n.id !== "settings").map((n) => (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                aria-current={page === n.id ? "page" : undefined}
                onClick={() => navigate(n.id)}
              >
                <span className="ico" aria-hidden="true">
                  {n.icon}
                </span>{" "}
                {n.label}
                {n.id === "reviews" && <span className="badge">{waiting || ""}</span>}
              </button>
            ))}
            <div className="nav-label">PREFERENCES</div>
            <button
              className={page === "settings" ? "active" : ""}
              aria-current={page === "settings" ? "page" : undefined}
              onClick={() => navigate("settings")}
            >
              <span className="ico" aria-hidden="true">
                ⚙
              </span>{" "}
              Settings
            </button>
          </nav>
          <div className="side-bottom">
            <div className="email" title={identity.email}>
              {identity.email || "Signed in"}
            </div>
            <div style={{ margin: "8px 0 10px" }}>
              <SyncStatus data={data} />
            </div>
            <button className="btn ghost sm" style={{ width: "100%" }} onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </aside>

        <main className="main" id="main" tabIndex={-1} ref={mainRef}>
          <header className="topbar">
            <div>
              <div className="eyebrow">Forex performance workspace</div>
              <h1 className="h1">{PAGES[page].title}</h1>
              <div className="sub">{PAGES[page].sub}</div>
            </div>
            <div className="top-actions">
              <span className="topbar-sync">
                <SyncStatus data={data} />
              </span>
              {RANGED_PAGES.includes(page) && (
                <>
                  <label className="sr" htmlFor="range">
                    Date range
                  </label>
                  <select
                    id="range"
                    className="select"
                    value={range}
                    onChange={(e) => setRange(e.target.value as RangeKey)}
                  >
                    {(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
                      <option key={k} value={k}>
                        {RANGE_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <button className="btn primary" onClick={() => setTradeForm({ trade: null })}>
                ＋ Add trade
              </button>
            </div>
          </header>

          {!data.persistent && (
            <div className="banner">
              Offline storage is unavailable in this browser window (private browsing?). Your trades are kept in
              memory only and will be lost when you close it. Use a normal window to keep data offline.
            </div>
          )}

          {data.problem?.kind === "auth" && (
            <div className="banner error" role="alert">
              Your session has expired, so changes cannot upload. Everything is still saved on this device.
              <button className="btn sm" onClick={onReauth}>
                Sign in again
              </button>
            </div>
          )}

          {data.problem?.kind === "rejected" && (
            <div className="banner error" role="alert">
              {failedCount > 0 ? `${failedCount} change${failedCount === 1 ? "" : "s"} could not be saved to the server: ` : "Sync problem: "}
              {data.problem.message}
              <button className="btn sm" onClick={() => void data.syncNow()}>
                Retry
              </button>
            </div>
          )}

          {!data.ready ? <div className="empty">Loading your journal…</div> : renderPage()}
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Primary mobile">
        {NAV.map((n) => (
          <button
            key={n.id}
            className={page === n.id ? "active" : ""}
            aria-current={page === n.id ? "page" : undefined}
            onClick={() => navigate(n.id)}
          >
            <b aria-hidden="true">{n.icon}</b>
            {n.short}
            {n.id === "reviews" && <span className="badge">{waiting || ""}</span>}
          </button>
        ))}
      </nav>

      {tradeForm && (
        <TradeForm
          key={tradeForm.trade?.id ?? "new"}
          initial={tradeForm.trade}
          knownStrategies={knownStrategies}
          onCancel={() => setTradeForm(null)}
          onSave={saveTrade}
        />
      )}
      {reviewing && (
        <ReviewForm key={reviewing.id} trade={reviewing} onCancel={() => setReviewing(null)} onSave={saveReview} />
      )}

      <div className="toast-host" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <span>{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.run();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
