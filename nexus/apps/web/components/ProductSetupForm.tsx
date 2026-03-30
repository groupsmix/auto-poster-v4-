"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PlatformSelector from "./PlatformSelector";
import SocialChannelSelector from "./SocialChannelSelector";
import Modal from "./Modal";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface ProductSetupFormProps {
  domainSlug: string;
  categorySlug: string;
}

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Arabic",
  "Chinese",
  "Japanese",
  "Korean",
  "Hindi",
  "Italian",
  "Dutch",
  "Russian",
  "Turkish",
];

const BATCH_OPTIONS = [1, 2, 3, 5, 10];

export default function ProductSetupForm({
  domainSlug,
  categorySlug,
}: ProductSetupFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Load saved defaults from localStorage (5.6)
  const savedDefaults = typeof window !== "undefined"
    ? (() => { try { return JSON.parse(localStorage.getItem("nexus_form_defaults") ?? "null"); } catch { return null; } })()
    : null;

  // Form state
  const [language, setLanguage] = useState(savedDefaults?.language ?? "English");
  const [showLangAdd, setShowLangAdd] = useState(false);
  const [newLang, setNewLang] = useState("");
  const [languages, setLanguages] = useState(LANGUAGES);
  const [niche, setNiche] = useState(savedDefaults?.niche ?? "");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  // Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(savedDefaults?.selectedPlatforms ?? []);

  // Social
  const [socialEnabled, setSocialEnabled] = useState(savedDefaults?.socialEnabled ?? false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(savedDefaults?.selectedChannels ?? []);
  const [postingMode, setPostingMode] = useState<"auto" | "manual">(savedDefaults?.postingMode ?? "auto");

  // AI Options
  const [priceAI, setPriceAI] = useState(savedDefaults?.priceAI ?? true);
  const [priceManual, setPriceManual] = useState(savedDefaults?.priceManual ?? "");
  const [audienceAI, setAudienceAI] = useState(savedDefaults?.audienceAI ?? true);
  const [audienceManual, setAudienceManual] = useState(savedDefaults?.audienceManual ?? "");
  const [designAI, setDesignAI] = useState(savedDefaults?.designAI ?? true);
  const [designManual, setDesignManual] = useState(savedDefaults?.designManual ?? "");

  // Batch
  const [batchCount, setBatchCount] = useState(savedDefaults?.batchCount ?? 1);

  // Confirmation dialog state (1.5)
  const [showConfirm, setShowConfirm] = useState(false);

  // Persist form defaults on change (5.6)
  useEffect(() => {
    const defaults = {
      language, niche, selectedPlatforms, selectedChannels,
      socialEnabled, postingMode, priceAI, priceManual,
      audienceAI, audienceManual, designAI, designManual, batchCount,
    };
    try { localStorage.setItem("nexus_form_defaults", JSON.stringify(defaults)); } catch { /* quota exceeded */ }
  }, [
    language, niche, selectedPlatforms, selectedChannels,
    socialEnabled, postingMode, priceAI, priceManual,
    audienceAI, audienceManual, designAI, designManual, batchCount,
  ]);

  const handleAddLanguage = () => {
    if (!newLang.trim()) return;
    if (!languages.includes(newLang.trim())) {
      setLanguages([...languages, newLang.trim()]);
    }
    setLanguage(newLang.trim());
    setNewLang("");
    setShowLangAdd(false);
  };

  const buildPayload = () => ({
    domain_id: domainSlug,
    category_id: categorySlug,
    language,
    niche: niche || undefined,
    name: productName || undefined,
    description: description || undefined,
    keywords: keywords || undefined,
    platforms: selectedPlatforms,
    social_channels: selectedChannels,
    social_enabled: socialEnabled,
    posting_mode: postingMode,
    price_suggestion: priceAI ? ("ai" as const) : Number(priceManual) || 0,
    target_audience: audienceAI ? ("ai" as const) : audienceManual,
    design_style: designAI ? ("ai" as const) : designManual,
    batch_count: batchCount,
  });

  const handleRequestStart = () => {
    // 1.5: Validate at least one platform is selected
    if (selectedPlatforms.length === 0) {
      toast.error("Please select at least one platform before starting the workflow.");
      return;
    }
    // 1.5: Show confirmation dialog
    setShowConfirm(true);
  };

  const handleStartWorkflow = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const payload = buildPayload();
      const response = await api.post<{ id: string }>("/workflow/start", payload);
      if (response.success && response.data) {
        router.push(`/workflow/${response.data.id}`);
      } else {
        // Navigate to a mock workflow page on API failure
        router.push(`/workflow/wf-${Date.now()}`);
      }
    } catch {
      toast.error("Failed to start workflow");
      router.push(`/workflow/wf-${Date.now()}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = async () => {
    setSubmitting(true);
    try {
      const payload = buildPayload();
      await api.post("/products", { ...payload, status: "draft" });
      router.push("/products");
    } catch {
      toast.error("Failed to save draft");
      router.push("/products");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 rounded-lg bg-card-bg border border-card-border text-foreground placeholder:text-muted text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors";

  return (
    <div className="max-w-2xl space-y-8">
      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Language
        </label>
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={`${inputClass} appearance-none cursor-pointer`}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          {showLangAdd ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddLanguage()}
                placeholder="Language"
                className="px-3 py-2.5 rounded-lg text-sm bg-card-bg border border-card-border text-foreground placeholder:text-muted focus:outline-none focus:border-accent w-28"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddLanguage}
                className="text-sm text-accent hover:text-accent-hover"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLangAdd(false);
                  setNewLang("");
                }}
                className="text-sm text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLangAdd(true)}
              className="px-3 py-2.5 rounded-lg text-sm font-medium border-2 border-dashed border-card-border text-muted hover:border-accent/50 hover:text-accent transition-all whitespace-nowrap"
            >
              + Add Language
            </button>
          )}
        </div>
      </div>

      {/* Niche */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Niche <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder='e.g. "freelancers", "students"'
          className={inputClass}
        />
      </div>

      {/* Product Name */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Product Name{" "}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder='e.g. "Freelancer CRM System"'
          className={inputClass}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Description{" "}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='e.g. "tracks clients + invoices"'
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Keywords{" "}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder='e.g. "notion, freelance, crm"'
          className={inputClass}
        />
      </div>

      {/* Divider — Platforms */}
      <div className="border-t border-card-border pt-6">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          Platforms
        </h3>
        <PlatformSelector
          selected={selectedPlatforms}
          onChange={setSelectedPlatforms}
        />
      </div>

      {/* Divider — Social Media */}
      <div className="border-t border-card-border pt-6">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          Social Media
        </h3>
        <SocialChannelSelector
          enabled={socialEnabled}
          onToggle={setSocialEnabled}
          selected={selectedChannels}
          onChange={setSelectedChannels}
          postingMode={postingMode}
          onPostingModeChange={setPostingMode}
        />
      </div>

      {/* Divider — AI Options */}
      <div className="border-t border-card-border pt-6">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          AI Options
        </h3>
        <div className="space-y-4">
          {/* Price suggestion */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={priceAI}
                  onChange={(e) => setPriceAI(e.target.checked)}
                  className="rounded border-card-border text-accent focus:ring-accent"
                />
                <span className="text-sm text-foreground">
                  Let AI decide price
                </span>
              </label>
            </div>
            {!priceAI && (
              <input
                type="number"
                value={priceManual}
                onChange={(e) => setPriceManual(e.target.value)}
                placeholder="Enter price (e.g. 19.99)"
                className={inputClass}
                min="0"
                step="0.01"
              />
            )}
          </div>

          {/* Target audience */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={audienceAI}
                  onChange={(e) => setAudienceAI(e.target.checked)}
                  className="rounded border-card-border text-accent focus:ring-accent"
                />
                <span className="text-sm text-foreground">
                  Let AI decide target audience
                </span>
              </label>
            </div>
            {!audienceAI && (
              <input
                type="text"
                value={audienceManual}
                onChange={(e) => setAudienceManual(e.target.value)}
                placeholder="e.g. freelancers aged 25-40"
                className={inputClass}
              />
            )}
          </div>

          {/* Design style */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={designAI}
                  onChange={(e) => setDesignAI(e.target.checked)}
                  className="rounded border-card-border text-accent focus:ring-accent"
                />
                <span className="text-sm text-foreground">
                  Let AI decide design style
                </span>
              </label>
            </div>
            {!designAI && (
              <input
                type="text"
                value={designManual}
                onChange={(e) => setDesignManual(e.target.value)}
                placeholder="e.g. minimal, modern, dark theme"
                className={inputClass}
              />
            )}
          </div>
        </div>
      </div>

      {/* Divider — Batch Mode */}
      <div className="border-t border-card-border pt-6">
        <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mb-4">
          Batch Mode (V4)
        </h3>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Generate multiple?
          </label>
          <select
            value={batchCount}
            onChange={(e) => setBatchCount(Number(e.target.value))}
            className={`${inputClass} appearance-none cursor-pointer max-w-xs`}
          >
            {BATCH_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} product{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted mt-1">
            AI creates N unique variations of this concept
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-card-border pt-6 flex gap-3">
        <button
          type="button"
          onClick={handleRequestStart}
          disabled={submitting}
          className="flex-1 px-6 py-3 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Starting..." : "START WORKFLOW"}
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={submitting}
          className="flex-1 px-6 py-3 rounded-lg border border-card-border text-foreground text-sm font-semibold hover:bg-card-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : "SAVE AS DRAFT"}
        </button>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted text-center pb-4">
        Every field is optional. If left empty, AI researches and decides everything itself.
      </p>

      {/* 1.5: Confirmation dialog before starting workflow */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Start Workflow?" maxWidth="sm">
        <p className="text-sm text-muted mb-2">
          AI will research your domain, generate product content, create listings, and prepare everything for your review.
        </p>
        <ul className="text-sm text-muted mb-4 list-disc list-inside space-y-1">
          <li>{batchCount} product{batchCount > 1 ? "s" : ""} will be generated</li>
          <li>{selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? "s" : ""} selected</li>
          {socialEnabled && <li>Social media posting enabled</li>}
        </ul>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowConfirm(false)}
            className="flex-1 px-4 py-2.5 rounded-lg border border-card-border text-foreground text-sm font-medium hover:bg-card-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartWorkflow}
            className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
          >
            Confirm &amp; Start
          </button>
        </div>
      </Modal>
    </div>
  );
}
