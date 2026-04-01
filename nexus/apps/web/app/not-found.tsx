"use client";

import { useState, useEffect } from "react";
import DomainPageClient from "./[domain]/DomainPageClient";
import CategoryPageClient from "./[domain]/[category]/CategoryPageClient";
import LoadingState from "@/components/LoadingState";
import Link from "next/link";

/**
 * Smart 404 page that doubles as a catch-all for user-created domains.
 *
 * With `output: "export"`, only domains listed in DEFAULT_DOMAINS get
 * pre-rendered static pages. User-created domains (e.g. "Health & Wellness")
 * don't have a static HTML file, so Cloudflare Pages serves 404.html
 * automatically.
 *
 * This component reads the URL on mount and renders the appropriate page:
 *  - 1-segment path (e.g. /health-wellness) -> DomainPageClient
 *  - 2-segment path (e.g. /health-wellness/my-category) -> CategoryPageClient
 *  - Otherwise -> a proper 404 message
 *
 * NOTE: We use useState + useEffect instead of useSyncExternalStore because
 * getSnapshot must return a referentially stable value. Returning a new array
 * from window.location.pathname.split() every call causes Object.is comparison
 * to fail on every render, triggering an infinite re-render loop (React #185).
 */

export default function NotFound() {
  const [segments, setSegments] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSegments(window.location.pathname.split("/").filter(Boolean));
    setMounted(true);
  }, []);

  // Show loading skeleton while we determine what to render
  if (!mounted) {
    return <LoadingState count={8} />;
  }

  // Single segment: treat as a domain page (e.g. /health-wellness)
  if (segments.length === 1) {
    return <DomainPageClient domain={segments[0]} />;
  }

  // Two segments: treat as a category page (e.g. /health-wellness/my-category)
  if (segments.length === 2) {
    return <CategoryPageClient domain={segments[0]} category={segments[1]} />;
  }

  // Anything else is a genuine 404
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">Page not found</h2>
      <p className="text-muted text-sm text-center max-w-md mb-6">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
