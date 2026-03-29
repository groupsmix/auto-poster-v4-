"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEFAULT_DOMAINS } from "@/lib/domains";
import { DEFAULT_CATEGORIES, CategoryData } from "@/lib/categories";
import { api } from "@/lib/api";
import CategoryCard, { AddCategoryCard } from "@/components/CategoryCard";

export default function DomainPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = use(params);
  const router = useRouter();

  // Find the domain data from defaults
  const domainData = DEFAULT_DOMAINS.find((d) => d.slug === domain);
  const displayName = domainData?.name || domain.replace(/-/g, " ");

  const [categories, setCategories] = useState<CategoryData[]>(
    DEFAULT_CATEGORIES[domain] || []
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📁");
  const [hasFetched, setHasFetched] = useState(false);

  const ICON_OPTIONS = [
    "📁", "📝", "📄", "🎓", "📅", "💡", "💻", "✅", "📊", "🎨",
    "📸", "🎬", "🎵", "🌐", "📢", "💰", "🧶", "🔌", "⚡", "🔮",
  ];

  useEffect(() => {
    if (hasFetched) return;
    let cancelled = false;

    api.categories.list(domain).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setCategories(
          result.data.map((c) => ({
            name: c.name,
            slug: c.slug,
            icon: "📁",
          }))
        );
      }
      setHasFetched(true);
    });

    return () => { cancelled = true; };
  }, [domain, hasFetched]);

  function handleCategoryClick(slug: string) {
    router.push(`/${domain}/${slug}`);
  }

  function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    const slug = newCategoryName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const newCategory: CategoryData = {
      name: newCategoryName.trim(),
      slug,
      icon: newCategoryIcon,
    };

    setCategories([...categories, newCategory]);
    setNewCategoryName("");
    setNewCategoryIcon("📁");
    setShowAddModal(false);
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link
          href="/"
          className="hover:text-foreground transition-colors"
        >
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground">{displayName}</span>
      </div>

      {/* Back button + Title */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/"
          className="p-2 rounded-lg border border-card-border hover:bg-card-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {domainData?.icon && (
              <span className="mr-2">{domainData.icon}</span>
            )}
            {displayName}
          </h1>
          <p className="text-muted text-sm mt-0.5">
            Select a category to create a product
          </p>
        </div>
      </div>

      {/* Category cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.slug}
            name={cat.name}
            icon={cat.icon}
            onClick={() => handleCategoryClick(cat.slug)}
          />
        ))}
        <AddCategoryCard onClick={() => setShowAddModal(true)} />
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="bg-card-bg border border-card-border rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">Add New Category</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                  placeholder="e.g. Notion Templates"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Icon
                </label>
                <div className="flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewCategoryIcon(icon)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl cursor-pointer transition-all ${
                        newCategoryIcon === icon
                          ? "bg-accent/20 border-2 border-accent"
                          : "bg-background border border-card-border hover:border-accent/30"
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="flex-1 py-2.5 rounded-lg bg-accent text-white font-medium text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Add Category
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 rounded-lg border border-card-border text-foreground text-sm hover:bg-card-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
