import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Returns null when the env vars are missing so the UI can show a setup hint
// instead of crashing. Only the public (publishable/anon) key belongs here.
export const supabase = url && key ? createClient(url, key) : null;
