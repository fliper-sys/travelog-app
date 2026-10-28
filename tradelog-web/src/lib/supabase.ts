import { createClient } from "@supabase/supabase-js";
import { createTimeoutFetch, timeoutFor } from "./offline/fetch";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Returns null when the env vars are missing so the UI can show a setup hint
// instead of crashing. Only the public (publishable/anon) key belongs here.
// Requests time out so a hung connection fails like an offline one and the
// next sync retry starts fresh.
export const supabase =
  url && key ? createClient(url, key, { global: { fetch: createTimeoutFetch(timeoutFor) } }) : null;
