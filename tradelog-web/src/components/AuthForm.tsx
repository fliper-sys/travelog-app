"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export default function AuthForm({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);

    if (mode === "login") {
      const { error: err } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (err) setError(err.message);
    } else {
      const { data, error: err } = await client.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
      } else if (!data.session) {
        setInfo("Account created. Check your email to confirm it, then sign in.");
        setMode("login");
      }
    }
    setBusy(false);
  }

  return (
    <div className="center-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand">
          <span className="brand-mark" />
          TRADELOG
        </div>
        <h1>{mode === "login" ? "Sign in" : "Create your account"}</h1>

        {error && <div className="alert" style={{ margin: 0 }}>{error}</div>}
        {info && <div className="notice">{info}</div>}

        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        <div className="muted small">
          {mode === "login" ? "New here? " : "Already have an account? "}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
              setInfo(null);
            }}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
