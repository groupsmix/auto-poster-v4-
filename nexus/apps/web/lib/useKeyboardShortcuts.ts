"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Global keyboard shortcuts using a two-key sequence (g+h, g+p, etc.)
 * and single-key actions (n for new product).
 *
 * Shortcuts are disabled when focus is inside an input, textarea, or
 * contentEditable element, or when a modal/dialog is open.
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const pendingPrefix = useRef<string | null>(null);
  const prefixTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function isEditing(): boolean {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if ((el as HTMLElement).isContentEditable) return true;
      return false;
    }

    function isModalOpen(): boolean {
      // Check if command palette or any modal overlay is open
      const overlay = document.querySelector("[data-command-palette]");
      if (overlay) return true;
      // Also check for any dialog/modal elements
      const dialogs = document.querySelectorAll("dialog[open], [role='dialog']");
      return dialogs.length > 0;
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Skip if user is typing in an input or a modal is open
      if (isEditing() || isModalOpen()) return;
      // Skip if any modifier key is held (except shift)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Handle prefix sequences (g + ...)
      if (pendingPrefix.current === "g") {
        pendingPrefix.current = null;
        if (prefixTimer.current) {
          clearTimeout(prefixTimer.current);
          prefixTimer.current = null;
        }

        type RouteKey = "h" | "p" | "r" | "s";
        const routes: Record<RouteKey, string> = {
          h: "/",
          p: "/products",
          r: "/review",
          s: "/settings",
        };

        const route = routes[key as RouteKey];
        if (route) {
          e.preventDefault();
          router.push(route);
          return;
        }
        // Unknown second key — ignore
        return;
      }

      // Start a prefix sequence
      if (key === "g") {
        e.preventDefault();
        pendingPrefix.current = "g";
        // Clear after 1 second if no follow-up key
        prefixTimer.current = setTimeout(() => {
          pendingPrefix.current = null;
          prefixTimer.current = null;
        }, 1000);
        return;
      }

      // Single-key shortcuts
      if (key === "n" && pathname === "/") {
        e.preventDefault();
        router.push("/products");
        return;
      }

      // Review page shortcuts: approve (a), reject (r) (5.5)
      if (pathname.startsWith("/review/")) {
        if (key === "a") {
          e.preventDefault();
          const approveBtn = document.querySelector<HTMLButtonElement>("[data-action='approve']");
          approveBtn?.click();
          return;
        }
        if (key === "r") {
          e.preventDefault();
          const rejectBtn = document.querySelector<HTMLButtonElement>("[data-action='reject']");
          rejectBtn?.click();
          return;
        }
      }

      // Escape to go back (5.5)
      if (key === "escape") {
        e.preventDefault();
        router.back();
        return;
      }

      // "?" opens the shortcuts reference — handled by ShortcutsReference component
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (prefixTimer.current) clearTimeout(prefixTimer.current);
    };
  }, [router, pathname]);
}
