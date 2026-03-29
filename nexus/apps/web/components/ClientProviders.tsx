"use client";

import type { ReactNode } from "react";
import { ReviewCountProvider } from "@/lib/ReviewCountContext";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import CommandPalette from "@/components/CommandPalette";

function KeyboardShortcutsInit() {
  useKeyboardShortcuts();
  return null;
}

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ReviewCountProvider>
      <KeyboardShortcutsInit />
      <CommandPalette />
      {children}
    </ReviewCountProvider>
  );
}
