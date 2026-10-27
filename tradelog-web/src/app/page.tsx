"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import AuthForm from "@/components/AuthForm";
import Dashboard from "@/components/Dashboard";

function SetupNotice() {
  return (
    <div className="center-screen">
      <div className="auth-card">
        <h1>Connect Supabase</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Create a file named <code className="mono">.env.local</code> next to{" "}
          <code className="mono">package.json</code> with your project URL and
          publishable key (see <code className="mono">.env.example</code>), then
          restart <code className="mono">npm run dev</code>.
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;

    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!supabase) return <SetupNotice />;
  if (!ready) return <div className="center-screen muted">Loading…</div>;
  if (!session) return <AuthForm client={supabase} />;
  return <Dashboard client={supabase} session={session} />;
}
