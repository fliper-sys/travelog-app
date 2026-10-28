import type { Trade } from "../types";

/**
 * A change waiting to be pushed to Supabase. There is at most one item per
 * trade: later edits replace earlier ones (the trade itself is read from the
 * local store at push time, so the newest version is what gets sent).
 */
export interface OutboxItem {
  id: string; // trade id
  op: "upsert" | "delete";
  /** Increases on every local change; used to avoid clearing a newer edit. */
  rev: number;
  /** Last rejection message from the server, if a push was refused. */
  error?: string;
}

export interface Identity {
  id: string;
  email: string;
}

export interface Settings {
  startBalance: number;
  /** True when the local value has not reached the server yet. */
  dirty: boolean;
}

/**
 * Everything the app needs from local storage. Two implementations exist:
 * IndexedDB (real) and an in-memory one (fallback and tests).
 */
export interface LocalStore {
  getTrades(): Promise<Trade[]>;
  getTrade(id: string): Promise<Trade | undefined>;
  getOutbox(): Promise<OutboxItem[]>;

  /** Atomically save a trade and queue it for upload. */
  saveTrade(trade: Trade): Promise<void>;
  /** Atomically remove a trade and queue the delete for upload. */
  removeTrade(id: string): Promise<void>;

  /** Drop a pushed item, unless the trade changed again since (rev differs). */
  clearOutbox(id: string, rev: number): Promise<void>;
  /** Remember why a push was refused, unless the trade changed since. */
  markFailed(id: string, rev: number, message: string): Promise<void>;

  /** Merge the server's trades into local data without touching pending changes. */
  applyRemote(remote: Trade[]): Promise<void>;

  getSettings(): Promise<Settings | undefined>;
  setSettings(settings: Settings): Promise<void>;
  getLastSync(): Promise<string | undefined>;
  setLastSync(iso: string): Promise<void>;

  /** Delete everything stored for this user. */
  destroy(): Promise<void>;
}

export type ErrorKind = "network" | "auth" | "rejected";

/** What a push or pull against the server can fail with. */
export class RemoteError extends Error {
  kind: ErrorKind;
  constructor(kind: ErrorKind, message: string) {
    super(message);
    this.name = "RemoteError";
    this.kind = kind;
  }
}

/** The server side of syncing. The Supabase version lives in remote.ts. */
export interface Remote {
  pullTrades(): Promise<Trade[]>;
  pushTrade(trade: Trade): Promise<void>;
  deleteTrade(id: string): Promise<void>;
  /** null when the user has no settings row yet. */
  pullSettings(): Promise<number | null>;
  pushSettings(startBalance: number): Promise<void>;
}

export type SyncResult =
  | { ok: true; pushed: number }
  | { ok: false; kind: ErrorKind; message: string; failed: number };
