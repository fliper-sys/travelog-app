import * as SQLite from 'expo-sqlite';

import type { LocalStore } from '@/core/offline/types';
import { SqliteStore, type SqlDb } from './sqlite-store';

/** One database file per signed-in user, so accounts never mix on a shared phone. */
export const dbName = (userId: string) => `tradelog-${userId}.db`;

export interface OpenedStore {
  store: LocalStore;
  /** Release the file so it can be deleted. */
  close: () => Promise<void>;
}

type Expo = Pick<
  SQLite.SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync' | 'withExclusiveTransactionAsync'
>;

/** Present expo-sqlite through the small interface the store is written against. */
function adapt(db: Expo): SqlDb {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: (sql, params = []) => db.runAsync(sql, params),
    getAllAsync: (sql, params = []) => db.getAllAsync(sql, params),
    getFirstAsync: (sql, params = []) => db.getFirstAsync(sql, params),
    withExclusiveTransactionAsync: (task) =>
      db.withExclusiveTransactionAsync((txn) => task(adapt(txn))),
  };
}

export async function openUserStore(userId: string): Promise<OpenedStore> {
  const db = await SQLite.openDatabaseAsync(dbName(userId));
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const store = await SqliteStore.create(adapt(db));
  return { store, close: () => db.closeAsync() };
}

export async function deleteUserDatabase(userId: string): Promise<void> {
  try {
    await SQLite.deleteDatabaseAsync(dbName(userId));
  } catch {
    // Already gone, or never created.
  }
}
