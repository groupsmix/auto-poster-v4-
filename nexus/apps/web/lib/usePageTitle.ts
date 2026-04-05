"use client";

import { useEffect } from "react";

/**
 * Sets the browser tab title for the current page.
 * Format: "PageName | NEXUS"
 *
 * The title is restored to the default when the component unmounts.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} | NEXUS`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
