"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import MockDataBanner from "@/components/MockDataBanner";
import type { Domain, Category } from "@/lib/api";

// Mock data matching the architecture doc (Part 3)
const MOCK_DOMAINS: Domain[] = [
  { id: "dom-1", name: "Digital Planners & Journals", slug: "digital-planners", description: "Printable and digital planners, journals, and trackers", icon: "\uD83D\uDDD3\uFE0F", sort_order: 0, is_active: true, created_at: "2025-01-01T00:00:00Z" },
  { id: "dom-2", name: "Social Media Templates", slug: "social-media-templates", description: "Instagram, TikTok, Pinterest content templates", icon: "\uD83D\uDCF1", sort_order: 1, is_active: true, created_at: "2025-01-01T00:00:00Z" },
  { id: "dom-3", name: "Business & Finance Tools", slug: "business-finance", description: "Business plans, invoices, budgets, financial trackers", icon: "\uD83D\uDCBC", sort_order: 2, is_active: true, created_at: "2025-01-01T00:00:00Z" },
  { id: "dom-4", name: "Educational Resources", slug: "educational-resources", description: "Worksheets, flashcards, study guides, lesson plans", icon: "\uD83C\uDF93", sort_order: 3, is_active: true, created_at: "2025-01-01T00:00:00Z" },
  { id: "dom-5", name: "Art & Illustration Packs", slug: "art-illustration", description: "Clipart, illustrations, design elements, brushes", icon: "\uD83C\uDFA8", sort_order: 4, is_active: true, created_at: "2025-01-01T00:00:00Z" },
  { id: "dom-6", name: "Music & Audio Assets", slug: "music-audio", description: "Beats, loops, sound effects, production templates", icon: "\uD83C\uDFB5", sort_order: 5, is_active: true, created_at: "2025-01-01T00:00:00Z" },
  { id: "dom-7", name: "Website & UI Kits", slug: "website-ui-kits", description: "Website templates, UI components, landing pages", icon: "\uD83D\uDDA5\uFE0F", sort_order: 6, is_active: true, created_at: "2025-01-01T00:00:00Z" },
  { id: "dom-8", name: "Print-on-Demand Designs", slug: "print-on-demand", description: "T-shirt designs, stickers, mug prints, phone cases", icon: "\uD83D\uDC55", sort_order: 7, is_active: true, created_at: "2025-01-01T00:00:00Z" },
  { id: "dom-9", name: "eBooks & Written Content", slug: "ebooks-written", description: "eBooks, guides, whitepapers, written courses", icon: "\uD83D\uDCDA", sort_order: 8, is_active: true, created_at: "2025-01-01T00:00:00Z" },
  { id: "dom-10", name: "Photography & Stock Media", slug: "photography-stock", description: "Stock photos, video clips, Lightroom presets", icon: "\uD83D\uDCF7", sort_order: 9, is_active: false, created_at: "2025-01-01T00:00:00Z" },
];

