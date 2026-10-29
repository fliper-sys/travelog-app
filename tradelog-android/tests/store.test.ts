import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryStore } from "../src/core/offline/memory-store";
import { runSync, createSyncer } from "../src/core/offline/sync";
import { RemoteError } from "../src/core/offline/types";
import type { LocalStore, Remote } from "../src/core/offline/types";
import type { Trade } from "../src/core/types";
import { SqliteStore } from "../src/lib/sqlite-store";
import { mk } from "./helpers";
import { openTestDb } from "./node-sqlite";

/** A fake server. `down` simulates no connection; `refuse` rejects chosen ids. */
function fakeRemote(initial: Trade[] = []) {
  const server = new Map(initial.map((t) => [t.id, t]));
  const state = { down: false, balance: null as number | null, refuse: new Set<string>(), calls: 0 };
  const gate = () => {
    state.calls += 1;
    if (state.down) throw new RemoteError("network", "Failed to fetch");
  };
  const remote: Remote = {
    async pullTrades() {
      gate();
      return [...server.values()];
    },
    async pushTrade(t) {
      gate();
      if (state.refuse.has(t.id)) throw new RemoteError("rejected", "check constraint failed");
      server.set(t.id, t);
    },
    async deleteTrade(id) {
      gate();
      server.delete(id);
    },
    async pullSettings() {
      gate();
      return state.balance;
    },
    async pushSettings(v) {
      gate();
      state.balance = v;
    },
  };
  return { remote, server, state };
}

const makers: [string, () => Promise<LocalStore>][] = [
  ["MemoryStore", async () => new MemoryStore()],
  ["SqliteStore", async () => SqliteStore.create(openTestDb())],
];

