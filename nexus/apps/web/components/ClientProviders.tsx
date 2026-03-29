"use client";

import type { ReactNode } from "react";
import { ReviewCountProvider } from "@/lib/ReviewCountContext";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import CommandPalette from "@/components/CommandPalette";
import { Toaster } from "sonner";

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
      <Toaster position="bottom-right" theme="dark" richColors />
    </ReviewCountProvider>
  );
}
