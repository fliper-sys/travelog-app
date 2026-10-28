"use client";

import { useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export default function AuthForm({
  client,
  onBeforeSignIn,
}: {
  client: SupabaseClient;
  /** Called just before a sign-in or sign-up request is sent. */
  onBeforeSignIn?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isLogin = mode === "login";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isLogin && password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setBusy(true);
    onBeforeSignIn?.();
    if (isLogin) {
      const { error: err } = await client.auth.signInWithPassword({ email, password });
      if (err) setError(err.message);
    } else {
      const { data, error: err } = await client.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
      } else if (!data.session) {
        setInfo("Account created. Check your email to confirm it, then sign in.");
        setMode("login");
        setPassword("");
        setConfirm("");
      }
    }
    setBusy(false);
  }

  function switchMode() {
    setMode(isLogin ? "register" : "login");
    setError(null);
    setInfo(null);
    setConfirm("");
  }

  return (
    <div className="center-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand">
          <span className="logo" aria-hidden="true">
            ▥
          </span>
          TRADELOG
        </div>
        <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="sub" style={{ margin: "0 0 18px" }}>
          {isLogin
            ? "Sign in to your trading journal."
            : "Record. Review. Refine. Your trades stay private to you."}
        </p>

        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {info && (
          <div className="notice" role="status" style={{ marginBottom: 14 }}>
            {info}
          </div>
        )}

        <div className="field">
          <label htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="auth-password">Password</label>
          <div className="pw">
            <input
              id="auth-password"
              type={show ? "text" : "password"}
              required
              minLength={6}
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>
              {show ? "Hide" : "Show"}
            </button>
          </div>
          {!isLogin && <span className="hint">At least 6 characters.</span>}
        </div>

        {!isLogin && (
          <div className="field">
            <label htmlFor="auth-confirm">Confirm password</label>
            <input
              id="auth-confirm"
              type={show ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        )}

        <button className="btn primary block" type="submit" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
        </button>

        <div className="auth-foot">
          {isLogin ? "New here? " : "Already have an account? "}
          <button type="button" className="link-btn" onClick={switchMode}>
            {isLogin ? "Create an account" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  );
}
