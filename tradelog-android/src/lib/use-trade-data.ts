import NetInfo from '@react-native-community/netinfo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_START_BALANCE } from '@/core/constants';
import { MemoryStore } from '@/core/offline/memory-store';
import { createSupabaseRemote, explainSyncError } from '@/core/offline/remote';
import { createSyncer } from '@/core/offline/sync';
import { buildTrade, editTrade, reviewTrade } from '@/core/offline/trades';
import type { ErrorKind, Identity, LocalStore, OutboxItem } from '@/core/offline/types';
import type { ReviewInput, Trade, TradeInput } from '@/core/types';
import { deleteUserDatabase, openUserStore } from './user-db';

export type SyncState = 'synced' | 'syncing' | 'pending' | 'offline' | 'problem';

export interface SyncProblem {
  kind: ErrorKind;
  message: string;
}

export interface TradeData {
  /** False until the local database has been read. */
  ready: boolean;
  trades: Trade[];
  /** Trades with changes that have not reached the server yet. */
  pendingIds: Set<string>;
  pendingCount: number;
  startBalance: number;
  /** False when SQLite could not be opened and data only lives in memory. */
  persistent: boolean;
  online: boolean;
  state: SyncState;
  /** True when the current sync pass has been running unusually long. */
  slow: boolean;
  lastSync: string | null;
  problem: SyncProblem | null;
  syncNow: () => Promise<void>;
  saveTrade: (input: TradeInput, existing?: Trade | null) => Promise<void>;
  removeTrade: (trade: Trade) => Promise<void>;
  restoreTrade: (trade: Trade) => Promise<void>;
  saveReview: (trade: Trade, review: ReviewInput) => Promise<void>;
  setStartBalance: (value: number) => Promise<void>;
  /** Try to push everything, then report how many changes are still unsent. */
  flushAndCountPending: () => Promise<number>;
  /** Delete this user's local data (sign-out on a shared phone). */
  wipe: () => Promise<void>;
}

interface Snapshot {
  loaded: boolean;
  trades: Trade[];
  outbox: OutboxItem[];
  startBalance: number;
  lastSync: string | null;
}

const EMPTY: Snapshot = {
  loaded: false,
  trades: [],
  outbox: [],
  startBalance: DEFAULT_START_BALANCE,
  lastSync: null,
};

const RETRY_MS = 15_000; // while changes are waiting or a sync failed
const SLOW_MS = 12_000; // a pass this long is reported as "waiting for connection"
const REFRESH_MS = 5 * 60_000; // otherwise, pull other devices' changes this often

/** True unless the phone says it has no network at all. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((s) => setOnline(s.isConnected !== false));
    return unsubscribe;
  }, []);
  return online;
}

/**
 * All of the app's trade data. Everything is read from the phone's own database,
 * so it works with no signal; changes are written there first and uploaded when
 * the network allows.
 */