for (const [name, make] of makers) {
  describe(`${name}: offline-first rules`, () => {
    it("keeps offline entries safe and pushes them once the network is back", async () => {
      const store = await make();
      const { remote, server, state } = fakeRemote();
      state.down = true;

      const a = mk({ pnl: 50 });
      const b = mk({ pnl: -20 });
      await store.saveTrade(a);
      await store.saveTrade(b);

      const failed = await runSync(store, remote);
      assert.equal(failed.ok, false);
      assert.equal((await store.getTrades()).length, 2, "entries still on the phone");
      assert.equal((await store.getOutbox()).length, 2, "still queued");
      assert.equal(server.size, 0);

      state.down = false;
      const ok = await runSync(store, remote);
      assert.equal(ok.ok, true);
      assert.deepEqual([...server.keys()].sort(), [a.id, b.id].sort());
      assert.equal((await store.getOutbox()).length, 0);
      assert.ok(await store.getLastSync());
    });

    it("pushes the latest version after several offline edits (one queue item per trade)", async () => {
      const store = await make();
      const { remote, server } = fakeRemote();
      const t = mk({ pnl: 1 });
      await store.saveTrade(t);
      await store.saveTrade({ ...t, pnl: 2 });
      await store.saveTrade({ ...t, pnl: 3 });
      assert.equal((await store.getOutbox()).length, 1);
      await runSync(store, remote);
      assert.equal(server.get(t.id)?.pnl, 3);
    });

    it("does not clear a newer edit made while an older push was in flight", async () => {
      const store = await make();
      const t = mk({ pnl: 1 });
      await store.saveTrade(t);
      const [item] = await store.getOutbox();
      await store.saveTrade({ ...t, pnl: 9 }); // edited again before the push finished
      await store.clearOutbox(item.id, item.rev); // the old push reports success
      const left = await store.getOutbox();
      assert.equal(left.length, 1, "newer edit must stay queued");
      assert.equal((await store.getTrade(t.id))?.pnl, 9);
    });

    it("pushes an offline delete and does not bring the trade back", async () => {
      const t = mk({ pnl: 5 });
      const store = await make();
      const { remote, server } = fakeRemote([t]);
      await runSync(store, remote);
      assert.equal((await store.getTrades()).length, 1);

      await store.removeTrade(t.id);
      assert.equal((await store.getTrades()).length, 0);
      // A pull before the delete is pushed must not resurrect it.
      await store.applyRemote([t]);
      assert.equal((await store.getTrades()).length, 0);

      await runSync(store, remote);
      assert.equal(server.size, 0);
      assert.equal((await store.getTrades()).length, 0);
    });

    it("lets one refused trade fail without blocking the others", async () => {
      const store = await make();
      const { remote, server, state } = fakeRemote();
      const bad = mk();
      const good = mk();
      state.refuse.add(bad.id);
      await store.saveTrade(bad);
      await store.saveTrade(good);

      const result = await runSync(store, remote);
      assert.equal(result.ok, false);
      assert.equal(result.ok === false && result.kind, "rejected");
      assert.ok(server.has(good.id));
      const [left] = await store.getOutbox();
      assert.equal(left.id, bad.id);
      assert.match(left.error ?? "", /check constraint/);
    });

    it("keeps pending local changes over the server copy, and takes other devices' changes", async () => {
      const mine = mk({ pnl: 10 });
      const theirs = mk({ pnl: 20 });
      const store = await make();
      await store.saveTrade(mine); // pending
      await store.applyRemote([{ ...mine, pnl: 999 }, theirs]);
      assert.equal((await store.getTrade(mine.id))?.pnl, 10);
      assert.equal((await store.getTrade(theirs.id))?.pnl, 20);

      // The other device deleted `theirs`.
      await store.applyRemote([{ ...mine, pnl: 999 }]);
      assert.equal(await store.getTrade(theirs.id), undefined);
    });

    it("syncs the starting balance both ways and keeps an unsent one while offline", async () => {
      const store = await make();
      const { remote, state } = fakeRemote();
      state.balance = 5000;
      await runSync(store, remote);
      assert.deepEqual(await store.getSettings(), { startBalance: 5000, dirty: false });

      state.down = true;
      await store.setSettings({ startBalance: 7000, dirty: true });
      await runSync(store, remote);
      assert.deepEqual(await store.getSettings(), { startBalance: 7000, dirty: true });

      state.down = false;
      await runSync(store, remote);
      assert.equal(state.balance, 7000);
      assert.equal((await store.getSettings())?.dirty, false);
    });

    it("destroy removes everything for the user", async () => {
      const store = await make();
      await store.saveTrade(mk());
      await store.setSettings({ startBalance: 1, dirty: true });
      await store.setLastSync("2026-01-01T00:00:00.000Z");
      await store.destroy();
      assert.equal((await store.getTrades()).length, 0);
      assert.equal((await store.getOutbox()).length, 0);
      assert.equal(await store.getSettings(), undefined);
      assert.equal(await store.getLastSync(), undefined);
    });

    it("one syncer shares a pass between overlapping calls", async () => {
      const store = await make();
      const { remote, state } = fakeRemote();
      const syncer = createSyncer(store, remote);
      const first = syncer.sync();
      const second = syncer.sync();
      await Promise.all([first, second]);
      assert.ok(state.calls > 0);
    });
  });
}

describe("SqliteStore specifics", () => {
  it("survives being reopened on the same database", async () => {
    const db = openTestDb();
    const t = mk({ pnl: 12 });
    await (await SqliteStore.create(db)).saveTrade(t);
    const again = await SqliteStore.create(db); // creating tables twice is harmless
    assert.equal((await again.getTrade(t.id))?.pnl, 12);
    assert.equal((await again.getOutbox()).length, 1);
  });

  it("rolls the trade back if queueing it fails (all or nothing)", async () => {
    const db = openTestDb();
    const store = await SqliteStore.create(db);
    db.raw.exec("DROP TABLE outbox");
    await assert.rejects(store.saveTrade(mk()));
    assert.equal((await db.getAllAsync("SELECT id FROM trades")).length, 0);
  });

  it("round-trips every trade field exactly", async () => {
    const store = await SqliteStore.create(openTestDb());
    const t = mk({
      pnl: -85.5,
      r_multiple: -1.25,
      notes: "emoji ✅ and 'quotes' and \"double\"",
      emotion: "Greedy",
      review_status: "reviewed",
      confidence: 4,
      lesson: "wait",
    });
    await store.saveTrade(t);
    assert.deepEqual(await store.getTrade(t.id), t);
  });
});
