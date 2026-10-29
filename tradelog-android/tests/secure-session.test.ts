import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createChunkedStorage, safeKey } from "../src/lib/secure-session";
import type { SecureBacking } from "../src/lib/secure-session";

function fakeBacking() {
  const data = new Map<string, string>();
  const backing: SecureBacking = {
    async getItemAsync(k) {
      return data.get(k) ?? null;
    },
    async setItemAsync(k, v) {
      assert.match(k, /^[A-Za-z0-9._-]+$/, `illegal SecureStore key: ${k}`);
      data.set(k, v);
    },
    async deleteItemAsync(k) {
      data.delete(k);
    },
  };
  return { backing, data };
}

const KEY = "sb-abcdefgh-auth-token";
const session = JSON.stringify({ access_token: "a".repeat(1200), refresh_token: "r".repeat(40), user: { id: "u", email: "é@x.com" } });

describe("createChunkedStorage", () => {
  it("round-trips a session that is longer than one piece", async () => {
    const { backing, data } = fakeBacking();
    const s = createChunkedStorage(backing, 500);
    await s.setItem(KEY, session);
    assert.ok(data.size > 2, "was split into pieces");
    assert.equal(await s.getItem(KEY), session);
  });

  it("returns null when nothing is stored", async () => {
    assert.equal(await createChunkedStorage(fakeBacking().backing).getItem(KEY), null);
  });

  it("replaces a long session with a shorter one and leaves no stale pieces", async () => {
    const { backing, data } = fakeBacking();
    const s = createChunkedStorage(backing, 100);
    await s.setItem(KEY, "x".repeat(1000));
    await s.setItem(KEY, "short");
    assert.equal(await s.getItem(KEY), "short");
    assert.equal(data.size, 2, "header + one piece");
  });

  it("removeItem deletes the header and every piece", async () => {
    const { backing, data } = fakeBacking();
    const s = createChunkedStorage(backing, 100);
    await s.setItem(KEY, "y".repeat(450));
    await s.removeItem(KEY);
    assert.equal(data.size, 0);
    assert.equal(await s.getItem(KEY), null);
  });

  it("treats a half-written session as signed out", async () => {
    const { backing, data } = fakeBacking();
    const s = createChunkedStorage(backing, 100);
    await s.setItem(KEY, "z".repeat(450));
    data.delete(`${KEY}.2`);
    assert.equal(await s.getItem(KEY), null);
  });

  it("reads a value that was stored whole", async () => {
    const { backing } = fakeBacking();
    await backing.setItemAsync(KEY, "plain-value");
    assert.equal(await createChunkedStorage(backing).getItem(KEY), "plain-value");
  });

  it("makes keys safe for SecureStore", () => {
    assert.equal(safeKey("sb:weird/key name"), "sb_weird_key_name");
  });
});
