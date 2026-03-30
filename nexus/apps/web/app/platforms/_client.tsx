"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import MockDataBanner from "@/components/MockDataBanner";
import { useApiQuery } from "@/lib/useApiQuery";
import { MOCK_PLATFORMS } from "@/lib/mock-data";
import { toast } from "sonner";
import type { PlatformFull } from "@/lib/api";

const EMPTY_PLATFORM: Omit<PlatformFull, "id"> = {
  name: "",
  slug: "",
  title_max_chars: null,
  tag_count: null,
  tag_max_chars: null,
  audience: "",
  tone: "",
  seo_style: "",
  description_style: "",
  cta_style: "",
  forbidden_words: "",
  is_active: true,
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function PlatformsClient() {
  const { data: fetchedPlatforms, loading, isUsingMock, refetch: fetchPlatforms } = useApiQuery(
    () => api.platforms.list(),
    MOCK_PLATFORMS,
  );

  const [platforms, setPlatforms] = useState<PlatformFull[]>(MOCK_PLATFORMS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<PlatformFull | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlatform, setNewPlatform] = useState<Omit<PlatformFull, "id">>(EMPTY_PLATFORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    setPlatforms(fetchedPlatforms);
  }, [fetchedPlatforms]);

  const handleEdit = (platform: PlatformFull) => {
    setEditingId(platform.id);
    setEditData({ ...platform });
    setShowAddForm(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData(null);
  };

  const handleSave = async () => {
    if (!editData || !editingId) return;
    setSaving(true);
    try {
      const response = await api.platforms.update(editingId, editData);
      if (response.success && response.data) {
        setPlatforms((prev) => prev.map((p) => (p.id === editingId ? response.data! : p)));
      } else {
        setPlatforms((prev) => prev.map((p) => (p.id === editingId ? editData : p)));
      }
    } catch {
      toast.error("Failed to save platform changes");
      setPlatforms((prev) => prev.map((p) => (p.id === editingId ? editData : p)));
    } finally {
      setSaving(false);
      setEditingId(null);
      setEditData(null);
    }
  };

  const handleToggleActive = async (platform: PlatformFull) => {
    const updated = { ...platform, is_active: !platform.is_active };
    setPlatforms((prev) => prev.map((p) => (p.id === platform.id ? updated : p)));
    try {
      await api.platforms.update(platform.id, { is_active: !platform.is_active });
    } catch {
      toast.error("Failed to toggle platform status");
      setPlatforms((prev) => prev.map((p) => (p.id === platform.id ? platform : p)));
    }
  };

  const handleAdd = async () => {
    if (!newPlatform.name.trim()) return;
    setSaving(true);
    const dataToSend = {
      ...newPlatform,
      slug: newPlatform.slug || generateSlug(newPlatform.name),
    };
    try {
      const response = await api.platforms.create(dataToSend);
      if (response.success && response.data) {
        setPlatforms((prev) => [...prev, response.data!]);
      } else {
        const mockId = `plat-${Date.now()}`;
        setPlatforms((prev) => [...prev, { id: mockId, ...dataToSend }]);
      }
    } catch {
      toast.error("Failed to add platform");
      const mockId = `plat-${Date.now()}`;
      setPlatforms((prev) => [...prev, { id: mockId, ...dataToSend }]);
    } finally {
      setSaving(false);
      setShowAddForm(false);
      setNewPlatform(EMPTY_PLATFORM);
    }
  };

  const handleDelete = async (id: string) => {
    setPlatforms((prev) => prev.filter((p) => p.id !== id));
    setDeleteConfirm(null);
    try {
      await api.platforms.delete(id);
    } catch {
      toast.error("Failed to delete platform");
      fetchPlatforms();
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Platform Manager</h1>
          <p className="text-muted text-sm mt-1">Configure platform rules for listing variation</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse">
              <div className="h-5 bg-card-border rounded w-32 mb-3" />
              <div className="h-4 bg-card-border rounded w-64" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Manager</h1>
          <p className="text-muted text-sm mt-1">
            Configure platform rules for listing variation &middot; {platforms.length} platform{platforms.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingId(null); }}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          + Add New Platform
        </button>
      </div>

      {isUsingMock && <MockDataBanner />}

      {showAddForm && (
        <div className="rounded-xl border border-accent/30 bg-card-bg p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Add New Platform</h3>
          <PlatformForm
            data={newPlatform}
            onChange={setNewPlatform}
            onSave={handleAdd}
            onCancel={() => { setShowAddForm(false); setNewPlatform(EMPTY_PLATFORM); }}
            saving={saving}
            isNew
          />
        </div>
      )}

      <div className="space-y-4">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            className="rounded-xl border border-card-border bg-card-bg overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${platform.is_active ? "bg-success" : "bg-muted"}`} />
                <h3 className="text-lg font-semibold text-foreground">{platform.name}</h3>
                <span className="text-xs text-muted font-mono bg-card-hover px-2 py-0.5 rounded">
                  {platform.slug}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  role="switch"
                  aria-checked={platform.is_active}
                  aria-label={`Toggle ${platform.name} active`}
                  onClick={() => handleToggleActive(platform)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    platform.is_active ? "bg-success" : "bg-card-border"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      platform.is_active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-xs text-muted mr-2">{platform.is_active ? "Active" : "Inactive"}</span>

                {editingId !== platform.id && (
                  <>
                    <button
                      onClick={() => handleEdit(platform)}
                      className="px-3 py-1.5 rounded-lg text-sm text-accent hover:bg-accent/10 transition-colors"
                    >
                      Edit
                    </button>
                    {deleteConfirm === platform.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(platform.id)}
                          className="px-3 py-1.5 rounded-lg text-sm text-danger bg-danger/10 hover:bg-danger/20 transition-colors"
                        >
                          Confirm Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1.5 rounded-lg text-sm text-muted hover:bg-card-hover transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(platform.id)}
                        className="px-3 py-1.5 rounded-lg text-sm text-danger hover:bg-danger/10 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {editingId === platform.id && editData ? (
              <div className="p-6">
                <PlatformForm
                  data={editData}
                  onChange={(updated) => setEditData({ ...editData, ...updated } as PlatformFull)}
                  onSave={handleSave}
                  onCancel={handleCancelEdit}
                  saving={saving}
                />
              </div>
            ) : (
              <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <Field label="Title Max Chars" value={platform.title_max_chars?.toString() ?? "\u2014"} />
                <Field label="Tag Count" value={platform.tag_count?.toString() ?? "\u2014"} />
                <Field label="Tag Max Chars" value={platform.tag_max_chars?.toString() ?? "\u2014"} />
                <Field label="Audience" value={platform.audience || "\u2014"} />
                <Field label="Tone" value={platform.tone || "\u2014"} />
                <Field label="SEO Style" value={platform.seo_style || "\u2014"} />
                <Field label="Description Style" value={platform.description_style || "\u2014"} />
                <Field label="CTA Style" value={platform.cta_style || "\u2014"} />
                <Field
                  label="Forbidden Words"
                  value={platform.forbidden_words || "\u2014"}
                  danger={!!platform.forbidden_words}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {platforms.length === 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
          <p className="text-muted text-sm">No platforms configured yet. Click &quot;Add New Platform&quot; to get started.</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-muted text-xs mb-1">{label}</dt>
      <dd className={`${danger ? "text-danger" : "text-foreground"} break-words`}>{value}</dd>
    </div>
  );
}

function PlatformForm({
  data,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  data: Omit<PlatformFull, "id"> | PlatformFull;
  onChange: (data: Omit<PlatformFull, "id">) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const update = (field: string, value: string | number | boolean | null) => {
    onChange({ ...data, [field]: value } as Omit<PlatformFull, "id">);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1">Name</label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => {
              update("name", e.target.value);
              if (isNew) update("slug", generateSlug(e.target.value));
            }}
            className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
            placeholder="e.g. Etsy"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Slug</label>
          <input
            type="text"
            value={data.slug}
            onChange={(e) => update("slug", e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent font-mono"
            placeholder="e.g. etsy"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1">Title Max Chars</label>
          <input
            type="number"
            value={data.title_max_chars ?? ""}
            onChange={(e) => update("title_max_chars", e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
            placeholder="e.g. 140"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Tag Count</label>
          <input
            type="number"
            value={data.tag_count ?? ""}
            onChange={(e) => update("tag_count", e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
            placeholder="e.g. 13"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Tag Max Chars</label>
          <input
            type="number"
            value={data.tag_max_chars ?? ""}
            onChange={(e) => update("tag_max_chars", e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
            placeholder="e.g. 20"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Audience Description</label>
        <textarea
          value={data.audience}
          onChange={(e) => update("audience", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent resize-y"
          placeholder="Who buys on this platform?"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Tone Description</label>
        <textarea
          value={data.tone}
          onChange={(e) => update("tone", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent resize-y"
          placeholder="What tone works on this platform?"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">SEO Style</label>
        <textarea
          value={data.seo_style}
          onChange={(e) => update("seo_style", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent resize-y"
          placeholder="What SEO strategy works here?"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Description Style</label>
        <textarea
          value={data.description_style}
          onChange={(e) => update("description_style", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent resize-y"
          placeholder="How should product descriptions be written?"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">CTA Style</label>
        <textarea
          value={data.cta_style}
          onChange={(e) => update("cta_style", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent resize-y"
          placeholder="What CTAs work on this platform?"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Forbidden Words (comma-separated)</label>
        <input
          type="text"
          value={data.forbidden_words}
          onChange={(e) => update("forbidden_words", e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
          placeholder="e.g. best, cheapest, guaranteed"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={saving || !data.name.trim()}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : isNew ? "Add Platform" : "Save Changes"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-muted hover:bg-card-hover transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
