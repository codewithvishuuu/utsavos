import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import { safeDestination } from "../lib/navigation";

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const destination = safeDestination(
    (location.state as { from?: unknown } | null)?.from
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") await api.auth.signup(email, password);
      else await api.auth.login(email, password);
      navigate(destination, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="card">
        <p className="font-mono-code text-[10px] uppercase tracking-[0.2em] text-[#A84422]">
          UtsavOS account
        </p>
        <h1 className="mt-2 font-serif-editorial text-3xl leading-tight text-[#12100E]">
          {mode === "login" ? "Sign in to UtsavOS" : "Create your UtsavOS account"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4A433E]">
          Plan the event, then simulate changes before anything is saved.
        </p>
        <form className="mt-5 space-y-4" onSubmit={submit}>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "signup" ? 10 : 1}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {mode === "signup" && (
              <p className="mt-1.5 text-xs text-[#6E655F]">At least 10 characters.</p>
            )}
          </div>
          {error && (
            <p className="text-sm font-medium text-[#A84422]" role="alert">
              {error}
            </p>
          )}
          <button className="btn w-full" disabled={busy}>
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          className="mt-3 rounded text-sm text-[#4A433E] underline hover:text-[#A84422] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already registered? Sign in"}
        </button>
      </div>
      <p className="mt-4 text-center text-sm text-[#4A433E]">
        No account needed for the{" "}
        <a
          className="rounded underline hover:text-[#A84422] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C85A32]"
          href="/demo"
        >
          public demo
        </a>
        .
      </p>
    </div>
  );
}
