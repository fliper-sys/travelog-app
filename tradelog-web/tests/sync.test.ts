import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryStore } from "../src/lib/offline/memory-store";
import { mergeRemote } from "../src/lib/offline/merge";
import { createSyncer, runSync } from "../src/lib/offline/sync";
import { classify } from "../src/lib/offline/remote";
import { RemoteError } from "../src/lib/offline/types";
import type { Remote } from "../src/lib/offline/types";
import type { Trade } from "../src/lib/types";
import { mk } from "./helpers";

/** A fake server. Flip `down` to simulate no internet. */
class FakeRemote implements Remote {
  rows = new Map<string, Trade>();
  settings: number | null = null;
  down: RemoteError | null = null;
  reject = new Map<string, string>(); // trade id -> rejection message
  pushLog: string[] = [];
  deleteLog: string[] = [];
  gate: Promise<void> | null = null; // pushTrade waits on this when set

  private guard() {
    if (this.down) throw this.down;
  }
  async pullTrades() {
    this.guard();
    return [...this.rows.values()].map((t) => ({ ...t }));
  }
  async pushTrade(t: Trade) {
    this.guard();
    if (this.gate) await this.gate;
    const why = this.reject.get(t.id);
    if (why) throw new RemoteError("rejected", why);
    this.pushLog.push(t.id);
    this.rows.set(t.id, { ...t });
  }
  async deleteTrade(id: string) {
    this.guard();
    this.deleteLog.push(id);
    this.rows.delete(id);
  }
  async pullSettings() {
    this.guard();
    return this.settings;
  }
  async pushSettings(v: number) {
    this.guard();
    this.settings = v;
  }
}

const offline = () => new RemoteError("network", "Failed to fetch");

describe("mergeRemote", () => {
  it("keeps a pending local trade instead of the server copy", () => {
    const local = mk({ notes: "edited offline" });
    const server = { ...local, notes: "old" };
    const m = mergeRemote([local], [{ id: local.id, op: "upsert", rev: 1 }], [server]);
    assert.deepEqual(m.put, []);
    assert.deepEqual(m.del, []);
  });

  it("takes server copies of synced trades and removes ones deleted elsewhere", () => {
    const kept = mk();
    const gone = mk();
    const fresh = mk();
    const m = mergeRemote([kept, gone], [], [{ ...kept, notes: "from phone" }, fresh]);
    assert.equal(m.put.length, 2);
    assert.deepEqual(m.del, [gone.id]);
  });

  it("does not delete a brand-new local trade that is not on the server yet", () => {
    const created = mk();
    const m = mergeRemote([created], [{ id: created.id, op: "upsert", rev: 1 }], []);
    assert.deepEqual(m.del, []);
  });

  it("does not bring back a trade deleted locally and not yet pushed", () => {
    const t = mk();
    const m = mergeRemote([], [{ id: t.id, op: "delete", rev: 1 }], [t]);
    assert.deepEqual(m.put, []);
  });
});

