"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Amber banner shown when the page is displaying mock/demo data
 * because the API is unreachable. Dismissible for the current session.
 */
export default function MockDataBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5">
      <p className="text-xs text-yellow-300">
        You&apos;re viewing demo data. Connect your Cloudflare Workers to see
        real data.{" "}
        <Link
          href="/settings"
          className="underline hover:text-yellow-200 transition-colors"
        >
          Go to Settings
        </Link>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-yellow-400 hover:text-yellow-200 transition-colors"
        aria-label="Dismiss"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18 18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
