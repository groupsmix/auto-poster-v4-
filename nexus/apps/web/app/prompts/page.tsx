"use client";

import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import MockDataBanner from "@/components/MockDataBanner";
import Modal from "@/components/Modal";
import { SearchIcon } from "@/components/icons/Icons";
import { useApiQuery } from "@/lib/useApiQuery";
import { MOCK_PROMPTS, MOCK_VERSIONS } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import type { PromptTemplate, PromptVersion } from "@/lib/api";

// Prompt layer configuration matching the architecture doc (Layers A-I)
const PROMPT_LAYERS = [
  { key: "master", label: "Master Prompt", description: "Layer A — applies to ALL tasks, ALL domains" },
  { key: "role", label: "Role Prompts", description: "Layer B — one per role type" },
  { key: "domain", label: "Domain Prompts", description: "Layer C — one per domain" },
  { key: "category", label: "Category Prompts", description: "Layer D — one per category" },
  { key: "platform", label: "Platform Prompts", description: "Layer E — one per platform" },
  { key: "social", label: "Social Prompts", description: "One per social channel" },
  { key: "context", label: "Context Injection", description: "Layer I (V4) — template for injecting prior step context" },
  { key: "review", label: "Review / CEO Prompt", description: "The CEO review prompt used on every output" },
] as const;

function LayerIcon({ layer }: { layer: string }) {
  const labels: Record<string, string> = {
    master: "A",
    role: "B",
    domain: "C",
    category: "D",
    platform: "E",
    social: "S",
    context: "I",
    review: "R",
  };
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-accent/10 text-accent text-xs font-bold">
      {labels[layer] ?? "?"}
    </span>
  );
}