describe("runSync", () => {
  it("keeps offline entries safe and pushes them once the network is back", async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    const a = mk({ pnl: 100 });
    const b = mk({ pnl: -40 });
    await store.saveTrade(a);
    await store.saveTrade(b);

    remote.down = offline();
    const fail = await runSync(store, remote);
    assert.equal(fail.ok, false);
    assert.equal(fail.ok === false && fail.kind, "network");
    assert.equal((await store.getOutbox()).length, 2, "queue must survive a failed sync");
    assert.equal((await store.getTrades()).length, 2, "local data must survive a failed sync");

    remote.down = null;
    const ok = await runSync(store, remote);
    assert.deepEqual(ok, { ok: true, pushed: 2 });
    assert.equal((await store.getOutbox()).length, 0);
    assert.equal(remote.rows.size, 2);
    assert.ok(await store.getLastSync());
  });

  it("pushes the latest version when a trade was edited several times offline", async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    const t = mk({ pnl: 10 });
    await store.saveTrade(t);
    await store.saveTrade({ ...t, pnl: 20 });
    await store.saveTrade({ ...t, pnl: 30, notes: "final" });
    assert.equal((await store.getOutbox()).length, 1, "one queue item per trade");

    await runSync(store, remote);
    assert.equal(remote.pushLog.length, 1);
    assert.equal(remote.rows.get(t.id)?.pnl, 30);
    assert.equal(remote.rows.get(t.id)?.notes, "final");
  });

  it("does not drop an edit made while a push is in flight", async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    const t = mk({ pnl: 10 });
    await store.saveTrade(t);

    let open!: () => void;
    remote.gate = new Promise<void>((r) => (open = r));
    const pass = runSync(store, remote);
    await new Promise((r) => setTimeout(r, 5));
    await store.saveTrade({ ...t, pnl: 99 }); // edit during the push
    open();
    remote.gate = null;
    await pass;

    assert.equal((await store.getOutbox()).length, 1, "newer edit must still be queued");
    await runSync(store, remote);
    assert.equal(remote.rows.get(t.id)?.pnl, 99);
    assert.equal((await store.getOutbox()).length, 0);
  });

  it("pushes an offline delete and does not resurrect the trade", async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    const t = mk({ pnl: 5 });
    await store.saveTrade(t);
    await runSync(store, remote);
    assert.equal(remote.rows.size, 1);

    await store.removeTrade(t.id);
    remote.down = offline();
    await runSync(store, remote);
    assert.equal((await store.getTrades()).length, 0);

    remote.down = null;
    await runSync(store, remote);
    assert.deepEqual(remote.deleteLog, [t.id]);
    assert.equal(remote.rows.size, 0);
    assert.equal((await store.getTrades()).length, 0);
  });

  it("lets one refused trade fail without blocking the others", async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    const bad = mk({ pnl: 1 });
    const good = mk({ pnl: 2 });
    await store.saveTrade(bad);
    await store.saveTrade(good);
    remote.reject.set(bad.id, "new row violates check constraint");

    const res = await runSync(store, remote);
    assert.equal(res.ok, false);
    assert.equal(res.ok === false && res.kind, "rejected");
    assert.equal(res.ok === false && res.failed, 1);
    assert.ok(remote.rows.has(good.id));
    const left = await store.getOutbox();
    assert.equal(left.length, 1);
    assert.equal(left[0].id, bad.id);
    assert.match(left[0].error ?? "", /check constraint/);
    assert.ok((await store.getTrade(bad.id)), "refused trade must stay on this device");
  });

  it("stops on an auth failure and keeps the queue", async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    await store.saveTrade(mk());
    remote.down = new RemoteError("auth", "JWT expired");
    const res = await runSync(store, remote);
    assert.equal(res.ok === false && res.kind, "auth");
    assert.equal((await store.getOutbox()).length, 1);
  });

  it("pulls trades from other devices and removes ones deleted there", async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    const mine = mk({ pnl: 1 });
    await store.saveTrade(mine);
    await runSync(store, remote);

    const fromPhone = mk({ pnl: 7, notes: "phone" });
    remote.rows.set(fromPhone.id, fromPhone);
    remote.rows.delete(mine.id); // deleted on the phone
    await runSync(store, remote);

    const ids = (await store.getTrades()).map((t) => t.id);
    assert.deepEqual(ids, [fromPhone.id]);
  });

  it("syncs the starting balance both ways", async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    remote.settings = 5000;
    await runSync(store, remote);
    assert.equal((await store.getSettings())?.startBalance, 5000);

    await store.setSettings({ startBalance: 20000, dirty: true });
    await runSync(store, remote);
    assert.equal(remote.settings, 20000);
    assert.equal((await store.getSettings())?.dirty, false);
  });

  it("keeps an unsent starting balance when the network is down", async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    await store.setSettings({ startBalance: 777, dirty: true });
    remote.down = offline();
    await runSync(store, remote);
    assert.deepEqual(await store.getSettings(), { startBalance: 777, dirty: true });
  });
});

describe("createSyncer", () => {
  it("shares one pass between overlapping calls, then runs once more", async () => {
    const store = new MemoryStore();
    const remote = new FakeRemote();
    let pulls = 0;
    const original = remote.pullTrades.bind(remote);
    remote.pullTrades = async () => {
      pulls += 1;
      await new Promise((r) => setTimeout(r, 10));
      return original();
    };
    const syncer = createSyncer(store, remote);
    const [a, b, c] = await Promise.all([syncer.sync(), syncer.sync(), syncer.sync()]);
    assert.equal(a, b);
    assert.equal(b, c);
    assert.equal(pulls, 2, "one pass plus exactly one follow-up");
  });
});

describe("classify", () => {
  it("treats lost connections and server outages as network errors", () => {
    assert.equal(classify({ message: "TypeError: Failed to fetch", code: "" }, 0).kind, "network");
    assert.equal(classify({ message: "boom" }).kind, "network");
    assert.equal(classify({ message: "Bad gateway", code: "" }, 502).kind, "network");
  });
  it("treats expired sessions as auth errors", () => {
    assert.equal(classify({ message: "JWT expired", code: "PGRST301" }, 401).kind, "auth");
  });
  it("treats database refusals as rejected", () => {
    assert.equal(classify({ message: "violates check constraint", code: "23514" }, 400).kind, "rejected");
    assert.equal(classify({ message: "Could not find the 'timeframe' column", code: "PGRST204" }, 400).kind, "rejected");
  });
});
