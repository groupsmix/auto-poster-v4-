"use client";

import { useState, useEffect, useRef } from "react";

/**
 * PWA Install Prompt — shows a visible "Install App" banner when the
 * browser supports installing the dashboard as a standalone app.
 *
 * Listens for the `beforeinstallprompt` event (Chrome/Edge) and
 * provides a one-click install button. Hides automatically after
 * installation or dismissal. Remembers dismissal in localStorage.
 */
export default function InstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Don't show if user previously dismissed
    if (localStorage.getItem("nexus_install_dismissed") === "1") return;

    // Don't show if already running as standalone PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Hide banner if app gets installed
    window.addEventListener("appinstalled", () => {
      setShowBanner(false);
      deferredPromptRef.current = null;
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;

    setInstalling(true);
    prompt.prompt();
    const result = await prompt.userChoice;

    if (result.outcome === "accepted") {
      setShowBanner(false);
    }
    deferredPromptRef.current = null;
    setInstalling(false);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("nexus_install_dismissed", "1");
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4">
      <div className="rounded-xl border border-accent/30 bg-card-bg shadow-2xl p-4">
        <div className="flex items-start gap-3">
          {/* App icon */}
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15M9 12l3 3m0 0 3-3m-3 3V2.25" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Install NEXUS
            </p>
            <p className="text-xs text-muted mt-0.5">
              Add to your desktop or phone for quick access — works offline too.
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleInstall}
                disabled={installing}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {installing ? "Installing..." : "Install App"}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors"
              >
                Not now
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="p-1 rounded text-muted hover:text-foreground transition-colors shrink-0"
            aria-label="Dismiss install prompt"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * TypeScript declarations for the BeforeInstallPromptEvent
 * (not in standard lib types yet).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}