const MOCK_CATEGORIES: Record<string, Category[]> = {
  "dom-1": [
    { id: "cat-1-1", domain_id: "dom-1", name: "Daily Planners", slug: "daily-planners", description: "Day-by-day planning templates", sort_order: 0, is_active: true },
    { id: "cat-1-2", domain_id: "dom-1", name: "Budget Trackers", slug: "budget-trackers", description: "Personal finance tracking sheets", sort_order: 1, is_active: true },
    { id: "cat-1-3", domain_id: "dom-1", name: "Habit Trackers", slug: "habit-trackers", description: "Daily habit tracking templates", sort_order: 2, is_active: true },
    { id: "cat-1-4", domain_id: "dom-1", name: "Gratitude Journals", slug: "gratitude-journals", description: "Guided gratitude journaling", sort_order: 3, is_active: true },
  ],
  "dom-2": [
    { id: "cat-2-1", domain_id: "dom-2", name: "Instagram Post Templates", slug: "instagram-posts", description: "Feed post templates", sort_order: 0, is_active: true },
    { id: "cat-2-2", domain_id: "dom-2", name: "Story Templates", slug: "story-templates", description: "Instagram/TikTok story layouts", sort_order: 1, is_active: true },
    { id: "cat-2-3", domain_id: "dom-2", name: "Pinterest Pin Templates", slug: "pinterest-pins", description: "Tall-format pin designs", sort_order: 2, is_active: true },
  ],
  "dom-3": [
    { id: "cat-3-1", domain_id: "dom-3", name: "Business Plans", slug: "business-plans", description: "Startup and business plan templates", sort_order: 0, is_active: true },
    { id: "cat-3-2", domain_id: "dom-3", name: "Invoice Templates", slug: "invoices", description: "Professional invoice designs", sort_order: 1, is_active: true },
  ],
};

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingMock, setIsUsingMock] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Domain CRUD state
  const [editingDomainId, setEditingDomainId] = useState<string | null>(null);
  const [editDomainData, setEditDomainData] = useState<Partial<Domain>>({});
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState({ name: "", description: "", icon: "" });
  const [deleteDomainConfirm, setDeleteDomainConfirm] = useState<string | null>(null);

  // Category CRUD state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryData, setEditCategoryData] = useState<Partial<Category>>({});
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  // Drag state
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragType, setDragType] = useState<"domain" | "category" | null>(null);

  const fetchDomains = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.domains.list();
      if (response.success && response.data) {
        setDomains(response.data);
        setIsUsingMock(false);
        if (response.data.length > 0 && !selectedDomain) {
          setSelectedDomain(response.data[0]);
        }
      } else {
        setDomains(MOCK_DOMAINS);
        setIsUsingMock(true);
        if (!selectedDomain) setSelectedDomain(MOCK_DOMAINS[0]);
      }
    } catch {
      setDomains(MOCK_DOMAINS);
      setIsUsingMock(true);
      if (!selectedDomain) setSelectedDomain(MOCK_DOMAINS[0]);
    } finally {
      setLoading(false);
    }
  }, [selectedDomain]);

  const fetchCategories = useCallback(async (domainId: string) => {
    setLoadingCategories(true);
    try {
      const response = await api.categories.list(domainId);
      if (response.success && response.data) {
        setCategories(response.data);
      } else {
        setCategories(MOCK_CATEGORIES[domainId] ?? []);
      }
    } catch {
      setCategories(MOCK_CATEGORIES[domainId] ?? []);
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  useEffect(() => {
    if (selectedDomain) {
      fetchCategories(selectedDomain.id);
      setEditingCategoryId(null);
      setShowAddCategory(false);
    }
  }, [selectedDomain, fetchCategories]);

  // Domain handlers
  const handleSelectDomain = (domain: Domain) => {
    setSelectedDomain(domain);
    setEditingDomainId(null);
    setShowAddDomain(false);
  };

  const handleToggleDomainActive = async (domain: Domain) => {
    const updated = { ...domain, is_active: !domain.is_active };
    setDomains((prev) => prev.map((d) => (d.id === domain.id ? updated : d)));
    if (selectedDomain?.id === domain.id) setSelectedDomain(updated);
    try {
      await api.domains.update(domain.id, { is_active: !domain.is_active });
    } catch {
      setDomains((prev) => prev.map((d) => (d.id === domain.id ? domain : d)));
      if (selectedDomain?.id === domain.id) setSelectedDomain(domain);
    }
  };

  const handleSaveDomain = async () => {
    if (!editingDomainId || !editDomainData.name?.trim()) return;
    setSaving(true);
    const updated = { ...domains.find((d) => d.id === editingDomainId)!, ...editDomainData };
    setDomains((prev) => prev.map((d) => (d.id === editingDomainId ? updated : d)));
    if (selectedDomain?.id === editingDomainId) setSelectedDomain(updated);
    try {
      await api.domains.update(editingDomainId, editDomainData);
    } catch {
      // keep optimistic update
    } finally {
      setSaving(false);
      setEditingDomainId(null);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.name.trim()) return;
    setSaving(true);
    try {
      const response = await api.domains.create(newDomain);
      if (response.success && response.data) {
        setDomains((prev) => [...prev, response.data!]);
      } else {
        const mock: Domain = {
          id: `dom-${Date.now()}`,
          name: newDomain.name,
          slug: newDomain.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          description: newDomain.description,
          icon: newDomain.icon,
          sort_order: domains.length,
          is_active: true,
          created_at: new Date().toISOString(),
        };
        setDomains((prev) => [...prev, mock]);
      }
    } catch {
      const mock: Domain = {
        id: `dom-${Date.now()}`,
        name: newDomain.name,
        slug: newDomain.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        description: newDomain.description,
        icon: newDomain.icon,
        sort_order: domains.length,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setDomains((prev) => [...prev, mock]);
    } finally {
      setSaving(false);
      setShowAddDomain(false);
      setNewDomain({ name: "", description: "", icon: "" });
    }
  };

  const handleDeleteDomain = async (id: string) => {
    const wasSelected = selectedDomain?.id === id;
    setDomains((prev) => prev.filter((d) => d.id !== id));
    setDeleteDomainConfirm(null);
    if (wasSelected) {
      const remaining = domains.filter((d) => d.id !== id);
      setSelectedDomain(remaining.length > 0 ? remaining[0] : null);
    }
    try {
      await api.domains.delete(id);
    } catch {
      fetchDomains();
    }
  };

  // Category handlers
  const handleToggleCategoryActive = async (category: Category) => {
    const updated = { ...category, is_active: !category.is_active };
    setCategories((prev) => prev.map((c) => (c.id === category.id ? updated : c)));
    try {
      if (selectedDomain) {
        await api.categories.update(selectedDomain.id, category.id, { is_active: !category.is_active });
      }
    } catch {
      setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)));
    }
  };

  const handleSaveCategory = async () => {
    if (!editingCategoryId || !editCategoryData.name?.trim() || !selectedDomain) return;
    setSaving(true);
    const updated = { ...categories.find((c) => c.id === editingCategoryId)!, ...editCategoryData };
    setCategories((prev) => prev.map((c) => (c.id === editingCategoryId ? updated : c)));
    try {
      await api.categories.update(selectedDomain.id, editingCategoryId, editCategoryData);
    } catch {
      // keep optimistic update
    } finally {
      setSaving(false);
      setEditingCategoryId(null);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name.trim() || !selectedDomain) return;
    setSaving(true);
    try {
      const response = await api.categories.create(selectedDomain.id, newCategory);
      if (response.success && response.data) {
        setCategories((prev) => [...prev, response.data!]);
      } else {
        const mock: Category = {
          id: `cat-${Date.now()}`,
          domain_id: selectedDomain.id,
          name: newCategory.name,
          slug: newCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          description: newCategory.description,
          sort_order: categories.length,
          is_active: true,
        };
        setCategories((prev) => [...prev, mock]);
      }
    } catch {
      const mock: Category = {
        id: `cat-${Date.now()}`,
        domain_id: selectedDomain.id,
        name: newCategory.name,
        slug: newCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        description: newCategory.description,
        sort_order: categories.length,
        is_active: true,
      };
      setCategories((prev) => [...prev, mock]);
    } finally {
      setSaving(false);
      setShowAddCategory(false);
      setNewCategory({ name: "", description: "" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setDeleteCategoryConfirm(null);
    try {
      if (selectedDomain) {
        await api.categories.delete(selectedDomain.id, id);
      }
    } catch {
      if (selectedDomain) fetchCategories(selectedDomain.id);
    }
  };

  // Drag handlers for domains
  const handleDomainDragStart = (index: number) => {
    dragItem.current = index;
    setDragType("domain");
  };

  const handleDomainDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItem.current = index;
  };

  const handleDomainDrop = async () => {
    if (dragItem.current === null || dragOverItem.current === null || dragType !== "domain") return;
    const items = [...domains];
    const draggedItem = items[dragItem.current];
    items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, draggedItem);
    const reordered = items.map((item, i) => ({ ...item, sort_order: i }));
    setDomains(reordered);
    dragItem.current = null;
    dragOverItem.current = null;
    setDragType(null);
    try {
      await api.domains.reorder(reordered.map((d) => d.id));
    } catch {
      // keep local order
    }
  };

  // Drag handlers for categories
  const handleCategoryDragStart = (index: number) => {
    dragItem.current = index;
    setDragType("category");
  };

  const handleCategoryDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverItem.current = index;
  };

  const handleCategoryDrop = async () => {
    if (dragItem.current === null || dragOverItem.current === null || dragType !== "category" || !selectedDomain) return;
    const items = [...categories];
    const draggedItem = items[dragItem.current];
    items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, draggedItem);
    const reordered = items.map((item, i) => ({ ...item, sort_order: i }));
    setCategories(reordered);
    dragItem.current = null;
    dragOverItem.current = null;
    setDragType(null);
    try {
      await api.categories.reorder(selectedDomain.id, reordered.map((c) => c.id));
    } catch {
      // keep local order
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Domains &amp; Categories</h1>
          <p className="text-muted text-sm mt-1">Manage product domains and their categories</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border border-card-border bg-card-bg p-4 animate-pulse">
                <div className="h-4 bg-card-border rounded w-40" />
              </div>
            ))}
          </div>
          <div className="lg:col-span-2 rounded-xl border border-card-border bg-card-bg p-8 animate-pulse">
            <div className="h-5 bg-card-border rounded w-48 mb-4" />
            <div className="h-4 bg-card-border rounded w-64" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Domains &amp; Categories</h1>
        <p className="text-muted text-sm mt-1">
          Manage product domains and their categories &middot; {domains.length} domain{domains.length !== 1 ? "s" : ""}
        </p>
      </div>

      {isUsingMock && <MockDataBanner />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left panel: Domains */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Domains</h2>
            <button
              onClick={() => setShowAddDomain(true)}
              className="px-3 py-1 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
            >
              + Add
            </button>
          </div>

          {showAddDomain && (
            <div className="rounded-lg border border-accent/30 bg-card-bg p-3 space-y-2">
              <input
                type="text"
                value={newDomain.name}
                onChange={(e) => setNewDomain({ ...newDomain, name: e.target.value })}
                className="w-full px-2 py-1.5 rounded bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
                placeholder="Domain name"
              />
              <input
                type="text"
                value={newDomain.description}
                onChange={(e) => setNewDomain({ ...newDomain, description: e.target.value })}
                className="w-full px-2 py-1.5 rounded bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
                placeholder="Description"
              />
              <input
                type="text"
                value={newDomain.icon}
                onChange={(e) => setNewDomain({ ...newDomain, icon: e.target.value })}
                className="w-full px-2 py-1.5 rounded bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
                placeholder="Icon (emoji)"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddDomain}
                  disabled={saving || !newDomain.name.trim()}
                  className="px-3 py-1 rounded bg-accent text-white text-xs font-medium hover:bg-accent-hover disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add Domain"}
                </button>
                <button
                  onClick={() => { setShowAddDomain(false); setNewDomain({ name: "", description: "", icon: "" }); }}
                  className="px-3 py-1 rounded text-xs text-muted hover:bg-card-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {domains
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((domain, index) => (
              <div
                key={domain.id}
                draggable
                onDragStart={() => handleDomainDragStart(index)}
                onDragOver={(e) => handleDomainDragOver(e, index)}
                onDrop={handleDomainDrop}
                onDragEnd={() => { dragItem.current = null; dragOverItem.current = null; setDragType(null); }}
                onClick={() => handleSelectDomain(domain)}
                className={`rounded-lg border p-3 cursor-pointer transition-colors group ${
                  selectedDomain?.id === domain.id
                    ? "border-accent bg-accent/5"
                    : "border-card-border bg-card-bg hover:bg-card-hover"
                }`}
              >
                {editingDomainId === domain.id ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editDomainData.name ?? domain.name}
                      onChange={(e) => setEditDomainData({ ...editDomainData, name: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
                    />
                    <input
                      type="text"
                      value={editDomainData.description ?? domain.description ?? ""}
                      onChange={(e) => setEditDomainData({ ...editDomainData, description: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
                      placeholder="Description"
                    />
                    <input
                      type="text"
                      value={editDomainData.icon ?? domain.icon ?? ""}
                      onChange={(e) => setEditDomainData({ ...editDomainData, icon: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
                      placeholder="Icon (emoji)"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveDomain} disabled={saving} className="px-2 py-1 rounded bg-accent text-white text-xs hover:bg-accent-hover disabled:opacity-50">
                        {saving ? "..." : "Save"}
                      </button>
                      <button onClick={() => setEditingDomainId(null)} className="px-2 py-1 rounded text-xs text-muted hover:bg-card-hover">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="cursor-grab text-muted hover:text-foreground text-xs" title="Drag to reorder">{"\u2630"}</span>
                      <span className="text-lg">{domain.icon || "\uD83D\uDCC1"}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{domain.name}</div>
                        {domain.description && (
                          <div className="text-xs text-muted truncate">{domain.description}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleDomainActive(domain); }}
                        className={`w-2 h-2 rounded-full ${domain.is_active ? "bg-success" : "bg-muted"}`}
                        title={domain.is_active ? "Active" : "Inactive"}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingDomainId(domain.id); setEditDomainData({ name: domain.name, description: domain.description, icon: domain.icon }); }}
                        className="p-1 text-xs text-muted hover:text-accent"
                        title="Edit"
                      >
                        {"\u270E"}
                      </button>
                      {deleteDomainConfirm === domain.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => handleDeleteDomain(domain.id)} className="px-1.5 py-0.5 rounded text-[10px] text-danger bg-danger/10 hover:bg-danger/20">
                            Yes
                          </button>
                          <button onClick={() => setDeleteDomainConfirm(null)} className="px-1.5 py-0.5 rounded text-[10px] text-muted hover:bg-card-hover">
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteDomainConfirm(domain.id); }}
                          className="p-1 text-xs text-muted hover:text-danger"
                          title="Delete (will delete all categories + products)"
                        >
                          {"\uD83D\uDDD1"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

          {domains.length === 0 && !showAddDomain && (
            <div className="rounded-lg border border-card-border bg-card-bg p-4 text-center">
              <p className="text-muted text-xs">No domains yet</p>
            </div>
          )}
        </div>

        {/* Right panel: Categories for selected domain */}
        <div className="lg:col-span-2">
          {selectedDomain ? (
            <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
              <div className="px-6 py-4 border-b border-card-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <span>{selectedDomain.icon || "\uD83D\uDCC1"}</span>
                    {selectedDomain.name}
                  </h2>
                  {selectedDomain.description && (
                    <p className="text-xs text-muted mt-0.5">{selectedDomain.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowAddCategory(true)}
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
                >
                  + Add Category
                </button>
              </div>

              <div className="p-4 space-y-2">
                {showAddCategory && (
                  <div className="rounded-lg border border-accent/30 bg-background p-3 space-y-2">
                    <input
                      type="text"
                      value={newCategory.name}
                      onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      className="w-full px-2 py-1.5 rounded bg-card-bg border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
                      placeholder="Category name"
                    />
                    <input
                      type="text"
                      value={newCategory.description}
                      onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                      className="w-full px-2 py-1.5 rounded bg-card-bg border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddCategory}
                        disabled={saving || !newCategory.name.trim()}
                        className="px-3 py-1 rounded bg-accent text-white text-xs font-medium hover:bg-accent-hover disabled:opacity-50"
                      >
                        {saving ? "Adding..." : "Add Category"}
                      </button>
                      <button
                        onClick={() => { setShowAddCategory(false); setNewCategory({ name: "", description: "" }); }}
                        className="px-3 py-1 rounded text-xs text-muted hover:bg-card-hover"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {loadingCategories ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-lg border border-card-border p-3 animate-pulse">
                        <div className="h-4 bg-card-border rounded w-40" />
                      </div>
                    ))}
                  </div>
                ) : (
                  categories
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((category, index) => (
                      <div
                        key={category.id}
                        draggable
                        onDragStart={() => handleCategoryDragStart(index)}
                        onDragOver={(e) => handleCategoryDragOver(e, index)}
                        onDrop={handleCategoryDrop}
                        onDragEnd={() => { dragItem.current = null; dragOverItem.current = null; setDragType(null); }}
                        className="rounded-lg border border-card-border bg-background p-3 group hover:bg-card-hover transition-colors"
                      >
                        {editingCategoryId === category.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editCategoryData.name ?? category.name}
                              onChange={(e) => setEditCategoryData({ ...editCategoryData, name: e.target.value })}
                              className="w-full px-2 py-1 rounded bg-card-bg border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
                            />
                            <input
                              type="text"
                              value={editCategoryData.description ?? category.description ?? ""}
                              onChange={(e) => setEditCategoryData({ ...editCategoryData, description: e.target.value })}
                              className="w-full px-2 py-1 rounded bg-card-bg border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
                              placeholder="Description"
                            />
                            <div className="flex gap-2">
                              <button onClick={handleSaveCategory} disabled={saving} className="px-2 py-1 rounded bg-accent text-white text-xs hover:bg-accent-hover disabled:opacity-50">
                                {saving ? "..." : "Save"}
                              </button>
                              <button onClick={() => setEditingCategoryId(null)} className="px-2 py-1 rounded text-xs text-muted hover:bg-card-hover">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="cursor-grab text-muted hover:text-foreground text-xs" title="Drag to reorder">{"\u2630"}</span>
                              <div>
                                <div className="text-sm font-medium text-foreground">{category.name}</div>
                                {category.description && (
                                  <div className="text-xs text-muted">{category.description}</div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleToggleCategoryActive(category)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                  category.is_active ? "bg-success" : "bg-card-border"
                                }`}
                              >
                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${category.is_active ? "translate-x-5" : "translate-x-1"}`} />
                              </button>
                              <button
                                onClick={() => { setEditingCategoryId(category.id); setEditCategoryData({ name: category.name, description: category.description }); }}
                                className="p-1 text-xs text-muted hover:text-accent"
                                title="Edit"
                              >
                                {"\u270E"}
                              </button>
                              {deleteCategoryConfirm === category.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleDeleteCategory(category.id)} className="px-1.5 py-0.5 rounded text-[10px] text-danger bg-danger/10 hover:bg-danger/20">
                                    Yes
                                  </button>
                                  <button onClick={() => setDeleteCategoryConfirm(null)} className="px-1.5 py-0.5 rounded text-[10px] text-muted hover:bg-card-hover">
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteCategoryConfirm(category.id)}
                                  className="p-1 text-xs text-muted hover:text-danger"
                                  title="Delete (will delete all products in this category)"
                                >
                                  {"\uD83D\uDDD1"}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                )}

                {!loadingCategories && categories.length === 0 && !showAddCategory && (
                  <div className="text-center py-8">
                    <p className="text-muted text-sm">No categories in this domain yet.</p>
                    <button
                      onClick={() => setShowAddCategory(true)}
                      className="mt-2 text-accent text-sm hover:underline"
                    >
                      Add the first category
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
              <p className="text-muted text-sm">Select a domain to view its categories, or add a new domain.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
