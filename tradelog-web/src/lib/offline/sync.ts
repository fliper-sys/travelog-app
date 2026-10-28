import { RemoteError } from "./types";
import type { ErrorKind, LocalStore, Remote, SyncResult } from "./types";

const toRemoteError = (e: unknown): RemoteError =>
  e instanceof RemoteError
    ? e
    : new RemoteError("network", e instanceof Error ? e.message : String(e));

/**
 * One sync pass:
 *  1. push every queued change, oldest first
 *  2. pull the server's trades and merge them in (pending changes win)
 *  3. sync the starting balance
 *
 * Network and auth failures stop the pass (nothing is lost: the queue stays).
 * A change the server refuses is remembered on its queue item and the pass
 * moves on, so one bad row cannot block the rest.
 */
export async function runSync(store: LocalStore, remote: Remote): Promise<SyncResult> {
  const queue = (await store.getOutbox()).sort((a, b) => a.rev - b.rev);
  let pushed = 0;
  let failed = 0;
  let firstRejection: string | null = null;

  for (const item of queue) {
    try {
      if (item.op === "delete") {
        await remote.deleteTrade(item.id);
      } else {
        const trade = await store.getTrade(item.id);
        if (trade) await remote.pushTrade(trade);
      }
      await store.clearOutbox(item.id, item.rev);
      pushed += 1;
    } catch (e) {
      const err = toRemoteError(e);
      if (err.kind !== "rejected") {
        return { ok: false, kind: err.kind, message: err.message, failed: queue.length - pushed };
      }
      failed += 1;
      firstRejection ??= err.message;
      await store.markFailed(item.id, item.rev, err.message);
    }
  }

  try {
    await store.applyRemote(await remote.pullTrades());
  } catch (e) {
    const err = toRemoteError(e);
    return { ok: false, kind: err.kind, message: err.message, failed: failed || queue.length - pushed };
  }

  await syncSettings(store, remote);

  if (failed > 0) {
    return { ok: false, kind: "rejected", message: firstRejection ?? "Rejected by the server", failed };
  }
  await store.setLastSync(new Date().toISOString());
  return { ok: true, pushed };
}

/** The starting balance is a convenience, so its failures never fail the sync. */
async function syncSettings(store: LocalStore, remote: Remote): Promise<void> {
  try {
    const local = await store.getSettings();
    if (local?.dirty) {
      await remote.pushSettings(local.startBalance);
      const now = await store.getSettings();
      // Only mark clean if it was not edited again while we were pushing.
      if (now && now.startBalance === local.startBalance) {
        await store.setSettings({ ...now, dirty: false });
      }
    } else {
      const server = await remote.pullSettings();
      if (server != null) await store.setSettings({ startBalance: server, dirty: false });
    }
  } catch {
    // Keep the local value; it is retried on the next pass.
  }
}

/**
 * Wraps runSync so overlapping calls share one pass. A call made while a pass
 * is running triggers exactly one more pass afterwards, so changes made
 * mid-sync are not left waiting.
 */
export function createSyncer(store: LocalStore, remote: Remote) {
  let running: Promise<SyncResult> | null = null;
  let again = false;

  function sync(): Promise<SyncResult> {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      let result: SyncResult;
      do {
        again = false;
        result = await runSync(store, remote);
      } while (again && result.ok);
      return result;
    })().finally(() => {
      running = null;
    });
    return running;
  }

  return { sync };
}

export type { ErrorKind };
