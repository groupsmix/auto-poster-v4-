"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
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

// Mock data for all prompt layers
const MOCK_PROMPTS: PromptTemplate[] = [
  {
    id: "p-master",
    layer: "master",
    target_id: null,
    name: "Master System Prompt",
    prompt: `You are NEXUS — a world-class AI business engine.

You operate with the mindset of:
- A senior marketing strategist with 15 years of e-commerce experience
- A professional copywriter who understands consumer psychology deeply
- An SEO specialist who knows how platforms rank and reward listings
- A creative director who understands what converts browsers to buyers

Core rules you ALWAYS follow:
1. Never produce generic AI-sounding output. Write like a real expert human.
2. Always think about the END BUYER — their emotions, desires, fears, language.
3. Always optimize for the specific platform's algorithm and buyer behavior.
4. Always produce output in the exact JSON schema specified.
5. If something is missing from your instructions, make the smartest decision.
6. Quality over speed. Every word should earn its place.`,
    version: 3,
    is_active: true,
    updated_at: "2025-03-20T10:00:00Z",
  },
  {
    id: "p-role-researcher",
    layer: "role",
    target_id: "researcher",
    name: "Researcher Role",
    prompt: `Your role: Senior Market Research Analyst
Your job: Find real market data, real trends, real competitor insights.
Do not guess. Use the search results provided.
Extract: what's selling, why it sells, who buys it, what price they pay.
Think like someone who has studied this market for years.`,
    version: 2,
    is_active: true,
    updated_at: "2025-03-18T14:00:00Z",
  },
  {
    id: "p-role-copywriter",
    layer: "role",
    target_id: "copywriter",
    name: "Copywriter Role",
    prompt: `Your role: Elite Direct Response Copywriter
Your job: Write copy that makes people pull out their wallet.
Use psychological triggers: social proof, scarcity, identity, transformation.
Avoid cliches, avoid fluff, avoid anything that sounds like it was AI-generated.
Every sentence must either build desire or eliminate doubt.`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-role-seo",
    layer: "role",
    target_id: "seo",
    name: "SEO Strategist Role",
    prompt: `Your role: Platform SEO Specialist
Your job: Maximize organic discoverability within platform constraints.
You understand: keyword intent, search behavior, platform algorithm signals.
Never sacrifice readability for keywords. Best SEO reads like natural language.`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-role-reviewer",
    layer: "role",
    target_id: "reviewer",
    name: "Reviewer / CEO Role",
    prompt: `Your role: Chief Quality Officer
Your job: Be the harshest, most demanding reviewer of this output.
Evaluate from 3 angles: (1) Would this sell? (2) Is the SEO strong? (3) Does it sound human?
Identify every weakness. Be specific about what needs to change.
Output a structured review with pass/fail per criterion and specific revision instructions.`,
    version: 2,
    is_active: true,
    updated_at: "2025-03-16T12:00:00Z",
  },
  {
    id: "p-role-designer",
    layer: "role",
    target_id: "designer",
    name: "Designer Role",
    prompt: `Your role: Senior Visual Designer
Your job: Create designs that communicate instantly and look professional.
Think about contrast, hierarchy, whitespace, and readability at all sizes.
Designs must work at thumbnail size on mobile AND full size on desktop/print.`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-role-coder",
    layer: "role",
    target_id: "coder",
    name: "Coder Role",
    prompt: `Your role: Senior Full-Stack Developer
Your job: Write clean, production-ready code with proper architecture.
Follow best practices: type safety, error handling, separation of concerns.
Prefer simple, maintainable solutions over clever abstractions.`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-domain-digital",
    layer: "domain",
    target_id: "digital-products",
    name: "Digital Products",
    prompt: `Domain context: Digital Products (instant download)
Key facts:
- Buyers want transformation, not information — sell the outcome not the content
- No physical shipping — speed and instant access are key selling points
- Screenshots and previews convert. Describe the product visually in text.
- Most successful digital products solve ONE specific problem for ONE specific person
- Gumroad and Etsy are primary channels. SEO must target "template" + "niche" keywords.`,
    version: 2,
    is_active: true,
    updated_at: "2025-03-15T10:00:00Z",
  },
  {
    id: "p-domain-pod",
    layer: "domain",
    target_id: "pod",
    name: "Print on Demand (POD)",
    prompt: `Domain context: Print-on-Demand (POD)
Key facts:
- Buyers purchase for identity expression, gifting, and community belonging
- Design must work at small scale (thumbnail on mobile) and large scale (actual print)
- Most successful POD niches are hyper-specific identity groups, not generic audiences
- Price competition is real — differentiation must come from niche specificity and design quality
- Etsy and Redbubble are the primary discovery channels — optimize for both`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-category-notion",
    layer: "category",
    target_id: "notion-templates",
    name: "Notion Templates",
    prompt: `Category: Notion Templates
Specific rules:
- Buyers are productivity-obsessed. Language: "system", "workflow", "organized", "automated"
- Always mention: mobile-friendly, free Notion account required, instant duplicate
- Best performers: CRM, project manager, content calendar, habit tracker, finance tracker
- Price range that converts: $7-$27 for single templates, $37-$97 for systems/bundles
- Keywords that drive traffic: "notion template", "notion dashboard", "notion system", "[niche] notion"`,
    version: 2,
    is_active: true,
    updated_at: "2025-03-14T09:00:00Z",
  },
  {
    id: "p-category-tshirts",
    layer: "category",
    target_id: "t-shirts",
    name: "T-Shirts & Apparel",
    prompt: `Category: POD T-Shirts & Apparel
Specific rules:
- Design must work in both light and dark shirt colors unless you specify one
- Text-based designs outperform complex illustrations on Etsy
- Hyper-niche identity phrases outperform generic funny quotes
- Size guide mention in description increases conversions
- Unisex positioning expands audience. Specify: "Unisex, true to size, soft cotton blend"
- Winning formula: [Identity group] + [Relatable situation or pride statement]`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-platform-etsy",
    layer: "platform",
    target_id: "etsy",
    name: "Etsy",
    prompt: `Platform: Etsy
Audience: Handmade lovers, gift shoppers, small business owners
Tone: Warm, personal, gift-focused, emotional
Title limit: 140 characters
Tags: 13 tags, max 20 chars each
SEO style: Long-tail, buyer-intent keywords
Description style: Story-driven, include: who it's for, what they get, how it helps
CTA style: Save for later, Perfect gift for...
Forbidden words: "best", "cheapest", "guaranteed"`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-platform-gumroad",
    layer: "platform",
    target_id: "gumroad",
    name: "Gumroad",
    prompt: `Platform: Gumroad
Audience: Creators, solopreneurs, freelancers
Tone: Value-driven, outcome-focused, creator-to-creator
Title limit: 100 characters
Tags: 10 tags
SEO style: Problem -> solution keywords
Description style: What you get + what problem it solves + who it's for
CTA style: Download instantly, Start using today`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-social-instagram",
    layer: "social",
    target_id: "instagram",
    name: "Instagram",
    prompt: `Channel: Instagram
Caption max: 2200 characters
Hashtags: up to 30
Tone: Visual, aspirational, lifestyle-focused
Format: Hook line -> value -> CTA -> hashtags
Content types: single image, carousel, reel script`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-social-tiktok",
    layer: "social",
    target_id: "tiktok",
    name: "TikTok",
    prompt: `Channel: TikTok
Hook max: 150 characters
Tone: Fast, punchy, entertaining, trend-aware
Format: Strong hook (1-3 seconds) -> problem -> solution -> CTA
Content types: video script, hook + 3 points + CTA`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-social-pinterest",
    layer: "social",
    target_id: "pinterest",
    name: "Pinterest",
    prompt: `Channel: Pinterest
Title max: 100 characters
Description max: 500 characters
Tone: Inspirational, search-optimized, idea-focused
Format: Keyword-rich title -> what it is -> who it's for -> link
Content types: pin title + description`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-context",
    layer: "context",
    target_id: null,
    name: "Context Injection Template",
    prompt: `Previous context from this workflow:
- Research findings: {step_1_research_output}
- Strategy decisions: {step_2_strategy_output}
- Similar products from cache: {cached_similar_products}
- Revision feedback (if revision): {ceo_feedback}

Use this context to:
1. Build on research findings, don't contradict them
2. Follow strategy decisions made earlier
3. Learn from similar products that performed well
4. Address ALL revision feedback points specifically`,
    version: 1,
    is_active: true,
    updated_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "p-review-ceo",
    layer: "review",
    target_id: null,
    name: "CEO Review Prompt",
    prompt: `You are the CEO reviewing a product package before it goes to market.

Be extremely critical. Your standard: would YOU personally buy this? Would you be embarrassed by this?

Review the following output and score each criterion 1-10:

PRODUCT PACKAGE TO REVIEW:
{product_output_json}

Evaluate:
1. TITLE STRENGTH (1-10): Is it attention-grabbing? SEO-optimized? Platform-appropriate?
2. DESCRIPTION QUALITY (1-10): Does it sell? Is it human? Does it answer buyer questions?
3. SEO QUALITY (1-10): Right keywords? Right density? Platform-appropriate?
4. PRICE LOGIC (1-10): Competitive? Justified? Psychologically optimized?
5. PLATFORM FIT (1-10): Does it match the platform's buyer psychology?
6. HUMAN QUALITY (1-10): Does any part sound AI-generated or robotic?
7. OVERALL READINESS (1-10): Is this ready to publish?

For any score below 8:
- State exactly what is wrong
- State exactly what should be changed
- Provide the corrected version

Output format:
{
  "overall_score": number,
  "approved": boolean,
  "scores": { ... },
  "issues": [ { "criterion": "...", "problem": "...", "fix": "..." } ],
  "revised_sections": { ... }
}`,
    version: 3,
    is_active: true,
    updated_at: "2025-03-19T15:00:00Z",
  },
];

