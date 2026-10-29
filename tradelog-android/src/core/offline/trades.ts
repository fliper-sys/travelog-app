// GENERATED COPY of tradelog-web/src/lib. Do not edit here.
// Change the web file, then run: npm run sync-core
import type { ReviewInput, Trade, TradeInput } from "../types";

/** UUID v4. crypto.randomUUID needs a secure context, so fall back if absent. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h
    .slice(8, 10)
    .join("")}-${h.slice(10).join("")}`;
}

/** A brand-new trade, created on this device (the id is chosen here). */
export function buildTrade(userId: string, input: TradeInput, now = new Date()): Trade {
  const iso = now.toISOString();
  return {
    ...input,
    id: newId(),
    user_id: userId,
    created_at: iso,
    updated_at: iso,
    risk_amount: null,
    review_status: "pending",
    adherence: null,
    emotion: null,
    confidence: null,
    mistake: null,
    lesson: null,
    reviewed_at: null,
  };
}

export function editTrade(existing: Trade, input: TradeInput, now = new Date()): Trade {
  return { ...existing, ...input, updated_at: now.toISOString() };
}

export function reviewTrade(existing: Trade, review: ReviewInput, now = new Date()): Trade {
  return { ...existing, ...review, updated_at: now.toISOString() };
}
