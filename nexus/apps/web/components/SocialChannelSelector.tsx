"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import { MOCK_CHANNELS } from "@/lib/mock-data";

const DEFAULT_CHANNELS = [
  { name: "Instagram", slug: "instagram" },
  { name: "TikTok", slug: "tiktok" },
  { name: "X/Twitter", slug: "x-twitter" },
  { name: "Pinterest", slug: "pinterest" },
  { name: "LinkedIn", slug: "linkedin" },
  { name: "YouTube", slug: "youtube" },
  { name: "Facebook", slug: "facebook" },
];

interface SocialChannelSelectorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  selected: string[];
  onChange: (channels: string[]) => void;
  postingMode: "auto" | "manual";
  onPostingModeChange: (mode: "auto" | "manual") => void;
}

export default function SocialChannelSelector({
  enabled,
  onToggle,
  selected,
  onChange,
  postingMode,
  onPostingModeChange,
}: SocialChannelSelectorProps) {
  // Fetch channels from API, fall back to hardcoded defaults (4.8)
  const { data: fetchedChannels } = useApiQuery(
    () => api.socialChannels.list(),
    MOCK_CHANNELS,
  );

  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  // Sync fetched channels into local state, filtering to active only (4.8)
  useEffect(() => {
    const active = fetchedChannels
      .filter((c) => c.is_active)
      .map((c) => ({ name: c.name, slug: c.slug }));
    if (active.length > 0) {
      setChannels(active);
    }
  }, [fetchedChannels]);

  const toggle = (slug: string) => {
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    const slug = newName
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .trim();
    if (!channels.find((c) => c.slug === slug)) {
      setChannels([...channels, { name: newName.trim(), slug }]);
      onChange([...selected, slug]);
    }
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-foreground">Post to social?</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToggle(true)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              enabled
                ? "bg-accent text-white"
                : "bg-card-bg border border-card-border text-muted hover:text-foreground"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onToggle(false)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              !enabled
                ? "bg-card-hover text-foreground border border-card-border"
                : "bg-card-bg border border-card-border text-muted hover:text-foreground"
            }`}
          >
            No
          </button>
        </div>
      </div>

      {enabled && (
        <>
          {/* Channel checkboxes */}
          <div className="flex flex-wrap gap-2">
            {channels.map((channel) => (
              <button
                key={channel.slug}
                type="button"
                onClick={() => toggle(channel.slug)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  selected.includes(channel.slug)
                    ? "bg-accent/20 border-accent text-accent"
                    : "bg-card-bg border-card-border text-muted hover:text-foreground hover:border-card-hover"
                }`}
              >
                {selected.includes(channel.slug) && (
                  <span className="mr-1.5">&#10003;</span>
                )}
                {channel.name}
              </button>
            ))}
            {adding ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="Channel name"
                  className="px-3 py-1.5 rounded-lg text-sm bg-card-bg border border-card-border text-foreground placeholder:text-muted focus:outline-none focus:border-accent w-32"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  className="px-2 py-1.5 rounded-lg text-sm text-accent hover:bg-accent/10"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewName(""); }}
                  className="px-2 py-1.5 rounded-lg text-sm text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border-2 border-dashed border-card-border text-muted hover:border-accent/50 hover:text-accent transition-all"
              >
                + Add Channel
              </button>
            )}
          </div>

          {/* Posting mode */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">Posting mode:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onPostingModeChange("auto")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  postingMode === "auto"
                    ? "bg-accent text-white"
                    : "bg-card-bg border border-card-border text-muted hover:text-foreground"
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => onPostingModeChange("manual")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  postingMode === "manual"
                    ? "bg-card-hover text-foreground border border-card-border"
                    : "bg-card-bg border border-card-border text-muted hover:text-foreground"
                }`}
              >
                Manual
              </button>
            </div>
            <span className="text-xs text-muted">(overrides global setting for this product)</span>
          </div>
        </>
      )}
    </div>
  );
}