export default function PromptsPage() {
  const { data: fetchedPrompts, loading, isUsingMock } = useApiQuery(
    () => api.prompts.list(),
    MOCK_PROMPTS,
  );

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [activeLayer, setActiveLayer] = useState<string>("master");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setPrompts(fetchedPrompts);
  }, [fetchedPrompts]);

  // Filter prompts by search query across all layers (5.7)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q)
    );
  }, [prompts, searchQuery]);

  const layerPrompts = searchResults ?? prompts.filter((p) => p.layer === activeLayer);

  const handleEdit = (prompt: PromptTemplate) => {
    setEditingId(prompt.id);
    setEditText(prompt.prompt);
    setShowHistory(null);
    setTestResult(null);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      const response = await api.prompts.update(id, { prompt: editText });
      if (response.success && response.data) {
        setPrompts((prev) =>
          prev.map((p) => (p.id === id ? response.data! : p))
        );
      } else {
        setPrompts((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, prompt: editText, version: p.version + 1, updated_at: new Date().toISOString() }
              : p
          )
        );
      }
    } catch {
      toast.error("Failed to save prompt");
      setPrompts((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, prompt: editText, version: p.version + 1, updated_at: new Date().toISOString() }
            : p
        )
      );
    } finally {
      setSaving(false);
      setEditingId(null);
    }
  };

  const handleShowHistory = async (id: string) => {
    if (showHistory === id) {
      setShowHistory(null);
      return;
    }
    setShowHistory(id);
    setLoadingVersions(true);
    try {
      const response = await api.prompts.history(id);
      if (response.success && response.data) {
        setVersions(response.data);
      } else {
        setVersions(MOCK_VERSIONS[id] ?? []);
      }
    } catch {
      toast.error("Failed to load version history");
      setVersions(MOCK_VERSIONS[id] ?? []);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRevert = async (promptId: string, version: number) => {
    const versionData = versions.find((v) => v.version === version);
    if (!versionData) return;

    try {
      await api.prompts.revert(promptId, version);
    } catch {
      toast.error("Failed to revert prompt version");
    }

    setPrompts((prev) =>
      prev.map((p) =>
        p.id === promptId
          ? { ...p, prompt: versionData.prompt, version, updated_at: new Date().toISOString() }
          : p
      )
    );
    setShowHistory(null);
  };

  const handleTest = async (id: string) => {
    // 5.9: Show honest message in mock mode
    if (isUsingMock) {
      toast.info("Test unavailable — connect to Workers to test prompts");
      return;
    }
    setTestingId(id);
    setTestResult(null);
    try {
      const response = await api.prompts.test(id);
      if (response.success && response.data) {
        setTestResult(response.data.assembled);
      } else {
        toast.error("Test failed — no data returned");
      }
    } catch {
      toast.error("Test failed — could not reach Workers");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Prompt Manager</h1>
        <p className="text-muted text-sm mt-1">
          Edit prompts across all 9 layers (A-I) of the layered prompt architecture
        </p>
      </div>

      {isUsingMock && <MockDataBanner />}

      {/* Search (5.7) */}
      <div className="mb-4">
        <div className="relative max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search prompts by name or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-card-bg border border-card-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Layer Tabs */}
      <div className={`mb-6 flex flex-wrap gap-2 ${searchQuery ? "opacity-50 pointer-events-none" : ""}`} role="tablist" aria-label="Prompt layers">
        {PROMPT_LAYERS.map((layer) => {
          const count = prompts.filter((p) => p.layer === layer.key).length;
          return (
            <button
              key={layer.key}
              role="tab"
              aria-selected={activeLayer === layer.key}
              onClick={() => {
                setActiveLayer(layer.key);
                setEditingId(null);
                setShowHistory(null);
                setTestResult(null);
              }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeLayer === layer.key
                  ? "bg-accent text-white"
                  : "bg-card-bg border border-card-border text-muted hover:text-foreground hover:bg-card-hover"
              }`}
            >
              <LayerIcon layer={layer.key} />
              {layer.label}
              {count > 1 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeLayer === layer.key ? "bg-white/20" : "bg-card-hover"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Layer description */}
      <div className="mb-4 text-sm text-muted">
        {PROMPT_LAYERS.find((l) => l.key === activeLayer)?.description}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse"
            >
              <div className="h-5 bg-card-hover rounded w-48 mb-3" />
              <div className="h-32 bg-card-hover rounded w-full mb-3" />
              <div className="h-4 bg-card-hover rounded w-32" />
            </div>
          ))}
        </div>
      )}

      {/* Prompt Cards */}
      {!loading && layerPrompts.length === 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
          <p className="text-muted text-sm">No prompts for this layer yet.</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          {layerPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-xl border border-card-border bg-card-bg overflow-hidden"
            >
              {/* Prompt header */}
              <div className="px-6 py-4 border-b border-card-border flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <LayerIcon layer={prompt.layer} />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {prompt.name}
                    </h3>
                    <p className="text-xs text-muted">
                      Version {prompt.version} &middot; Updated {formatDateTime(prompt.updated_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(prompt.id)}
                    disabled={testingId === prompt.id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border text-muted hover:text-foreground hover:bg-card-hover transition-colors disabled:opacity-50"
                  >
                    {testingId === prompt.id ? "Testing..." : "Test Prompt"}
                  </button>
                  <button
                    onClick={() => handleShowHistory(prompt.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border transition-colors ${
                      showHistory === prompt.id
                        ? "bg-accent/10 text-accent border-accent/30"
                        : "text-muted hover:text-foreground hover:bg-card-hover"
                    }`}
                  >
                    History
                  </button>
                  {editingId === prompt.id ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(prompt.id)}
                        disabled={saving}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border text-muted hover:text-foreground hover:bg-card-hover transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Prompt body */}
              <div className="px-6 py-4">
                {editingId === prompt.id ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full min-h-[200px] bg-[#111] border border-card-border rounded-lg p-4 text-sm text-foreground font-mono resize-y focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="text-sm text-muted whitespace-pre-wrap font-mono leading-relaxed">
                    {prompt.prompt}
                  </pre>
                )}
              </div>

              {/* Version history panel */}
              {showHistory === prompt.id && (
                <div className="border-t border-card-border px-6 py-4 bg-[#0d0d0d]">
                  <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">
                    Version History
                  </h4>
                  {loadingVersions ? (
                    <div className="space-y-2">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-16 bg-card-hover rounded animate-pulse" />
                      ))}
                    </div>
                  ) : versions.length === 0 ? (
                    <p className="text-sm text-muted">No version history available.</p>
                  ) : (
                    <div className="space-y-2">
                      {versions.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-start justify-between gap-4 p-3 rounded-lg border border-card-border bg-card-bg hover:bg-card-hover transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground">
                                v{v.version}
                              </span>
                              {v.version === prompt.version && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                                  current
                                </span>
                              )}
                              <span className="text-xs text-muted">
                                {formatDateTime(v.updated_at)}
                              </span>
                            </div>
                            <pre className="text-xs text-muted whitespace-pre-wrap font-mono line-clamp-3">
                              {v.prompt}
                            </pre>
                          </div>
                          {v.version !== prompt.version && (
                            <button
                              onClick={() => handleRevert(prompt.id, v.version)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border text-muted hover:text-foreground hover:bg-card-hover transition-colors shrink-0"
                            >
                              Revert
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Test result modal (4.2: uses shared Modal component) */}
      <Modal
        isOpen={!!testResult}
        onClose={() => setTestResult(null)}
        title="Assembled Prompt Preview"
        maxWidth="2xl"
      >
        <div className="overflow-y-auto max-h-[60vh]">
          <pre className="text-sm text-muted whitespace-pre-wrap font-mono leading-relaxed bg-[#111] rounded-lg p-4 border border-card-border">
            {testResult}
          </pre>
        </div>
        <p className="text-xs text-muted mt-3">
          This shows how the prompt layers combine for a sample product run.
        </p>
      </Modal>
    </div>
  );
}
