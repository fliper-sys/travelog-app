import type { Trade } from '@/core/types';
import { mergeRemote, nextRev } from '@/core/offline/merge';
import type { LocalStore, OutboxItem, Settings } from '@/core/offline/types';

type Param = string | number | null;

/**
 * The few database calls the store needs. expo-sqlite's database satisfies it,
 * and the tests satisfy it with Node's built-in SQLite, so this file has no
 * dependency on Expo.
 */
export interface SqlDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: Param[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: Param[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: Param[]): Promise<T | null>;
  /** Run `task` as one all-or-nothing transaction. */
  withExclusiveTransactionAsync(task: (txn: SqlDb) => Promise<void>): Promise<void>;
}

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS trades (
    id   TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS outbox (
    id    TEXT PRIMARY KEY NOT NULL,
    op    TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
    rev   INTEGER NOT NULL,
    error TEXT
  );
  CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`;

interface OutboxRow {
  id: string;
  op: 'upsert' | 'delete';
  rev: number;
  error: string | null;
}

const toItem = (r: OutboxRow): OutboxItem => ({
  id: r.id,
  op: r.op,
  rev: Number(r.rev),
  ...(r.error ? { error: r.error } : {}),
});

const putTrade = (db: SqlDb, t: Trade) =>
  db.runAsync(
    'INSERT INTO trades (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
    [t.id, JSON.stringify(t)],
  );

/**
 * LocalStore on SQLite. Same rules as the web app's IndexedDB store: saving a
 * trade and queueing it for upload happen in one transaction, and there is at
 * most one queue item per trade.
 */
export class SqliteStore implements LocalStore {
  constructor(private readonly db: SqlDb) {}

  /** Create the tables if needed and return a ready store. */
  static async create(db: SqlDb): Promise<SqliteStore> {
    await db.execAsync(SCHEMA);
    return new SqliteStore(db);
  }

  async getTrades(): Promise<Trade[]> {
    const rows = await this.db.getAllAsync<{ data: string }>('SELECT data FROM trades');
    return rows.map((r) => JSON.parse(r.data) as Trade);
  }

  async getTrade(id: string): Promise<Trade | undefined> {
    const row = await this.db.getFirstAsync<{ data: string }>('SELECT data FROM trades WHERE id = ?', [id]);
    return row ? (JSON.parse(row.data) as Trade) : undefined;
  }

  async getOutbox(): Promise<OutboxItem[]> {
    const rows = await this.db.getAllAsync<OutboxRow>('SELECT id, op, rev, error FROM outbox');
    return rows.map(toItem);
  }

  async saveTrade(trade: Trade): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await putTrade(tx, trade);
      await tx.runAsync(
        `INSERT INTO outbox (id, op, rev, error) VALUES (?, 'upsert', ?, NULL)
         ON CONFLICT(id) DO UPDATE SET op = 'upsert', rev = excluded.rev, error = NULL`,
        [trade.id, nextRev()],
      );
    });
  }

  async removeTrade(id: string): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM trades WHERE id = ?', [id]);
      await tx.runAsync(
        `INSERT INTO outbox (id, op, rev, error) VALUES (?, 'delete', ?, NULL)
         ON CONFLICT(id) DO UPDATE SET op = 'delete', rev = excluded.rev, error = NULL`,
        [id, nextRev()],
      );
    });
  }

  async clearOutbox(id: string, rev: number): Promise<void> {
    await this.db.runAsync('DELETE FROM outbox WHERE id = ? AND rev = ?', [id, rev]);
  }

  async markFailed(id: string, rev: number, message: string): Promise<void> {
    await this.db.runAsync('UPDATE outbox SET error = ? WHERE id = ? AND rev = ?', [message, id, rev]);
  }

  async applyRemote(remote: Trade[]): Promise<void> {
    // Read and write inside one transaction so a change made on this device
    // while the pull was running cannot be overwritten.
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      const localRows = await tx.getAllAsync<{ data: string }>('SELECT data FROM trades');
      const outRows = await tx.getAllAsync<OutboxRow>('SELECT id, op, rev, error FROM outbox');
      const { put, del } = mergeRemote(
        localRows.map((r) => JSON.parse(r.data) as Trade),
        outRows.map(toItem),
        remote,
      );
      for (const t of put) await putTrade(tx, t);
      for (const id of del) await tx.runAsync('DELETE FROM trades WHERE id = ?', [id]);
    });
  }

  private async getMeta(key: string): Promise<string | undefined> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]);
    return row?.value;
  }

  private async setMeta(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }

  async getSettings(): Promise<Settings | undefined> {
    const raw = await this.getMeta('settings');
    return raw ? (JSON.parse(raw) as Settings) : undefined;
  }

  async setSettings(settings: Settings): Promise<void> {
    await this.setMeta('settings', JSON.stringify(settings));
  }

  getLastSync(): Promise<string | undefined> {
    return this.getMeta('lastSync');
  }

  async setLastSync(iso: string): Promise<void> {
    await this.setMeta('lastSync', iso);
  }

  async destroy(): Promise<void> {
    await this.db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync('DELETE FROM trades');
      await tx.runAsync('DELETE FROM outbox');
      await tx.runAsync('DELETE FROM meta');
    });
  }
}
