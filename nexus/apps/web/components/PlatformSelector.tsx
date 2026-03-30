"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";

const DEFAULT_PLATFORMS = [
  { name: "Etsy", slug: "etsy" },
  { name: "Gumroad", slug: "gumroad" },
  { name: "Payhip", slug: "payhip" },
  { name: "Shopify", slug: "shopify" },
  { name: "Amazon KDP", slug: "amazon-kdp" },
  { name: "TikTok Shop", slug: "tiktok-shop" },
];

interface PlatformSelectorProps {
  selected: string[];
  onChange: (platforms: string[]) => void;
}

export default function PlatformSelector({
  selected,
  onChange,
}: PlatformSelectorProps) {
  const { data: fetchedPlatforms } = useApiQuery(
    () => api.platforms.list(),
    DEFAULT_PLATFORMS,
  );
  const activePlatforms = fetchedPlatforms.filter(
    (p: { is_active?: boolean }) => p.is_active !== false,
  );
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORMS);
  const mergedPlatforms = [
    ...activePlatforms,
    ...platforms.filter(
      (p) => !activePlatforms.some((ap: { slug: string }) => ap.slug === p.slug),
    ),
  ];
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

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
    if (!platforms.find((p) => p.slug === slug)) {
      setPlatforms([...platforms, { name: newName.trim(), slug }]);
      onChange([...selected, slug]);
    }
    setNewName("");
    setAdding(false);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {mergedPlatforms.map((platform) => (
          <button
            key={platform.slug}
            type="button"
            onClick={() => toggle(platform.slug)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              selected.includes(platform.slug)
                ? "bg-accent/20 border-accent text-accent"
                : "bg-card-bg border-card-border text-muted hover:text-foreground hover:border-card-hover"
            }`}
          >
            {selected.includes(platform.slug) && (
              <span className="mr-1.5">&#10003;</span>
            )}
            {platform.name}
          </button>
        ))}
        {adding ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Platform name"
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
            + Add
          </button>
        )}
      </div>
    </div>
  );
}