export function useTradeData(client: SupabaseClient, identity: Identity): TradeData {
  const online = useOnline();
  const [store, setStore] = useState<LocalStore | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [syncing, setSyncing] = useState(false);
  const [slow, setSlow] = useState(false);
  const [syncProblem, setSyncProblem] = useState<SyncProblem | null>(null);

  const needsRetry = useRef(false);
  const lastRun = useRef(0);
  const closeDb = useRef<(() => Promise<void>) | null>(null);

  const refresh = useCallback(async (s: LocalStore) => {
    const [trades, outbox, settings, lastSync] = await Promise.all([
      s.getTrades(),
      s.getOutbox(),
      s.getSettings(),
      s.getLastSync(),
    ]);
    setSnap({
      loaded: true,
      trades,
      outbox,
      startBalance: settings?.startBalance ?? DEFAULT_START_BALANCE,
      lastSync: lastSync ?? null,
    });
  }, []);

  // 1. Open this user's database (or fall back to memory) and show what is stored.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let opened: LocalStore;
      let durable = true;
      try {
        const o = await openUserStore(identity.id);
        opened = o.store;
        closeDb.current = o.close;
      } catch {
        opened = new MemoryStore();
        durable = false;
      }
      await refresh(opened);
      if (cancelled) return;
      setPersistent(durable);
      setStore(opened);
    })();
    return () => {
      cancelled = true;
    };
  }, [identity.id, refresh]);

  // 2. Syncing
  const syncer = useMemo(
    () => (store ? createSyncer(store, createSupabaseRemote(client, identity.id)) : null),
    [store, client, identity.id],
  );

  const syncNow = useCallback(async () => {
    if (!store || !syncer) return;
    setSyncing(true);
    lastRun.current = Date.now();
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);
    const result = await syncer.sync();
    clearTimeout(slowTimer);
    setSlow(false);
    await refresh(store);
    if (result.ok) {
      needsRetry.current = false;
      setSyncProblem(null);
    } else {
      needsRetry.current = true;
      setSyncProblem({ kind: result.kind, message: explainSyncError(result.message) });
    }
    setSyncing(false);
  }, [store, syncer, refresh]);

  useEffect(() => {
    if (!syncer || !online) return;
    // Starting a pass when the network comes back is what pushes offline entries.
    void Promise.resolve().then(syncNow);

    const tick = setInterval(() => {
      const idle = Date.now() - lastRun.current;
      if ((needsRetry.current && idle >= RETRY_MS) || idle >= REFRESH_MS) void syncNow();
    }, 5_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    return () => {
      clearInterval(tick);
      sub.remove();
    };
  }, [syncer, online, syncNow]);

  // 3. Changes: write locally first (works offline), then try to sync.
  const mutate = useCallback(
    async (change: (s: LocalStore) => Promise<void>) => {
      if (!store) throw new Error('Local storage is not ready yet. Try again in a moment.');
      await change(store);
      needsRetry.current = true;
      await refresh(store);
      if (online) void syncNow();
    },
    [store, refresh, syncNow, online],
  );

  const saveTrade = useCallback(
    (input: TradeInput, existing?: Trade | null) =>
      mutate((s) => s.saveTrade(existing ? editTrade(existing, input) : buildTrade(identity.id, input))),
    [mutate, identity.id],
  );
  const removeTrade = useCallback((trade: Trade) => mutate((s) => s.removeTrade(trade.id)), [mutate]);
  const restoreTrade = useCallback((trade: Trade) => mutate((s) => s.saveTrade(trade)), [mutate]);
  const saveReview = useCallback(
    (trade: Trade, review: ReviewInput) => mutate((s) => s.saveTrade(reviewTrade(trade, review))),
    [mutate],
  );
  const setStartBalance = useCallback(
    (value: number) => mutate((s) => s.setSettings({ startBalance: value, dirty: true })),
    [mutate],
  );

  const flushAndCountPending = useCallback(async () => {
    if (!store) return 0;
    if (online) await syncNow();
    return (await store.getOutbox()).length;
  }, [store, syncNow, online]);

  const wipe = useCallback(async () => {
    await store?.destroy();
    await closeDb.current?.().catch(() => undefined);
    await deleteUserDatabase(identity.id);
  }, [store, identity.id]);

  // 4. Derived values
  const failed = snap.outbox.find((o) => o.error);
  const problem: SyncProblem | null =
    syncProblem ?? (failed?.error ? { kind: 'rejected', message: explainSyncError(failed.error) } : null);

  const state: SyncState = syncing
    ? 'syncing'
    : !online || problem?.kind === 'network'
      ? 'offline'
      : problem
        ? 'problem'
        : snap.outbox.length > 0
          ? 'pending'
          : 'synced';

  const pendingIds = useMemo(() => new Set(snap.outbox.map((o) => o.id)), [snap.outbox]);

  return {
    ready: snap.loaded,
    trades: snap.trades,
    pendingIds,
    pendingCount: snap.outbox.length,
    startBalance: snap.startBalance,
    persistent,
    online,
    state,
    slow: slow && syncing,
    lastSync: snap.lastSync,
    problem,
    syncNow,
    saveTrade,
    removeTrade,
    restoreTrade,
    saveReview,
    setStartBalance,
    flushAndCountPending,
    wipe,
  };
}
