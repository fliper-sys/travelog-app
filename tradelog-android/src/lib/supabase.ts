import './polyfills';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

import { createTimeoutFetch, timeoutFor } from '@/core/offline/fetch';
import { createChunkedStorage } from './secure-session';

// Expo only inlines EXPO_PUBLIC_ variables written exactly like this.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const authStorage = createChunkedStorage(SecureStore);

/** The key supabase-js keeps the session under (needed to clear it while offline). */
export const SESSION_KEY = url && /^https?:\/\//.test(url) ? `sb-${new URL(url).hostname.split('.')[0]}-auth-token` : '';

/** Remove the saved session from this phone without contacting the server. */
export const clearSavedSession = () => (SESSION_KEY ? authStorage.removeItem(SESSION_KEY) : Promise.resolve());

/** null until .env is filled in; the app then shows a setup screen. */
export const supabase: SupabaseClient | null =
  url && key && /^https?:\/\//.test(url)
    ? createClient(url, key, {
        auth: {
          storage: authStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // there is no URL to read a session from
        },
        global: { fetch: createTimeoutFetch(timeoutFor) },
      })
    : null;

// Only run the token-refresh loop while the app is on screen.
if (supabase) {
  const client = supabase;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}
