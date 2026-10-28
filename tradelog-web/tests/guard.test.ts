import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTimeoutFetch, timeoutFor } from "../src/lib/offline/fetch";
import { MemoryStore } from "../src/lib/offline/memory-store";
import { createSupabaseRemote, requireSession } from "../src/lib/offline/remote";
import { runSync } from "../src/lib/offline/sync";
import { RemoteError } from "../src/lib/offline/types";
import { mk } from "./helpers";

type SessionResult = {
  data: { session: { user: { id: string } } | null };
  error: (Error & { status?: number; code?: string }) | null;
};

/** A fake Supabase client. `from` records every table it is asked for. */
function fakeClient(session: SessionResult) {
  const touched: string[] = [];
  const client = {
    auth: { getSession: async () => session },
    from(table: string) {
      touched.push(table);
      // If this is ever reached without a session, the test below fails loudly.
      return {
        select: () => ({
          order: () => ({ order: () => ({ range: async () => ({ data: [], error: null, status: 200 }) }) }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, touched };
}

const signedIn = (id: string): SessionResult => ({ data: { session: { user: { id } } }, error: null });
const signedOut: SessionResult = { data: { session: null }, error: null };
const authError = (message: string, status?: number): SessionResult => ({
  data: { session: null },
  error: Object.assign(new Error(message), { status }),
});

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (e) {
    return e instanceof RemoteError ? e.kind : "other";
  }
}

describe("requireSession", () => {
  it("passes for the signed-in user", async () => {
    const { client } = fakeClient(signedIn("user-1"));
    assert.equal(await kindOf(requireSession(client, "user-1")), "ok");
  });

  it("is an auth error when there is no session", async () => {
    const { client } = fakeClient(signedOut);
    assert.equal(await kindOf(requireSession(client, "user-1")), "auth");
  });

  it("is an auth error for a different account", async () => {
    const { client } = fakeClient(signedIn("someone-else"));
    assert.equal(await kindOf(requireSession(client, "user-1")), "auth");
  });

  it("is a network error when the token cannot be renewed offline", async () => {
    const { client } = fakeClient(authError("Failed to fetch", 0));
    assert.equal(await kindOf(requireSession(client, "user-1")), "network");
  });

  it("is an auth error when the refresh token is invalid", async () => {
    const { client } = fakeClient(authError("Invalid Refresh Token: Refresh Token Not Found", 400));
    assert.equal(await kindOf(requireSession(client, "user-1")), "auth");
  });
});

describe("createSupabaseRemote without a valid session", () => {
  it("never queries the server, and a sync leaves local trades untouched", async () => {
    const { client, touched } = fakeClient(signedOut);
    const store = new MemoryStore();
    const synced = mk({ pnl: 10 }); // already on the server earlier, not pending
    const offlineEntry = mk({ pnl: -5 }); // created offline, waiting to upload
    await store.applyRemote([synced]);
    await store.saveTrade(offlineEntry);

    const result = await runSync(store, createSupabaseRemote(client, "user-1"));

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.kind, "auth");
    assert.deepEqual(touched, [], "no request may be made without a session");
    const ids = (await store.getTrades()).map((t) => t.id).sort();
    assert.deepEqual(ids, [synced.id, offlineEntry.id].sort(), "no local trade may be removed");
    assert.equal((await store.getOutbox()).length, 1, "the queued entry stays queued");
  });
});

describe("timeoutFor", () => {
  it("gives sign-in and token calls a shorter limit than data calls", () => {
    const auth = timeoutFor("https://x.supabase.co/auth/v1/token?grant_type=refresh_token");
    const data = timeoutFor(new URL("https://x.supabase.co/rest/v1/trades"));
    assert.ok(auth < data);
    assert.equal(timeoutFor(new Request("https://x.supabase.co/auth/v1/user")), auth);
  });
});

describe("createTimeoutFetch", () => {
  it("passes a normal response straight through", async () => {
    const f = createTimeoutFetch(1000, async () => new Response("ok"));
    assert.equal(await (await f("https://x.test")).text(), "ok");
  });

  it("aborts a request that hangs", async () => {
    const hangs = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const f = createTimeoutFetch(30, hangs);
    const started = Date.now();
    await assert.rejects(f("https://x.test"), { name: "AbortError" });
    assert.ok(Date.now() - started < 1000, "must fail quickly instead of hanging");
  });

  it("still honours the caller's own abort signal", async () => {
    const hangs = (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const f = createTimeoutFetch(10_000, hangs);
    const outer = new AbortController();
    const pending = f("https://x.test", { signal: outer.signal });
    outer.abort();
    await assert.rejects(pending, { name: "AbortError" });
  });
});
