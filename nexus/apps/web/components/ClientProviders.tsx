"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ReviewCountProvider, useReviewCounts } from "@/lib/ReviewCountContext";
import { useKeyboardShortcuts } from "@/lib/useKeyboardShortcuts";
import CommandPalette from "@/components/CommandPalette";
import LoginGate from "@/components/LoginGate";
import ApiStatusBanner from "@/components/ApiStatusBanner";
import { Toaster } from "sonner";

function KeyboardShortcutsInit() {
  useKeyboardShortcuts();
  return null;
}

const PAGE_TITLES: Record<string, string> = {
  "/": "Home",
  "/products": "Products",
  "/review": "Review Center",
  "/publish": "Publishing",
  "/content": "Content",
  "/prompts": "Prompts",
  "/ai-manager": "AI Manager",
  "/platforms": "Platforms",
  "/social": "Social Channels",
  "/domains": "Domains",
  "/analytics": "Analytics",
  "/history": "History",
  "/settings": "Settings",
};

/** Updates the browser tab title with the page name and pending review count */
function DocumentTitleUpdater() {
  const { pendingReviewCount } = useReviewCounts();
  const pathname = usePathname();

  useEffect(() => {
    const pageTitle = PAGE_TITLES[pathname] ?? "NEXUS";
    const badge = pendingReviewCount > 0 ? `(${pendingReviewCount}) ` : "";
    document.title = `${badge}${pageTitle} | NEXUS`;
  }, [pendingReviewCount, pathname]);

  return null;
}

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <LoginGate>
      <ReviewCountProvider>
        <KeyboardShortcutsInit />
        <DocumentTitleUpdater />
        <CommandPalette />
        <ApiStatusBanner />
        {children}
        <Toaster position="bottom-right" theme="dark" richColors />
      </ReviewCountProvider>
    </LoginGate>
  );
}
