"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Identity } from "@/lib/offline/types";
import { supabase } from "@/lib/supabase";
import AuthForm from "./AuthForm";
import Workspace from "./Workspace";

const LAST_USER_KEY = "tradelog:last-user";
const SESSION_WAIT_MS = 4000; // online, but the session check is slow
const OFFLINE_SESSION_WAIT_MS = 1000; // browser already reports no connection

function readLastUser(): Identity | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    const value = raw ? (JSON.parse(raw) as Identity) : null;
    return value && typeof value.id === "string" ? value : null;
  } catch {
    return null;
  }
}

function rememberUser(identity: Identity) {
  try {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(identity));
  } catch {
    // Private mode: offline start-up just will not remember who you are.
  }
}

function forgetUser() {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // ignore
  }
}

/** Remove the saved sign-in without contacting the server, so it works offline. */
async function dropLocalSession(client: SupabaseClient) {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // fall through to the manual clean-up
  }
  try {
    for (const key of Object.keys(localStorage)) {
      if (/^sb-.*-auth-token/.test(key)) localStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

function SetupNotice() {
  return (
    <div className="center-screen">
      <div className="auth-card">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            ▥
          </span>
          TRADELOG
        </div>
        <h1>Connect Supabase</h1>
        <p className="sub" style={{ margin: 0, lineHeight: 1.5 }}>
          Create a file named <code className="mono">.env.local</code> next to{" "}
          <code className="mono">package.json</code> with your project URL and publishable key (see{" "}
          <code className="mono">.env.example</code>), then restart <code className="mono">npm run dev</code>.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const signingOut = useRef(false);

  const adopt = useCallback((id: string, email: string | undefined) => {
    const next = { id, email: email ?? "" };
    rememberUser(next);
    setIdentity((prev) => (prev && prev.id === next.id && prev.email === next.email ? prev : next));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    // Checking the session may need the network (to renew an expired token). On a
    // slow or hung connection that could leave you staring at "Loading…", so give
    // it a few seconds and then open the data already saved on this device.
    const slow = new Promise<"slow">((resolve) =>
      setTimeout(() => resolve("slow"), navigator.onLine ? SESSION_WAIT_MS : OFFLINE_SESSION_WAIT_MS),
    );

    Promise.race([client.auth.getSession(), slow]).then((result) => {
      if (!active) return;
      const saved = readLastUser();

      if (result === "slow") {
        // If the session does come through later, onAuthStateChange adopts it.
        if (saved) setIdentity(saved);
        setReady(true);
        return;
      }

      const { data, error } = result;
      const user = data.session?.user;
      if (user) {
        adopt(user.id, user.email);
      } else if (saved && (error || !navigator.onLine)) {
        // No usable session because the server could not be reached (offline, or
        // the token renewal failed): trust the saved identity so the app opens
        // with the data already on this device.
        setIdentity(saved);
      }
      setReady(true);
    });

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session?.user) {
        // A token renewal that lands while signing out must not bring the user back.
        if (!signingOut.current) adopt(session.user.id, session.user.email);
      } else if (event === "SIGNED_OUT") {
        setIdentity(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [adopt]);

  // Sign out for good: the workspace has already removed the local data.
  const onSignedOut = useCallback(async () => {
    if (!supabase) return;
    signingOut.current = true;
    forgetUser();
    await dropLocalSession(supabase);
    forgetUser(); // again, in case an auth event slipped in while signing out
    setIdentity(null);
  }, []);

  // Only a deliberate sign-in from the form lifts the sign-out guard.
  const onBeforeSignIn = useCallback(() => {
    signingOut.current = false;
  }, []);

  // Session expired: show the sign-in form but keep the data on this device.
  const onReauth = useCallback(async () => {
    if (!supabase) return;
    await dropLocalSession(supabase);
    setIdentity(null);
  }, []);

  if (!supabase) return <SetupNotice />;
  if (!ready) return <div className="center-screen sub">Loading…</div>;
  if (!identity) return <AuthForm client={supabase} onBeforeSignIn={onBeforeSignIn} />;
  return (
    <Workspace
      key={identity.id}
      client={supabase}
      identity={identity}
      onSignedOut={onSignedOut}
      onReauth={onReauth}
    />
  );
}
