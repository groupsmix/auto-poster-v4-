"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import MockDataBanner from "@/components/MockDataBanner";
import { useApiQuery } from "@/lib/useApiQuery";
import { MOCK_CHANNELS } from "@/lib/mock-data";
import { toast } from "sonner";
import type { SocialChannelFull } from "@/lib/api";

const CONTENT_TYPE_OPTIONS = [
  "single image",
  "carousel",
  "reel script",
  "video script",
  "hook + 3 points + CTA",
  "pin description",
  "idea pin script",
  "text post",
  "document carousel",
  "article",
  "tweet",
  "thread",
  "story",
];

const EMPTY_CHANNEL: Omit<SocialChannelFull, "id"> = {
  name: "",
  slug: "",
  caption_max_chars: null,
  hashtag_count: null,
  tone: "",
  format: "",
  content_types: [],
  is_active: true,
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function SocialClient() {
  const { data: fetchedChannels, loading, isUsingMock, refetch: fetchChannels } = useApiQuery(
    () => api.socialChannels.list(),
    MOCK_CHANNELS,
  );

  const [channels, setChannels] = useState<SocialChannelFull[]>(MOCK_CHANNELS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<SocialChannelFull | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChannel, setNewChannel] = useState<Omit<SocialChannelFull, "id">>(EMPTY_CHANNEL);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [postingMode, setPostingMode] = useState<"auto" | "manual">("manual");

  useEffect(() => {
    setChannels(fetchedChannels);
  }, [fetchedChannels]);

  // Fetch posting mode setting on mount
  useEffect(() => {
    api.settings.get("posting_mode").then((modeRes) => {
      if (modeRes.success && modeRes.data) {
        setPostingMode(modeRes.data.value as "auto" | "manual");
      }
    }).catch(() => { toast.error("Failed to load posting mode"); });
  }, []);

  const handleTogglePostingMode = async () => {
    const next = postingMode === "auto" ? "manual" : "auto";
    setPostingMode(next);
    try {
      await api.settings.update("posting_mode", next);
    } catch {
      toast.error("Failed to update posting mode");
      setPostingMode(postingMode);
    }
  };

  const handleEdit = (channel: SocialChannelFull) => {
    setEditingId(channel.id);
    setEditData({ ...channel });
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
      const response = await api.socialChannels.update(editingId, editData);
      if (response.success && response.data) {
        setChannels((prev) => prev.map((c) => (c.id === editingId ? response.data! : c)));
      } else {
        setChannels((prev) => prev.map((c) => (c.id === editingId ? editData : c)));
      }
    } catch {
      toast.error("Failed to save channel changes");
      setChannels((prev) => prev.map((c) => (c.id === editingId ? editData : c)));
    } finally {
      setSaving(false);
      setEditingId(null);
      setEditData(null);
    }
  };

  const handleToggleActive = async (channel: SocialChannelFull) => {
    const updated = { ...channel, is_active: !channel.is_active };
    setChannels((prev) => prev.map((c) => (c.id === channel.id ? updated : c)));
    try {
      await api.socialChannels.update(channel.id, { is_active: !channel.is_active });
    } catch {
      toast.error("Failed to toggle channel status");
      setChannels((prev) => prev.map((c) => (c.id === channel.id ? channel : c)));
    }
  };

  const handleAdd = async () => {
    if (!newChannel.name.trim()) return;
    setSaving(true);
    const dataToSend = {
      ...newChannel,
      slug: newChannel.slug || generateSlug(newChannel.name),
    };
    try {
      const response = await api.socialChannels.create(dataToSend);
      if (response.success && response.data) {
        setChannels((prev) => [...prev, response.data!]);
      } else {
        const mockId = `social-${Date.now()}`;
        setChannels((prev) => [...prev, { id: mockId, ...dataToSend }]);
      }
    } catch {
      toast.error("Failed to add channel");
      const mockId = `social-${Date.now()}`;
      setChannels((prev) => [...prev, { id: mockId, ...dataToSend }]);
    } finally {
      setSaving(false);
      setShowAddForm(false);
      setNewChannel(EMPTY_CHANNEL);
    }
  };

  const handleDelete = async (id: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== id));
    setDeleteConfirm(null);
    try {
      await api.socialChannels.delete(id);
    } catch {
      toast.error("Failed to delete channel");
      fetchChannels();
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Social Channels</h1>
          <p className="text-muted text-sm mt-1">Configure social media channels and posting rules</p>
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
          <h1 className="text-2xl font-bold text-foreground">Social Channels</h1>
          <p className="text-muted text-sm mt-1">
            Configure social media channels and posting rules &middot; {channels.length} channel{channels.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toast.info("OAuth integration coming soon. For now, add channels manually using '+ Add New Channel'.")}
            className="px-4 py-2 rounded-lg border border-card-border text-sm text-muted hover:bg-card-hover transition-colors"
          >
            Connect Channel
          </button>
          <button
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
          >
            + Add New Channel
          </button>
        </div>
      </div>

      {isUsingMock && <MockDataBanner />}

      {/* Global posting mode toggle */}
      <div className="rounded-xl border border-card-border bg-card-bg px-6 py-4 mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Global Posting Mode</h3>
          <p className="text-xs text-muted mt-0.5">
            {postingMode === "auto"
              ? "Auto-post when CEO approves a product"
              : "Manual posting \u2014 you decide when to publish"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${postingMode === "manual" ? "text-foreground" : "text-muted"}`}>
            Manual
          </span>
          <button
            onClick={handleTogglePostingMode}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              postingMode === "auto" ? "bg-accent" : "bg-card-border"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                postingMode === "auto" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-xs font-medium ${postingMode === "auto" ? "text-foreground" : "text-muted"}`}>
            Auto
          </span>
        </div>
      </div>

      {/* Add new channel form */}
      {showAddForm && (
        <div className="rounded-xl border border-accent/30 bg-card-bg p-6 mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Add New Channel</h3>
          <ChannelForm
            data={newChannel}
            onChange={setNewChannel}
            onSave={handleAdd}
            onCancel={() => { setShowAddForm(false); setNewChannel(EMPTY_CHANNEL); }}
            saving={saving}
            isNew
          />
        </div>
      )}

      {/* Channel list */}
      <div className="space-y-4">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="rounded-xl border border-card-border bg-card-bg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${channel.is_active ? "bg-success" : "bg-muted"}`} />
                <h3 className="text-lg font-semibold text-foreground">{channel.name}</h3>
                <span className="text-xs text-muted font-mono bg-card-hover px-2 py-0.5 rounded">
                  {channel.slug}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(channel)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    channel.is_active ? "bg-success" : "bg-card-border"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      channel.is_active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-xs text-muted mr-2">{channel.is_active ? "Active" : "Inactive"}</span>

                {editingId !== channel.id && (
                  <>
                    <button
                      onClick={() => handleEdit(channel)}
                      className="px-3 py-1.5 rounded-lg text-sm text-accent hover:bg-accent/10 transition-colors"
                    >
                      Edit
                    </button>
                    {deleteConfirm === channel.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(channel.id)}
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
                        onClick={() => setDeleteConfirm(channel.id)}
                        className="px-3 py-1.5 rounded-lg text-sm text-danger hover:bg-danger/10 transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* View / Edit body */}
            {editingId === channel.id && editData ? (
              <div className="p-6">
                <ChannelForm
                  data={editData}
                  onChange={(updated) => setEditData({ ...editData, ...updated } as SocialChannelFull)}
                  onSave={handleSave}
                  onCancel={handleCancelEdit}
                  saving={saving}
                />
              </div>
            ) : (
              <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <Field label="Caption Max Chars" value={channel.caption_max_chars?.toString() ?? "\u2014"} />
                <Field label="Hashtag Count" value={channel.hashtag_count?.toString() ?? "\u2014"} />
                <Field label="Tone" value={channel.tone || "\u2014"} />
                <Field label="Format Template" value={channel.format || "\u2014"} />
                <div className="md:col-span-2">
                  <dt className="text-muted text-xs mb-1">Content Types</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {channel.content_types.length > 0 ? (
                      channel.content_types.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/10 text-accent"
                        >
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-foreground">{"\u2014"}</span>
                    )}
                  </dd>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {channels.length === 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
          <p className="text-muted text-sm">No channels configured yet. Click &quot;Add New Channel&quot; to get started.</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted text-xs mb-1">{label}</dt>
      <dd className="text-foreground break-words">{value}</dd>
    </div>
  );
}

function ChannelForm({
  data,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  data: Omit<SocialChannelFull, "id"> | SocialChannelFull;
  onChange: (data: Omit<SocialChannelFull, "id">) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew?: boolean;
}) {
  const update = (field: string, value: string | number | boolean | string[] | null) => {
    onChange({ ...data, [field]: value } as Omit<SocialChannelFull, "id">);
  };

  const toggleContentType = (type: string) => {
    const current = data.content_types;
    if (current.includes(type)) {
      update("content_types", current.filter((t) => t !== type));
    } else {
      update("content_types", [...current, type]);
    }
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
            placeholder="e.g. Instagram"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Slug</label>
          <input
            type="text"
            value={data.slug}
            onChange={(e) => update("slug", e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent font-mono"
            placeholder="e.g. instagram"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted mb-1">Caption / Post Max Chars</label>
          <input
            type="number"
            value={data.caption_max_chars ?? ""}
            onChange={(e) => update("caption_max_chars", e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
            placeholder="e.g. 2200"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Hashtag Count</label>
          <input
            type="number"
            value={data.hashtag_count ?? ""}
            onChange={(e) => update("hashtag_count", e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent"
            placeholder="e.g. 30"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Tone Description</label>
        <textarea
          value={data.tone}
          onChange={(e) => update("tone", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent resize-y"
          placeholder="What tone works on this channel?"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Format Template</label>
        <textarea
          value={data.format}
          onChange={(e) => update("format", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-background border border-card-border text-foreground text-sm focus:outline-none focus:border-accent resize-y"
          placeholder="e.g. Hook line -> value -> CTA -> hashtags"
        />
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Content Types</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {CONTENT_TYPE_OPTIONS.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleContentType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                data.content_types.includes(type)
                  ? "bg-accent text-white"
                  : "bg-card-hover text-muted hover:text-foreground"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={saving || !data.name.trim()}
          className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : isNew ? "Add Channel" : "Save Changes"}
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
