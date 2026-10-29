import { DatabaseSync } from "node:sqlite";
import type { SqlDb } from "../src/lib/sqlite-store";

type Param = string | number | null;

/** Node's built-in SQLite behind the same interface expo-sqlite provides. */
export function openTestDb(): SqlDb & { raw: DatabaseSync } {
  const raw = new DatabaseSync(":memory:");
  let chain: Promise<unknown> = Promise.resolve();

  const base = {
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, params: Param[] = []) {
      return raw.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, params: Param[] = []) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: Param[] = []) {
      return (raw.prepare(sql).get(...params) as T | undefined) ?? null;
    },
  };

  const db: SqlDb & { raw: DatabaseSync } = {
    ...base,
    raw,
    // Transactions run one at a time, like expo-sqlite's exclusive transactions.
    withExclusiveTransactionAsync(task) {
      const run = chain.then(async () => {
        raw.exec("BEGIN");
        try {
          await task(db);
          raw.exec("COMMIT");
        } catch (e) {
          raw.exec("ROLLBACK");
          throw e;
        }
      });
      chain = run.catch(() => undefined);
      return run;
    },
  };
  return db;
}
