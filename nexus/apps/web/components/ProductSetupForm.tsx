"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PlatformSelector from "@/components/PlatformSelector";
import SocialChannelSelector from "@/components/SocialChannelSelector";
import { api } from "@/lib/api";

const LANGUAGES = [
  "English", "Spanish", "French", "German", "Portuguese", "Italian",
  "Dutch", "Russian", "Chinese", "Japanese", "Korean", "Arabic",
  "Hindi", "Turkish", "Polish", "Swedish",
];

const BATCH_OPTIONS = [1, 2, 3, 5, 10];

interface ProductSetupFormProps {
  domain: string;
  domainDisplay: string;
  category: string;
  categoryDisplay: string;
}

export default function ProductSetupForm({
  domain,
  domainDisplay,
  category,
  categoryDisplay,
}: ProductSetupFormProps) {
  const router = useRouter();

  // Form state
  const [language, setLanguage] = useState("English");
  const [showAddLanguage, setShowAddLanguage] = useState(false);
  const [newLanguage, setNewLanguage] = useState("");
  const [languages, setLanguages] = useState(LANGUAGES);
  const [niche, setNiche] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  // Platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // Social
  const [socialEnabled, setSocialEnabled] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [postingMode, setPostingMode] = useState<"auto" | "manual">("auto");

  // AI Options
  const [aiPrice, setAiPrice] = useState(true);
  const [manualPrice, setManualPrice] = useState("");
  const [aiAudience, setAiAudience] = useState(true);
  const [manualAudience, setManualAudience] = useState("");
  const [aiDesign, setAiDesign] = useState(true);
  const [manualDesign, setManualDesign] = useState("");

  // Batch
  const [batchCount, setBatchCount] = useState(1);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);

  function addLanguage() {
    if (!newLanguage.trim()) return;
    if (languages.includes(newLanguage.trim())) return;
    setLanguages([...languages, newLanguage.trim()]);
    setLanguage(newLanguage.trim());
    setNewLanguage("");
    setShowAddLanguage(false);
  }

  function buildPayload() {
    return {
      domain,
      category,
      language,
      niche: niche || undefined,
      productName: productName || undefined,
      description: description || undefined,
      keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
      platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
      social: socialEnabled
        ? {
            channels: selectedChannels,
            postingMode,
          }
        : undefined,
      aiOptions: {
        priceSuggestion: aiPrice ? "ai" : manualPrice || undefined,
        targetAudience: aiAudience ? "ai" : manualAudience || undefined,
        designStyle: aiDesign ? "ai" : manualDesign || undefined,
      },
      batchCount,
    };
  }

  async function handleStartWorkflow() {
    setSubmitting(true);
    const payload = buildPayload();
    const result = await api.post("/workflow/start", payload);
    setSubmitting(false);

    if (result.success) {
      router.push(`/workflow/${domain}-${category}`);
    } else {
      // Navigate to workflow page even on error (backend not connected yet)
      router.push(`/workflow/${domain}-${category}`);
    }
  }

  async function handleSaveAsDraft() {
    setSubmitting(true);
    const payload = { ...buildPayload(), status: "draft" };
    await api.post("/products", payload);
    setSubmitting(false);
    router.push("/products");
  }

  return (
    <div className="max-w-3xl">
      <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="text-lg font-semibold text-foreground">Product Setup</h2>
          <p className="text-sm text-muted mt-0.5">
            Every field is optional. If left empty, AI decides everything.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Language</label>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:border-accent appearance-none cursor-pointer min-w-[160px]"
              >
                {languages.map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
              {showAddLanguage ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addLanguage()}
                    placeholder="Language name"
                    autoFocus
                    className="px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent w-36"
                  />
                  <button
                    onClick={addLanguage}
                    className="px-3 py-2 rounded-lg bg-accent text-white text-sm hover:bg-accent-hover transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setShowAddLanguage(false); setNewLanguage(""); }}
                    className="text-muted text-sm hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddLanguage(true)}
                  className="px-3 py-2 rounded-lg border border-dashed border-card-border text-muted text-sm hover:border-accent/50 hover:text-accent transition-all cursor-pointer"
                >
                  + Add Language
                </button>
              )}
            </div>
          </div>

          {/* Niche */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Niche <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder='e.g. "freelancers", "students"'
              className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Product Name <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder='e.g. "Freelancer CRM System"'
              className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='e.g. "tracks clients + invoices"'
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent resize-none"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Keywords <span className="text-muted font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder='e.g. "notion, freelance, crm"'
              className="w-full px-3 py-2.5 rounded-lg border border-card-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* --- PLATFORMS --- */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-card-border" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Platforms</span>
              <div className="h-px flex-1 bg-card-border" />
            </div>
            <label className="block text-sm text-muted mb-2">Post to:</label>
            <PlatformSelector
              selected={selectedPlatforms}
              onChange={setSelectedPlatforms}
            />
          </div>

          {/* --- SOCIAL MEDIA --- */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-card-border" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Social Media</span>
              <div className="h-px flex-1 bg-card-border" />
            </div>
            <SocialChannelSelector
              enabled={socialEnabled}
              onToggle={setSocialEnabled}
              selectedChannels={selectedChannels}
              onChannelsChange={setSelectedChannels}
              postingMode={postingMode}
              onPostingModeChange={setPostingMode}
            />
          </div>

          {/* --- AI OPTIONS --- */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-card-border" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">AI Options</span>
              <div className="h-px flex-1 bg-card-border" />
            </div>
            <div className="space-y-4">
              {/* Price suggestion */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Price suggestion</label>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={aiPrice}
                    onChange={(e) => setAiPrice(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      aiPrice ? "bg-accent border-accent" : "border-muted"
                    }`}
                  >
                    {aiPrice && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-foreground">Let AI decide</span>
                </label>
                {!aiPrice && (
                  <input
                    type="text"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    placeholder="e.g. $19.99"
                    className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                )}
              </div>

              {/* Target audience */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Target audience</label>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={aiAudience}
                    onChange={(e) => setAiAudience(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      aiAudience ? "bg-accent border-accent" : "border-muted"
                    }`}
                  >
                    {aiAudience && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-foreground">Let AI decide</span>
                </label>
                {!aiAudience && (
                  <input
                    type="text"
                    value={manualAudience}
                    onChange={(e) => setManualAudience(e.target.value)}
                    placeholder="e.g. freelancers, small business owners"
                    className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                )}
              </div>

              {/* Design style */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Design style</label>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={aiDesign}
                    onChange={(e) => setAiDesign(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      aiDesign ? "bg-accent border-accent" : "border-muted"
                    }`}
                  >
                    {aiDesign && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm text-foreground">Let AI decide</span>
                </label>
                {!aiDesign && (
                  <input
                    type="text"
                    value={manualDesign}
                    onChange={(e) => setManualDesign(e.target.value)}
                    placeholder="e.g. minimalist, modern, colorful"
                    className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                )}
              </div>
            </div>
          </div>

          {/* --- BATCH MODE --- */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-card-border" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Batch Mode (V4)</span>
              <div className="h-px flex-1 bg-card-border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Generate multiple?</label>
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value))}
                className="px-3 py-2.5 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:border-accent appearance-none cursor-pointer min-w-[160px]"
              >
                {BATCH_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} product{n > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted mt-1.5">
                AI creates {batchCount} unique variation{batchCount > 1 ? "s" : ""} of this concept
              </p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 py-4 border-t border-card-border flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleStartWorkflow}
            disabled={submitting}
            className="flex-1 sm:flex-none px-6 py-3 rounded-lg bg-accent text-white font-semibold text-sm hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "Starting..." : "START WORKFLOW"}
          </button>
          <button
            onClick={handleSaveAsDraft}
            disabled={submitting}
            className="flex-1 sm:flex-none px-6 py-3 rounded-lg border border-card-border text-foreground font-semibold text-sm hover:bg-card-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {submitting ? "Saving..." : "SAVE AS DRAFT"}
          </button>
        </div>
      </div>

      {/* Context info */}
      <div className="mt-4 px-1">
        <p className="text-xs text-muted">
          Domain: <span className="text-foreground capitalize">{domainDisplay}</span>
          {" · "}
          Category: <span className="text-foreground capitalize">{categoryDisplay}</span>
        </p>
      </div>
    </div>
  );
}
