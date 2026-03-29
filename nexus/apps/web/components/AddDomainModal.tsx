"use client";

import { useState } from "react";

interface AddDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; icon: string }) => void;
}

const EMOJI_OPTIONS = [
  "\u{1F4E6}", "\u{1F455}", "\u{1F3AC}", "\u{1F4BC}", "\u{1F517}",
  "\u{1F6D2}", "\u{1F4DA}", "\u{1F52C}", "\u2699\uFE0F", "\u{1F680}",
  "\u{1F3AF}", "\u{1F4A1}", "\u{1F4B0}", "\u{1F30D}", "\u{1F916}",
  "\u{1F3A8}", "\u{1F4F1}", "\u{1F4CA}", "\u{1F512}", "\u2728",
];

export default function AddDomainModal({
  isOpen,
  onClose,
  onSubmit,
}: AddDomainModalProps) {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(EMOJI_OPTIONS[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), icon: selectedIcon });
    setName("");
    setSelectedIcon(EMOJI_OPTIONS[0]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-sidebar-bg border border-card-border rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">
            Add New Domain
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Domain Name */}
          <div className="mb-5">
            <label
              htmlFor="domain-name"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Domain Name
            </label>
            <input
              id="domain-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Health & Wellness"
              className="w-full px-4 py-2.5 rounded-lg bg-card-bg border border-card-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              autoFocus
            />
          </div>

          {/* Icon Picker */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Icon
            </label>
            <div className="grid grid-cols-10 gap-1.5">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedIcon(emoji)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all ${
                    selectedIcon === emoji
                      ? "bg-accent/20 ring-2 ring-accent"
                      : "hover:bg-card-hover"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-card-border text-muted text-sm font-medium hover:text-foreground hover:bg-card-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create Domain
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
