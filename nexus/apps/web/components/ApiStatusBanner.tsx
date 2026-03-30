"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";

export default function ApiStatusBanner() {
  const [unreachable, setUnreachable] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      api
        .get<unknown>("/health")
        .then((res) => {
          if (!cancelled) setUnreachable(!res.success);
        })
        .catch(() => {
          if (!cancelled) setUnreachable(true);
        });
    };

    check();
    const interval = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await api.get<unknown>("/health");
      setUnreachable(!res.success);
    } catch {
      setUnreachable(true);
    }
    setRetrying(false);
  };

  if (!unreachable) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2 bg-yellow-600/10 border-b border-yellow-500/30 text-yellow-300 text-sm">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span>Cannot reach API — data may be stale or unavailable</span>
      </div>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
        aria-label="Retry API connection"
      >
        {retrying ? "Retrying..." : "Retry"}
      </button>
    </div>
  );
}
