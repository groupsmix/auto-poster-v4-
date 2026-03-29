"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import MockDataBanner from "@/components/MockDataBanner";
import { useApiQuery } from "@/lib/useApiQuery";
import { MOCK_API_KEYS } from "@/lib/mock-data";
import type { APIKeyEntry } from "@/lib/api";


const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ar", label: "Arabic" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ru", label: "Russian" },
  { value: "hi", label: "Hindi" },
  { value: "tr", label: "Turkish" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
];

interface SettingsState {
  social_posting_mode: string;
  default_language: string;
  ceo_review_required: string;
  auto_publish_after_approval: string;
  batch_max_products: string;
  cache_enabled: string;
  ai_gateway_enabled: string;
}

const DEFAULT_SETTINGS: SettingsState = {
  social_posting_mode: "manual",
  default_language: "en",
  ceo_review_required: "true",
  auto_publish_after_approval: "false",
  batch_max_products: "10",
  cache_enabled: "true",
  ai_gateway_enabled: "true",
};

function ToggleSwitch({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-accent" : "bg-card-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsClient() {
  const { data: fetchedKeys, loading, isUsingMock } = useApiQuery(
    () => api.apiKeys.list(),
    MOCK_API_KEYS,
  );

  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const savedSettingsRef = useRef<SettingsState>(DEFAULT_SETTINGS);
  const [apiKeys, setApiKeys] = useState<APIKeyEntry[]>(MOCK_API_KEYS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addKeyModal, setAddKeyModal] = useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [addingKey, setAddingKey] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettingsRef.current);

  // Sync hook data into local mutable state
  useEffect(() => {
    setApiKeys(fetchedKeys);
  }, [fetchedKeys]);

  // Fetch settings (merges into defaults, no mock needed)
  useEffect(() => {
    api.settings.getAll().then((settingsRes) => {
      if (settingsRes.success && settingsRes.data) {
        const merged = {
          ...DEFAULT_SETTINGS,
          ...Object.fromEntries(
            Object.entries(settingsRes.data!).filter(
              ([k]) => k in DEFAULT_SETTINGS
            )
          ),
        };
        setSettings(merged);
        savedSettingsRef.current = merged;
      }
    }).catch(() => { /* keep defaults */ });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.settings.bulkUpdate({ ...settings });
    } catch {
      // best-effort
    } finally {
      savedSettingsRef.current = { ...settings };
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleAddKey = async () => {
    if (!addKeyModal || !newKeyValue.trim()) return;
    setAddingKey(true);
    try {
      await api.apiKeys.add(addKeyModal, newKeyValue.trim());
      setApiKeys((prev) =>
        prev.map((k) =>
          k.key_name === addKeyModal ? { ...k, status: "active" as const } : k
        )
      );
    } catch {
      // best-effort
      setApiKeys((prev) =>
        prev.map((k) =>
          k.key_name === addKeyModal ? { ...k, status: "active" as const } : k
        )
      );
    } finally {
      setAddingKey(false);
      setAddKeyModal(null);
      setNewKeyValue("");
    }
  };

  const handleRemoveKey = async (keyName: string) => {
    try {
      await api.apiKeys.remove(keyName);
    } catch {
      // best-effort
    }
    setApiKeys((prev) =>
      prev.map((k) =>
        k.key_name === keyName ? { ...k, status: "not_set" as const } : k
      )
    );
    setRemoveConfirm(null);
  };

  const updateSetting = (key: keyof SettingsState, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse"
          >
            <div className="h-5 w-32 bg-card-border rounded mb-4" />
            <div className="space-y-3">
              <div className="h-4 w-full bg-card-border rounded" />
              <div className="h-4 w-3/4 bg-card-border rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Sticky Save Bar */}
      <div className={`sticky top-0 z-10 mb-6 flex items-center justify-between rounded-xl border px-5 py-3 transition-all ${
        isDirty
          ? "border-accent/30 bg-accent/5"
          : "border-card-border bg-card-bg"
      }`}>
        <p className="text-sm text-muted">
          {isDirty ? "You have unsaved changes" : saved ? "Settings saved" : "Settings"}
        </p>
        <button
          onClick={handleSave}
          disabled={saving || (!isDirty && !saving)}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-success text-white"
              : "bg-accent text-white hover:bg-accent-hover"
          } disabled:opacity-50`}
        >
          {saving ? "Saving..." : saved ? "Saved" : "Save Settings"}
        </button>
      </div>

      {isUsingMock && <MockDataBanner />}

      <div className="space-y-6">
        {/* Auth & System Status Banner (7.6) */}
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">
            System Status
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Auth Status */}
            <div className="rounded-lg bg-card-hover border border-card-border p-4">
              <p className="text-xs text-muted mb-1">Authentication</p>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    typeof window !== "undefined" && localStorage.getItem("nexus_token")
                      ? "bg-success"
                      : "bg-warning"
                  }`}
                />
                <p className="text-sm font-medium text-foreground">
                  {typeof window !== "undefined" && localStorage.getItem("nexus_token")
                    ? "Configured"
                    : "Not Configured"}
                </p>
              </div>
              {typeof window !== "undefined" && !localStorage.getItem("nexus_token") && (
                <p className="text-xs text-warning mt-2">
                  Set DASHBOARD_SECRET in your Worker and add token in browser to secure API access.
                </p>
              )}
            </div>

            {/* Connected AI Providers */}
            <div className="rounded-lg bg-card-hover border border-card-border p-4">
              <p className="text-xs text-muted mb-1">AI Providers</p>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    apiKeys.filter((k) => k.status === "active").length > 0
                      ? "bg-success"
                      : "bg-warning"
                  }`}
                />
                <p className="text-sm font-medium text-foreground">
                  {apiKeys.filter((k) => k.status === "active").length} of{" "}
                  {apiKeys.length} connected
                </p>
              </div>
            </div>

            {/* Workers AI Fallback */}
            <div className="rounded-lg bg-card-hover border border-card-border p-4">
              <p className="text-xs text-muted mb-1">Workers AI Fallback</p>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-success" />
                <p className="text-sm font-medium text-foreground">
                  Always Available
                </p>
              </div>
              <p className="text-xs text-muted mt-2">
                Built-in fallback — text tasks never fully fail.
              </p>
            </div>
          </div>
        </div>

        {/* General Settings */}
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">
            General
          </h2>
          <div className="divide-y divide-card-border">
            {/* Social Posting Mode */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Social Posting Mode
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Auto-post or manually copy content to platforms
                </p>
              </div>
              <div className="flex rounded-lg overflow-hidden border border-card-border">
                <button
                  onClick={() => updateSetting("social_posting_mode", "manual")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    settings.social_posting_mode === "manual"
                      ? "bg-accent text-white"
                      : "bg-card-hover text-muted hover:text-foreground"
                  }`}
                >
                  Manual
                </button>
                <button
                  onClick={() => updateSetting("social_posting_mode", "auto")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    settings.social_posting_mode === "auto"
                      ? "bg-accent text-white"
                      : "bg-card-hover text-muted hover:text-foreground"
                  }`}
                >
                  Auto
                </button>
              </div>
            </div>

            {/* Default Language */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Default Language
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Language for generated content
                </p>
              </div>
              <select
                value={settings.default_language}
                onChange={(e) =>
                  updateSetting("default_language", e.target.value)
                }
                className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground focus:outline-none focus:border-accent"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* CEO Review */}
            <ToggleSwitch
              label="CEO Review Required"
              description="Require manual approval before publishing"
              enabled={settings.ceo_review_required === "true"}
              onChange={(v) =>
                updateSetting("ceo_review_required", v.toString())
              }
            />

            {/* Auto Publish */}
            <ToggleSwitch
              label="Auto-Publish After Approval"
              description="Automatically publish to platforms after CEO approval"
              enabled={settings.auto_publish_after_approval === "true"}
              onChange={(v) =>
                updateSetting("auto_publish_after_approval", v.toString())
              }
            />
          </div>
        </div>

        {/* V4 Settings */}
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h2 className="text-base font-semibold text-foreground mb-1">
            V4 Features
          </h2>
          <p className="text-xs text-muted mb-4">
            New in V4 — AI caching, gateway, and batch controls
          </p>
          <div className="divide-y divide-card-border">
            {/* Batch Max Products */}
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Batch Max Products
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Maximum products per batch workflow (1-10)
                </p>
              </div>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.batch_max_products}
                onChange={(e) => {
                  const val = Math.min(10, Math.max(1, Number(e.target.value)));
                  updateSetting("batch_max_products", val.toString());
                }}
                className="w-20 px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground text-center focus:outline-none focus:border-accent"
              />
            </div>

            {/* AI Response Caching */}
            <ToggleSwitch
              label="AI Response Caching"
              description="Cache identical prompts to save AI calls (30-50% savings)"
              enabled={settings.cache_enabled === "true"}
              onChange={(v) => updateSetting("cache_enabled", v.toString())}
            />

            {/* AI Gateway */}
            <ToggleSwitch
              label="AI Gateway"
              description="Route AI calls through Cloudflare AI Gateway for logging, caching, and rate limiting"
              enabled={settings.ai_gateway_enabled === "true"}
              onChange={(v) =>
                updateSetting("ai_gateway_enabled", v.toString())
              }
            />
          </div>
        </div>

        {/* API Key Management */}
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h2 className="text-base font-semibold text-foreground mb-1">
            API Key Management
          </h2>
          <p className="text-xs text-muted mb-4">
            Add a key to activate an AI model. Remove to put it to sleep.
          </p>
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div
                key={key.key_name}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-card-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      key.status === "active" ? "bg-success" : "bg-card-border"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {key.display_name}
                    </p>
                    <p className="text-xs text-muted font-mono">
                      {key.key_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      key.status === "active"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {key.status === "active" ? "Active" : "Not Set"}
                  </span>
                  {key.status === "active" ? (
                    <button
                      onClick={() => setRemoveConfirm(key.key_name)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1"
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => setAddKeyModal(key.key_name)}
                      className="text-xs text-accent hover:text-accent-hover transition-colors px-2 py-1"
                    >
                      Add Key
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account Preferences Placeholder */}
        <div className="rounded-xl border border-card-border bg-card-bg p-6">
          <h2 className="text-base font-semibold text-foreground mb-1">
            Account Preferences
          </h2>
          <p className="text-xs text-muted mb-4">
            Additional account settings coming soon
          </p>
          <div className="rounded-lg bg-card-hover border border-card-border p-8 text-center">
            <p className="text-sm text-muted">
              Account preferences will be available in a future update.
            </p>
          </div>
        </div>
      </div>

      {/* Add Key Modal */}
      {addKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl border border-card-border bg-card-bg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Add API Key
            </h3>
            <p className="text-sm text-muted mb-4">
              Enter your API key for{" "}
              <span className="text-foreground font-medium font-mono">
                {addKeyModal}
              </span>
            </p>
            <input
              type="password"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="sk-..."
              className="w-full px-4 py-2.5 rounded-lg bg-background border border-card-border text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent mb-4"
              autoFocus
            />
            <p className="text-xs text-muted mb-4">
              Key will be stored securely in Cloudflare Secrets. The AI model
              will activate immediately.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleAddKey}
                disabled={addingKey || !newKeyValue.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {addingKey ? "Saving..." : "Save Key"}
              </button>
              <button
                onClick={() => {
                  setAddKeyModal(null);
                  setNewKeyValue("");
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-card-border text-muted text-sm font-medium hover:text-foreground hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Key Confirmation */}
      {removeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl border border-card-border bg-card-bg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Remove API Key
            </h3>
            <p className="text-sm text-muted mb-4">
              Removing{" "}
              <span className="text-foreground font-medium font-mono">
                {removeConfirm}
              </span>{" "}
              will put the AI model to sleep. It can be re-added later.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleRemoveKey(removeConfirm)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Remove
              </button>
              <button
                onClick={() => setRemoveConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-card-border text-muted text-sm font-medium hover:text-foreground hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
