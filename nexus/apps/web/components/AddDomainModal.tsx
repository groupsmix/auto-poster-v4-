"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import DomainIcon, { DOMAIN_ICON_OPTIONS } from "@/components/icons/DomainIcon";

interface AddDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; icon: string }) => void;
}

export default function AddDomainModal({
  isOpen,
  onClose,
  onSubmit,
}: AddDomainModalProps) {
  const [name, setName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(DOMAIN_ICON_OPTIONS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), icon: selectedIcon });
    setName("");
    setSelectedIcon(DOMAIN_ICON_OPTIONS[0]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Domain">
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
          <div className="grid grid-cols-5 gap-2">
            {DOMAIN_ICON_OPTIONS.map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => setSelectedIcon(slug)}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-all ${
                  selectedIcon === slug
                    ? "bg-accent/20 ring-2 ring-accent text-accent"
                    : "hover:bg-card-hover text-muted hover:text-foreground"
                }`}
              >
                <DomainIcon slug={slug} className="w-5 h-5" />
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
    </Modal>
  );
}
