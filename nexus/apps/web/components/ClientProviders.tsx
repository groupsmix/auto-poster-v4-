"use client";

import { useEffect, type ReactNode } from "react";
import { ReviewCountProvider, useReviewCounts } from "@/lib/ReviewCountContext";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import CommandPalette from "@/components/CommandPalette";
import { Toaster } from "sonner";

function KeyboardShortcutsInit() {
  useKeyboardShortcuts();
  return null;
}

/** Updates the browser tab title with the pending review count (5.1) */
function DocumentTitleUpdater() {
  const { pendingReviewCount } = useReviewCounts();

  useEffect(() => {
    if (pendingReviewCount > 0) {
      document.title = `(${pendingReviewCount}) NEXUS — AI Business Engine`;
    } else {
      document.title = "NEXUS — AI Business Engine";
    }
  }, [pendingReviewCount]);

  return null;
}

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ReviewCountProvider>
      <KeyboardShortcutsInit />
      <DocumentTitleUpdater />
      <CommandPalette />
      {children}
      <Toaster position="bottom-right" theme="dark" richColors />
    </ReviewCountProvider>
  );
}
