"use client";

import { useState } from "react";

const DEFAULT_PLATFORMS = [
  { id: "etsy", label: "Etsy" },
  { id: "gumroad", label: "Gumroad" },
  { id: "payhip", label: "Payhip" },
  { id: "shopify", label: "Shopify" },
  { id: "amazon-kdp", label: "Amazon KDP" },
  { id: "tiktok-shop", label: "TikTok Shop" },
];

interface PlatformSelectorProps {
  selected: string[];
  onChange: (platforms: string[]) => void;
}

export default function PlatformSelector({ selected, onChange }: PlatformSelectorProps) {
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORMS);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlatform, setNewPlatform] = useState("");

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((p) => p !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function addPlatform() {
    if (!newPlatform.trim()) return;
    const id = newPlatform.trim().toLowerCase().replace(/\s+/g, "-");
    if (platforms.some((p) => p.id === id)) return;
    setPlatforms([...platforms, { id, label: newPlatform.trim() }]);
    onChange([...selected, id]);
    setNewPlatform("");
    setShowAdd(false);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {platforms.map((platform) => (
          <label
            key={platform.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all duration-150 text-sm ${
              selected.includes(platform.id)
                ? "border-accent bg-accent/10 text-accent"
                : "border-card-border bg-card-bg text-foreground hover:border-accent/30"
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(platform.id)}
              onChange={() => toggle(platform.id)}
              className="sr-only"
            />
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                selected.includes(platform.id)
                  ? "bg-accent border-accent"
                  : "border-muted"
              }`}
            >
              {selected.includes(platform.id) && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </span>
            {platform.label}
          </label>
        ))}

        {showAdd ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPlatform()}
              placeholder="Platform name"
              autoFocus
              className="px-3 py-2 rounded-lg border border-card-border bg-card-bg text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent w-36"
            />
            <button
              onClick={addPlatform}
              className="px-3 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-hover transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => { setShowAdd(false); setNewPlatform(""); }}
              className="px-3 py-2 rounded-lg border border-card-border text-muted text-sm hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-4 py-2.5 rounded-lg border border-dashed border-card-border text-muted text-sm hover:border-accent/50 hover:text-accent transition-all cursor-pointer"
          >
            <span>+</span> Add
          </button>
        )}
      </div>
    </div>
  );
}
