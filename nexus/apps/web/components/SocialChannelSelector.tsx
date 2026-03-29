"use client";

import { useState } from "react";

const DEFAULT_CHANNELS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "x-twitter", label: "X/Twitter" },
  { id: "pinterest", label: "Pinterest" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube" },
  { id: "facebook", label: "Facebook" },
];

interface SocialChannelSelectorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  selectedChannels: string[];
  onChannelsChange: (channels: string[]) => void;
  postingMode: "auto" | "manual";
  onPostingModeChange: (mode: "auto" | "manual") => void;
}

export default function SocialChannelSelector({
  enabled,
  onToggle,
  selectedChannels,
  onChannelsChange,
  postingMode,
  onPostingModeChange,
}: SocialChannelSelectorProps) {
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [showAdd, setShowAdd] = useState(false);
  const [newChannel, setNewChannel] = useState("");

  function toggleChannel(id: string) {
    if (selectedChannels.includes(id)) {
      onChannelsChange(selectedChannels.filter((c) => c !== id));
    } else {
      onChannelsChange([...selectedChannels, id]);
    }
  }

  function addChannel() {
    if (!newChannel.trim()) return;
    const id = newChannel.trim().toLowerCase().replace(/\s+/g, "-");
    if (channels.some((c) => c.id === id)) return;
    setChannels([...channels, { id, label: newChannel.trim() }]);
    onChannelsChange([...selectedChannels, id]);
    setNewChannel("");
    setShowAdd(false);
  }

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-foreground">Post to social?</span>
        <div className="flex gap-2">
          <button
            onClick={() => onToggle(true)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              enabled
                ? "bg-accent text-white"
                : "border border-card-border text-muted hover:text-foreground"
            }`}
          >
            Yes
          </button>
          <button
            onClick={() => onToggle(false)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              !enabled
                ? "bg-card-hover text-foreground border border-card-border"
                : "border border-card-border text-muted hover:text-foreground"
            }`}
          >
            No
          </button>
        </div>
      </div>

      {enabled && (
        <>
          {/* Channel checkboxes */}
          <div>
            <label className="block text-sm text-muted mb-2">Select channels:</label>
            <div className="flex flex-wrap gap-3">
              {channels.map((channel) => (
                <label
                  key={channel.id}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all duration-150 text-sm ${
                    selectedChannels.includes(channel.id)
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-card-border bg-card-bg text-foreground hover:border-accent/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(channel.id)}
                    onChange={() => toggleChannel(channel.id)}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      selectedChannels.includes(channel.id)
                        ? "bg-accent border-accent"
                        : "border-muted"
                    }`}
                  >
                    {selectedChannels.includes(channel.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  {channel.label}
                </label>
              ))}

              {showAdd ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newChannel}
                    onChange={(e) => setNewChannel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addChannel()}
                    placeholder="Channel name"
                    autoFocus
                    className="px-3 py-2 rounded-lg border border-card-border bg-card-bg text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent w-36"
                  />
                  <button
                    onClick={addChannel}
                    className="px-3 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-hover transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAdd(false); setNewChannel(""); }}
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
                  <span>+</span> Add Channel
                </button>
              )}
            </div>
          </div>

          {/* Posting mode */}
          <div>
            <label className="block text-sm text-muted mb-2">
              Posting mode: <span className="text-muted/70 text-xs">(overrides global setting for this product)</span>
            </label>
            <div className="flex gap-3">
              <label
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                  postingMode === "auto"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-card-border bg-card-bg text-foreground hover:border-accent/30"
                }`}
              >
                <input
                  type="radio"
                  name="postingMode"
                  checked={postingMode === "auto"}
                  onChange={() => onPostingModeChange("auto")}
                  className="sr-only"
                />
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    postingMode === "auto" ? "border-accent" : "border-muted"
                  }`}
                >
                  {postingMode === "auto" && (
                    <span className="w-2 h-2 rounded-full bg-accent" />
                  )}
                </span>
                Auto
              </label>
              <label
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                  postingMode === "manual"
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-card-border bg-card-bg text-foreground hover:border-accent/30"
                }`}
              >
                <input
                  type="radio"
                  name="postingMode"
                  checked={postingMode === "manual"}
                  onChange={() => onPostingModeChange("manual")}
                  className="sr-only"
                />
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    postingMode === "manual" ? "border-accent" : "border-muted"
                  }`}
                >
                  {postingMode === "manual" && (
                    <span className="w-2 h-2 rounded-full bg-accent" />
                  )}
                </span>
                Manual
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