const MOCK_VERSIONS: Record<string, PromptVersion[]> = {
  "p-master": [
    { id: "pv-1", prompt_id: "p-master", version: 3, prompt: MOCK_PROMPTS[0].prompt, updated_at: "2025-03-20T10:00:00Z" },
    { id: "pv-2", prompt_id: "p-master", version: 2, prompt: "You are NEXUS — a world-class AI business engine.\n\nCore rules:\n1. Never produce generic output.\n2. Think about the END BUYER.\n3. Optimize for platform algorithms.\n4. Produce output in JSON schema.\n5. Quality over speed.", updated_at: "2025-03-15T10:00:00Z" },
    { id: "pv-3", prompt_id: "p-master", version: 1, prompt: "You are NEXUS. Follow instructions carefully. Output JSON.", updated_at: "2025-03-10T08:00:00Z" },
  ],
};

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
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState<string>("master");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.prompts.list();
      if (response.success && response.data) {
        setPrompts(response.data);
      } else {
        setPrompts(MOCK_PROMPTS);
      }
    } catch {
      setPrompts(MOCK_PROMPTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  const layerPrompts = prompts.filter((p) => p.layer === activeLayer);

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
      // best-effort
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
    setTestingId(id);
    setTestResult(null);
    try {
      const response = await api.prompts.test(id);
      if (response.success && response.data) {
        setTestResult(response.data.assembled);
      } else {
        const prompt = prompts.find((p) => p.id === id);
        if (prompt) {
          const master = prompts.find((p) => p.layer === "master");
          setTestResult(
            `=== ASSEMBLED PROMPT PREVIEW ===\n\n` +
            `--- Layer A: Master ---\n${master?.prompt ?? "(no master prompt)"}\n\n` +
            `--- Current Layer: ${prompt.name} ---\n${prompt.prompt}\n\n` +
            `--- Layer I: Context ---\n(context from previous workflow steps would be injected here)\n\n` +
            `--- Output Schema ---\n{ "title": "...", "description": "...", "tags": [...], "price": 0 }`
          );
        }
      }
    } catch {
      const prompt = prompts.find((p) => p.id === id);
      setTestResult(
        `=== ASSEMBLED PROMPT PREVIEW (mock) ===\n\n${prompt?.prompt ?? ""}\n\n(In production, this shows the full assembled prompt with all layers combined for a sample product.)`
      );
    } finally {
      setTestingId(null);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return d;
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

      {/* Layer Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {PROMPT_LAYERS.map((layer) => {
          const count = prompts.filter((p) => p.layer === layer.key).length;
          return (
            <button
              key={layer.key}
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
                      Version {prompt.version} &middot; Updated {formatDate(prompt.updated_at)}
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
                                {formatDate(v.updated_at)}
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

      {/* Test result modal */}
      {testResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl border border-card-border bg-card-bg p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Assembled Prompt Preview
              </h3>
              <button
                onClick={() => setTestResult(null)}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <pre className="text-sm text-muted whitespace-pre-wrap font-mono leading-relaxed bg-[#111] rounded-lg p-4 border border-card-border">
                {testResult}
              </pre>
            </div>
            <p className="text-xs text-muted mt-3">
              This shows how the prompt layers combine for a sample product run.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
