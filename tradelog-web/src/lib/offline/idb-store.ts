import type { Trade } from "../types";
import { mergeRemote, nextRev } from "./merge";
import type { LocalStore, OutboxItem, Settings } from "./types";

const DB_VERSION = 1;
export const dbName = (userId: string) => `tradelog-${userId}`;

function open(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("trades", { keyPath: "id" });
      db.createObjectStore("outbox", { keyPath: "id" });
      db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("IndexedDB open was blocked"));
  });
}

const wrap = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const finished = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });

/** LocalStore backed by IndexedDB, one database per user. */
export class IdbStore implements LocalStore {
  private constructor(
    private db: IDBDatabase,
    private name: string,
  ) {
    // If another tab upgrades or deletes the database, let it proceed.
    db.onversionchange = () => db.close();
  }

  /** Rejects when IndexedDB is missing or blocked; callers fall back to memory. */
  static async create(userId: string): Promise<IdbStore> {
    if (typeof indexedDB === "undefined") throw new Error("IndexedDB is not available");
    const name = dbName(userId);
    return new IdbStore(await open(name), name);
  }

  async getTrades() {
    return wrap(this.db.transaction("trades").objectStore("trades").getAll() as IDBRequest<Trade[]>);
  }
  async getTrade(id: string) {
    return wrap(this.db.transaction("trades").objectStore("trades").get(id) as IDBRequest<Trade | undefined>);
  }
  async getOutbox() {
    return wrap(this.db.transaction("outbox").objectStore("outbox").getAll() as IDBRequest<OutboxItem[]>);
  }

  async saveTrade(trade: Trade) {
    const tx = this.db.transaction(["trades", "outbox"], "readwrite");
    tx.objectStore("trades").put(trade);
    tx.objectStore("outbox").put({ id: trade.id, op: "upsert", rev: nextRev() } satisfies OutboxItem);
    await finished(tx);
  }

  async removeTrade(id: string) {
    const tx = this.db.transaction(["trades", "outbox"], "readwrite");
    tx.objectStore("trades").delete(id);
    tx.objectStore("outbox").put({ id, op: "delete", rev: nextRev() } satisfies OutboxItem);
    await finished(tx);
  }

  async clearOutbox(id: string, rev: number) {
    const tx = this.db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result as OutboxItem | undefined;
      if (item && item.rev === rev) store.delete(id);
    };
    await finished(tx);
  }

  async markFailed(id: string, rev: number, message: string) {
    const tx = this.db.transaction("outbox", "readwrite");
    const store = tx.objectStore("outbox");
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result as OutboxItem | undefined;
      if (item && item.rev === rev) store.put({ ...item, error: message });
    };
    await finished(tx);
  }

  /** One transaction: read local data and the outbox, merge, write. */
  async applyRemote(remote: Trade[]) {
    const tx = this.db.transaction(["trades", "outbox"], "readwrite");
    const trades = tx.objectStore("trades");
    const localReq = trades.getAll() as IDBRequest<Trade[]>;
    const outboxReq = tx.objectStore("outbox").getAll() as IDBRequest<OutboxItem[]>;

    let waiting = 2;
    const merge = () => {
      waiting -= 1;
      if (waiting > 0) return;
      const { put, del } = mergeRemote(localReq.result, outboxReq.result, remote);
      for (const t of put) trades.put(t);
      for (const id of del) trades.delete(id);
    };
    localReq.onsuccess = merge;
    outboxReq.onsuccess = merge;
    await finished(tx);
  }

  private async getMeta<T>(key: string): Promise<T | undefined> {
    return wrap(this.db.transaction("meta").objectStore("meta").get(key) as IDBRequest<T | undefined>);
  }
  private async setMeta(key: string, value: unknown) {
    const tx = this.db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(value, key);
    await finished(tx);
  }

  getSettings() {
    return this.getMeta<Settings>("settings");
  }
  setSettings(settings: Settings) {
    return this.setMeta("settings", settings);
  }
  getLastSync() {
    return this.getMeta<string>("lastSync");
  }
  setLastSync(iso: string) {
    return this.setMeta("lastSync", iso);
  }

  async destroy() {
    this.db.close();
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(this.name);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  }
}

/** Remove a user's local database without having it open (used on sign-out). */
export async function deleteUserDatabase(userId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(dbName(userId));
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
