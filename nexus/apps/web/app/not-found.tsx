"use client";

import { useMemo } from "react";
import Link from "next/link";
import DomainPageClient from "./[domain]/DomainPageClient";

/**
 * Custom 404 page that handles dynamically created domains.
 *
 * With `output: "export"` (static site on Cloudflare Pages), only domains
 * listed in `generateStaticParams` get pre-rendered HTML files. When a user
 * creates a new domain at runtime the slug won't have a static page, so
 * Cloudflare Pages serves this 404 page instead.
 *
 * We detect single-segment paths that look like domain slugs and render
 * the domain page client-side, giving the user a seamless experience.
 */
export default function NotFound() {
  const domainSlug = useMemo(() => {
    if (typeof window === "undefined") return null;
    const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
    const segments = path.split("/");
    // Single-segment path that looks like a domain slug (lowercase, hyphens, alphanumeric)
    if (segments.length === 1 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) && path.length > 0) {
      return path;
    }
    return null;
  }, []);

  if (domainSlug) {
    return <DomainPageClient domain={domainSlug} />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
      <p className="text-muted text-lg mb-6">
        This page doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
