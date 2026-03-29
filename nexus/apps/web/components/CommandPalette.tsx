"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface CommandItem {
  id: string;
  label: string;
  section: string;
  shortcut?: string;
  href?: string;
  action?: () => void;
  icon: React.ReactNode;
}

const NAV_ICON = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
  </svg>
);

const ACTION_ICON = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

const COMMANDS: CommandItem[] = [
  { id: "home", label: "Go to Home", section: "Navigation", shortcut: "G H", href: "/", icon: NAV_ICON },
  { id: "products", label: "Go to Products", section: "Navigation", shortcut: "G P", href: "/products", icon: NAV_ICON },
  { id: "review", label: "Go to Review Center", section: "Navigation", shortcut: "G R", href: "/review", icon: NAV_ICON },
  { id: "publish", label: "Go to Publishing Center", section: "Navigation", href: "/publish", icon: NAV_ICON },
  { id: "content", label: "Go to Content Manager", section: "Navigation", href: "/content", icon: NAV_ICON },
  { id: "prompts", label: "Go to Prompt Manager", section: "Navigation", href: "/prompts", icon: NAV_ICON },
  { id: "ai-manager", label: "Go to AI Manager", section: "Navigation", href: "/ai-manager", icon: NAV_ICON },
  { id: "platforms", label: "Go to Platform Manager", section: "Navigation", href: "/platforms", icon: NAV_ICON },
  { id: "social", label: "Go to Social Channels", section: "Navigation", href: "/social", icon: NAV_ICON },
  { id: "domains", label: "Go to Domains & Categories", section: "Navigation", href: "/domains", icon: NAV_ICON },
  { id: "analytics", label: "Go to Analytics", section: "Navigation", href: "/analytics", icon: NAV_ICON },
  { id: "history", label: "Go to History", section: "Navigation", href: "/history", icon: NAV_ICON },
  { id: "settings", label: "Go to Settings", section: "Navigation", shortcut: "G S", href: "/settings", icon: NAV_ICON },
  { id: "new-product", label: "New Product", section: "Actions", shortcut: "N", href: "/products", icon: ACTION_ICON },
];

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Open/close with Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      // Small delay to ensure the modal is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Filter commands by query
  const filtered = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  // Group filtered commands by section
  const sections = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.section]) acc[cmd.section] = [];
    acc[cmd.section].push(cmd);
    return acc;
  }, {});

  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      setIsOpen(false);
      if (cmd.href) {
        router.push(cmd.href);
      } else if (cmd.action) {
        cmd.action();
      }
    },
    [router]
  );

  // Keyboard navigation within the palette
  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      executeCommand(filtered[selectedIndex]);
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-card-border bg-sidebar-bg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-card-border">
          <svg className="w-5 h-5 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-card-border text-[10px] text-muted font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">
              No results found.
            </div>
          ) : (
            Object.entries(sections).map(([section, items]) => (
              <div key={section}>
                <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted">
                  {section}
                </div>
                {items.map((cmd) => {
                  flatIndex++;
                  const idx = flatIndex;
                  return (
                    <button
                      key={cmd.id}
                      data-index={idx}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        idx === selectedIndex
                          ? "bg-accent/10 text-accent"
                          : "text-foreground hover:bg-card-hover"
                      }`}
                    >
                      <span className={idx === selectedIndex ? "text-accent" : "text-muted"}>
                        {cmd.icon}
                      </span>
                      <span className="flex-1 text-left">{cmd.label}</span>
                      {cmd.shortcut && (
                        <span className="flex items-center gap-1">
                          {cmd.shortcut.split(" ").map((k) => (
                            <kbd
                              key={k}
                              className="inline-flex items-center justify-center min-w-[20px] px-1.5 py-0.5 rounded border border-card-border text-[10px] text-muted font-mono"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
