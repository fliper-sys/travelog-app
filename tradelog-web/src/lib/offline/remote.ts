import type { SupabaseClient } from "@supabase/supabase-js";
import type { Trade } from "../types";
import { RemoteError } from "./types";
import type { Remote } from "./types";

const PAGE = 1000;

interface Failure {
  message?: string;
  code?: string;
}

/** Turn a Supabase/PostgREST failure into network, auth or rejected. */
export function classify(error: Failure | null | undefined, status?: number): RemoteError {
  const message = error?.message || "Request failed";
  const code = error?.code ?? "";

  if (
    status === 401 ||
    code === "PGRST301" ||
    code === "PGRST303" ||
    /jwt|not authenticated|invalid refresh token|refresh token/i.test(message)
  ) {
    return new RemoteError("auth", message);
  }
  if (
    status === 0 ||
    (status !== undefined && status >= 500) ||
    (status === undefined && !code) ||
    (!code && /failed to fetch|networkerror|network request failed|load failed|fetch failed|timed? ?out|offline/i.test(message))
  ) {
    return new RemoteError("network", message);
  }
  return new RemoteError("rejected", message);
}

function check(res: { error: Failure | null; status?: number }): void {
  if (res.error) throw classify(res.error, res.status);
}

/** Wrap anything a call might throw (fetch rejections included). */
async function call<T>(fn: () => PromiseLike<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof RemoteError) throw e;
    throw classify({ message: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Refuse to talk to the server unless this device holds a valid sign-in for
 * `userId`. The app can open offline from a saved identity, and without a real
 * session a request goes out as "anonymous". That must never be treated as an
 * empty server: pulling an empty list would delete the trades on this device.
 */
export async function requireSession(
  client: Pick<SupabaseClient, "auth">,
  userId: string,
): Promise<void> {
  let res;
  try {
    res = await client.auth.getSession();
  } catch (e) {
    throw classify({ message: e instanceof Error ? e.message : String(e) });
  }
  if (res.error) {
    const status = (res.error as { status?: number }).status;
    throw classify({ message: res.error.message, code: (res.error as { code?: string }).code }, status);
  }
  const user = res.data.session?.user;
  if (!user) throw new RemoteError("auth", "You are signed out.");
  if (user.id !== userId) throw new RemoteError("auth", "Signed in as a different account.");
}

export function createSupabaseRemote(client: SupabaseClient, userId: string): Remote {
  const guard = () => requireSession(client, userId);

  return {
    async pullTrades() {
      await guard();
      const all: Trade[] = [];
      for (let from = 0; ; from += PAGE) {
        const res = await call(() =>
          client
            .from("trades")
            .select("*")
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1),
        );
        check(res);
        const rows = (res.data ?? []) as Trade[];
        all.push(...rows);
        if (rows.length < PAGE) return all;
      }
    },

    async pushTrade(trade) {
      await guard();
      // updated_at is maintained by the database trigger.
      const { updated_at: _ignored, ...row } = trade;
      void _ignored;
      check(await call(() => client.from("trades").upsert({ ...row, user_id: userId }, { onConflict: "id" })));
    },

    async deleteTrade(id) {
      await guard();
      check(await call(() => client.from("trades").delete().eq("id", id)));
    },

    async pullSettings() {
      await guard();
      const res = await call(() => client.from("user_settings").select("starting_balance").maybeSingle());
      check(res);
      const value = (res.data as { starting_balance: number | string } | null)?.starting_balance;
      return value == null ? null : Number(value);
    },

    async pushSettings(startBalance) {
      await guard();
      check(
        await call(() =>
          client
            .from("user_settings")
            .upsert({ user_id: userId, starting_balance: startBalance }, { onConflict: "user_id" }),
        ),
      );
    },
  };
}

/** Plain-English hint for errors that mean the database script was not run. */
export function explainSyncError(message: string): string {
  if (/schema cache|column .* does not exist|could not find the/i.test(message)) {
    return `${message}. Run supabase/002_review_fields.sql in the Supabase SQL Editor.`;
  }
  if (/relation .* does not exist|could not find the table/i.test(message)) {
    return `${message}. Run supabase/schema.sql in the Supabase SQL Editor.`;
  }
  return message;
}
