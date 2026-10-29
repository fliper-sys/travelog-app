import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Identity } from '@/core/offline/types';
import { forgetUser, readLastUser, rememberUser } from './last-user';
import { clearSavedSession, supabase } from './supabase';

const SESSION_WAIT_MS = 4000; // online, but the session check is slow
const OFFLINE_SESSION_WAIT_MS = 1000; // the phone already reports no connection

interface SessionValue {
  /** False until we know whether someone is signed in. */
  ready: boolean;
  identity: Identity | null;
  /** Call just before a sign-in or sign-up request. */
  beforeSignIn: () => void;
  /** Sign out for good (the workspace has already removed the local data). */
  signedOut: () => Promise<void>;
  /** The session expired: show the sign-in form but keep the data on the phone. */
  reauth: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}

async function dropLocalSession() {
  try {
    await supabase?.auth.signOut({ scope: 'local' });
  } catch {
    // fall through to the manual clean-up
  }
  try {
    await clearSavedSession();
  } catch {
    // ignore
  }
}

/**
 * Works out who is signed in. It opens offline too: if the sign-in token cannot be
 * checked or renewed, the identity saved on the phone is trusted so the data already
 * stored here is still available. (The server never trusts it; syncing needs a real session.)
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  // Without Supabase configured there is nothing to check; the setup screen shows straight away.
  const [ready, setReady] = useState(!supabase);
  const signingOut = useRef(false);

  const adopt = useCallback((id: string, email: string | undefined) => {
    const next = { id, email: email ?? '' };
    void rememberUser(next);
    setIdentity((prev) => (prev && prev.id === next.id && prev.email === next.email ? prev : next));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    (async () => {
      const net = await NetInfo.fetch().catch(() => null);
      const online = net?.isConnected !== false;
      const slow = new Promise<'slow'>((resolve) =>
        setTimeout(() => resolve('slow'), online ? SESSION_WAIT_MS : OFFLINE_SESSION_WAIT_MS),
      );
      const result = await Promise.race([client.auth.getSession(), slow]);
      if (!active) return;
      const saved = await readLastUser();

      if (result === 'slow') {
        // If the session does come through later, onAuthStateChange adopts it.
        if (saved) setIdentity(saved);
      } else {
        const user = result.data.session?.user;
        if (user) adopt(user.id, user.email);
        else if (saved && (result.error || !online)) setIdentity(saved);
      }
      setReady(true);
    })();

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session?.user) {
        // A token renewal that lands while signing out must not bring the user back.
        if (!signingOut.current) adopt(session.user.id, session.user.email);
      } else if (event === 'SIGNED_OUT') {
        setIdentity(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [adopt]);

  const signedOut = useCallback(async () => {
    signingOut.current = true;
    await forgetUser();
    await dropLocalSession();
    await forgetUser(); // again, in case an auth event slipped in meanwhile
    setIdentity(null);
  }, []);

  const beforeSignIn = useCallback(() => {
    signingOut.current = false;
  }, []);

  const reauth = useCallback(async () => {
    await dropLocalSession();
    setIdentity(null);
  }, []);

  const value = useMemo(
    () => ({ ready, identity, beforeSignIn, signedOut, reauth }),
    [ready, identity, beforeSignIn, signedOut, reauth],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
