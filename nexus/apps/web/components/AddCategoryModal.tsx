"use client";

import { useState } from "react";
import Modal from "@/components/Modal";

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string }) => void;
}

export default function AddCategoryModal({
  isOpen,
  onClose,
  onSubmit,
}: AddCategoryModalProps) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim() });
    setName("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Category">
      <form onSubmit={handleSubmit}>
        {/* Category Name */}
        <div className="mb-6">
          <label
            htmlFor="category-name"
            className="block text-sm font-medium text-foreground mb-2"
          >
            Category Name
          </label>
          <input
            id="category-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Planners & Calendars"
            className="w-full px-4 py-2.5 rounded-lg bg-card-bg border border-card-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
            autoFocus
          />
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
            Create Category
          </button>
        </div>
      </form>
    </Modal>
  );
}
