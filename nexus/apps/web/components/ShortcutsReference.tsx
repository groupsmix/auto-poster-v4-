"use client";

import { useState, useEffect } from "react";

interface ShortcutEntry {
  keys: string[];
  description: string;
}

const SHORTCUT_SECTIONS: { title: string; shortcuts: ShortcutEntry[] }[] = [
  {
    title: "General",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Open command palette" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["G", "H"], description: "Go to Home" },
      { keys: ["G", "P"], description: "Go to Products" },
      { keys: ["G", "R"], description: "Go to Review Center" },
      { keys: ["G", "S"], description: "Go to Settings" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["N"], description: "New Product (from Home)" },
      { keys: ["A"], description: "Approve product (Review page)" },
      { keys: ["R"], description: "Reject product (Review page)" },
      { keys: ["Esc"], description: "Go back" },
    ],
  },
];

export default function ShortcutsReference() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Use keypress to catch "?" which requires shift on most keyboards
    function handleKeyPress(e: KeyboardEvent) {
      const el = document.activeElement;
      if (el) {
        const tag = el.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        if ((el as HTMLElement).isContentEditable) return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }

    function handleKeyDownEsc(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }

    window.addEventListener("keypress", handleKeyPress);
    window.addEventListener("keydown", handleKeyDownEsc);
    return () => {
      window.removeEventListener("keypress", handleKeyPress);
      window.removeEventListener("keydown", handleKeyDownEsc);
    };
  }, [isOpen]);

  return (
    <>
      {/* "?" button in the sidebar footer */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-7 h-7 rounded-lg border border-card-border bg-card-hover flex items-center justify-center text-muted hover:text-foreground hover:border-accent/30 transition-colors"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        <span className="text-xs font-bold">?</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Content */}
          <div className="relative w-full max-w-md mx-4 rounded-xl border border-card-border bg-sidebar-bg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
              <h2 className="text-sm font-semibold text-foreground">
                Keyboard Shortcuts
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-muted hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
              {SHORTCUT_SECTIONS.map((section) => (
                <div key={section.title}>
                  <h3 className="text-[10px] uppercase tracking-wider text-muted mb-2">
                    {section.title}
                  </h3>
                  <div className="space-y-2">
                    {section.shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.description}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-foreground">
                          {shortcut.description}
                        </span>
                        <span className="flex items-center gap-1">
                          {shortcut.keys.map((k, i) => (
                            <span key={k} className="flex items-center gap-1">
                              {i > 0 && (
                                <span className="text-[10px] text-muted">+</span>
                              )}
                              <kbd className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded border border-card-border bg-card-hover text-[11px] text-muted font-mono">
                                {k}
                              </kbd>
                            </span>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-card-border">
              <p className="text-[11px] text-muted text-center">
                Press <kbd className="px-1 py-0.5 rounded border border-card-border text-[10px] font-mono">?</kbd> to toggle this reference
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
