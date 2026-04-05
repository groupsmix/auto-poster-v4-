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

/** Verify a token against the backend auth endpoint */
async function verifyToken(token: string): Promise<{ ok: boolean; error?: string }> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api";
  try {
    const resp = await fetch(`${apiBase}/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (resp.ok) return { ok: true };
    // Parse error message from the backend if available
    try {
      const body = await resp.json() as { error?: string };
      return { ok: false, error: body.error ?? "Invalid secret" };
    } catch {
      return { ok: false, error: "Invalid secret" };
    }
  } catch {
    return { ok: false, error: "Unable to reach the API. Check your connection." };
  }
}

export default function LoginGate({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (token) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setError("Please enter the dashboard secret");
      return;
    }

    setLoading(true);
    setError("");

    const result = await verifyToken(trimmed);
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? "Invalid secret");
      return;
    }

    // Token verified — persist and unlock
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
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-card-bg border border-card-border text-foreground placeholder:text-muted focus:outline-none focus:border-accent text-sm disabled:opacity-50"
            />
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying…" : "Unlock Dashboard"}
          </button>
        </form>

        <p className="text-xs text-muted text-center mt-6">
          This is the DASHBOARD_SECRET set on your Worker.
        </p>
      </div>
    </div>
  );
}
