import type { Trade } from "../types";
import type { OutboxItem } from "./types";

export interface MergeResult {
  put: Trade[];
  del: string[];
}

let lastRev = 0;

/** Strictly increasing number, even for changes made in the same millisecond. */
export function nextRev(): number {
  lastRev = Math.max(Date.now(), lastRev + 1);
  return lastRev;
}

/**
 * Decide how the server's trades change local data.
 *
 * - A trade with a pending local change is never touched: the local version
 *   wins until it has been pushed.
 * - Every other server trade replaces the local copy.
 * - A local trade the server no longer has (and that has no pending change)
 *   was deleted elsewhere, so it is removed here too.
 */
export function mergeRemote(
  local: Trade[],
  outbox: OutboxItem[],
  remote: Trade[],
): MergeResult {
  const pending = new Set(outbox.map((o) => o.id));
  const remoteIds = new Set(remote.map((t) => t.id));
  return {
    put: remote.filter((t) => !pending.has(t.id)),
    del: local.filter((t) => !remoteIds.has(t.id) && !pending.has(t.id)).map((t) => t.id),
  };
}
