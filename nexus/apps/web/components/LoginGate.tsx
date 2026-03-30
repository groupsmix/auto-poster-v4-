"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

/* ── External-store helpers for localStorage("nexus_token") ── */

function subscribe(callback: () => void) {
  // "storage" fires for cross-tab changes; custom event for same-tab writes
  window.addEventListener("storage", callback);
  window.addEventListener("nexus-token-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("nexus-token-change", callback);
  };
}

function getSnapshot(): string | null {
  return localStorage.getItem("nexus_token");
}

function getServerSnapshot(): string | null {
  return null;
}

export default function LoginGate({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (token) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setError("Please enter the dashboard secret");
      return;
    }
    localStorage.setItem("nexus_token", trimmed);
    window.dispatchEvent(new Event("nexus-token-change"));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">NEXUS</h1>
          <p className="text-sm text-muted mt-1">Enter your dashboard secret to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="Dashboard secret"
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-card-bg border border-card-border text-foreground placeholder:text-muted focus:outline-none focus:border-accent text-sm"
            />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            Unlock Dashboard
          </button>
        </form>

        <p className="text-xs text-muted text-center mt-6">
          This is the DASHBOARD_SECRET set on your Worker.
        </p>
      </div>
    </div>
  );
}
