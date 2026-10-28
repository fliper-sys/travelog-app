import type { Trade } from "../types";
import { mergeRemote, nextRev } from "./merge";
import type { LocalStore, OutboxItem, Settings } from "./types";

/**
 * In-memory LocalStore. Used when IndexedDB is unavailable (some private
 * browsing modes) and by the tests. Nothing survives a page reload.
 */
export class MemoryStore implements LocalStore {
  private trades = new Map<string, Trade>();
  private outbox = new Map<string, OutboxItem>();
  private settings: Settings | undefined;
  private lastSync: string | undefined;

  async getTrades() {
    return [...this.trades.values()];
  }
  async getTrade(id: string) {
    return this.trades.get(id);
  }
  async getOutbox() {
    return [...this.outbox.values()];
  }

  async saveTrade(trade: Trade) {
    this.trades.set(trade.id, trade);
    this.outbox.set(trade.id, { id: trade.id, op: "upsert", rev: nextRev() });
  }
  async removeTrade(id: string) {
    this.trades.delete(id);
    this.outbox.set(id, { id, op: "delete", rev: nextRev() });
  }

  async clearOutbox(id: string, rev: number) {
    if (this.outbox.get(id)?.rev === rev) this.outbox.delete(id);
  }
  async markFailed(id: string, rev: number, message: string) {
    const item = this.outbox.get(id);
    if (item && item.rev === rev) this.outbox.set(id, { ...item, error: message });
  }

  async applyRemote(remote: Trade[]) {
    const { put, del } = mergeRemote([...this.trades.values()], [...this.outbox.values()], remote);
    for (const t of put) this.trades.set(t.id, t);
    for (const id of del) this.trades.delete(id);
  }

  async getSettings() {
    return this.settings;
  }
  async setSettings(settings: Settings) {
    this.settings = settings;
  }
  async getLastSync() {
    return this.lastSync;
  }
  async setLastSync(iso: string) {
    this.lastSync = iso;
  }

  async destroy() {
    this.trades.clear();
    this.outbox.clear();
    this.settings = undefined;
    this.lastSync = undefined;
  }
}
