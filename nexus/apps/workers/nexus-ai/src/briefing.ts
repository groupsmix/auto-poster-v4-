// ============================================================
// Daily Intelligence Briefing Generator
//
// Uses the existing AI failover engine to generate daily
// business intelligence briefings: trends, predictions,
// opportunities, action items, and niche hacks.
// ============================================================

import type { Env, BriefingSection } from "@nexus/shared";
import { parseAIJSON } from "@nexus/shared";
import { runWithFailover } from "./failover";
import { gatherDashboardContext } from "./chatbot";

// --- Types ---

export interface BriefingGenerateInput {
  focus_domains?: string[];
  focus_keywords?: string[];
  briefing_types?: string[];
}

export interface BriefingGenerateResult {
  title: string;
  summary: string;
  sections: BriefingSection[];
  domains_analyzed: string[];
  ai_model_used: string;
  tokens_used: number;
}

// ============================================================
// BRIEFING PROMPT — Generates actionable business intelligence
// ============================================================

function buildBriefingPrompt(
  context: string,
  input: BriefingGenerateInput
): string {
  const today = new Date().toISOString().split("T")[0];
  const focusDomains = input.focus_domains?.length
    ? `Focus especially on these domains: ${input.focus_domains.join(", ")}`
    : "Analyze all available domains";
  const focusKeywords = input.focus_keywords?.length
    ? `Pay special attention to these keywords/niches: ${input.focus_keywords.join(", ")}`
    : "";

  const requestedSections = input.briefing_types?.length
    ? input.briefing_types
    : ["trends", "predictions", "opportunities", "action_items", "niche_hacks"];

  const sectionDescriptions: Record<string, string> = {
    trends: `"trends" — Current market trends relevant to the user's domains. What's hot RIGHT NOW? What's gaining momentum? What's fading? Include specific data points, search volume changes, and social media buzz indicators.`,
    predictions: `"predictions" — Forward-looking predictions for the next 7-30 days. What will be popular next? What seasonal trends are coming? What emerging niches should be explored? Include confidence levels (high/medium/low).`,
    opportunities: `"opportunities" — Specific, actionable business opportunities the user should consider TODAY. Gaps in the market, underserved niches, price arbitrage, cross-platform opportunities, bundle ideas.`,
    action_items: `"action_items" — Concrete steps the user should take today. Each item should be immediately actionable (e.g., "Create a Valentine's Day planner template targeting remote workers" not "Consider seasonal products").`,
    niche_hacks: `"niche_hacks" — Insider tricks and business hacks. Platform algorithm tips, pricing psychology, SEO shortcuts, content repurposing strategies, competitor weaknesses to exploit.`,
  };

  const sectionsToGenerate = requestedSections
    .map((s) => sectionDescriptions[s])
    .filter(Boolean)
    .join("\n\n");

  return `You are the NEXUS Business Intelligence Engine — an AI that has analyzed over 10,000 successful digital product businesses and identified the exact patterns that separate $100/month sellers from $10,000/month sellers.

Today is ${today}. Generate a comprehensive Daily Intelligence Briefing for the business owner.

=== CURRENT BUSINESS CONTEXT ===
${context}

=== FOCUS AREAS ===
${focusDomains}
${focusKeywords}

=== YOUR TASK ===
Generate a daily briefing with the following sections:

${sectionsToGenerate}

=== OUTPUT FORMAT ===
Return a JSON object with EXACTLY this structure:

{
  "title": "A compelling, specific title for today's briefing (e.g., 'Valentine's Rush + AI Planner Boom — Your Monday Briefing')",
  "summary": "A 2-3 sentence executive summary of the most important takeaways from today's briefing. Lead with the single most actionable insight.",
  "sections": [
    {
      "type": "trends",
      "title": "Market Trends",
      "items": [
        {
          "headline": "Short, punchy headline (max 80 chars)",
          "detail": "2-3 sentences explaining the trend, why it matters, and how it connects to the user's business. Include specific numbers or data points where possible.",
          "confidence": "high",
          "domain": "relevant_domain_name_or_null",
          "tags": ["keyword1", "keyword2"]
        }
      ]
    },
    {
      "type": "predictions",
      "title": "Predictions & Forecasts",
      "items": [...]
    },
    {
      "type": "opportunities",
      "title": "Opportunities to Act On",
      "items": [...]
    },
    {
      "type": "action_items",
      "title": "Today's Action Items",
      "items": [...]
    },
    {
      "type": "niche_hacks",
      "title": "Business Hacks & Tips",
      "items": [...]
    }
  ]
}

=== CRITICAL RULES ===
1. Each section must have 3-5 items. Quality over quantity.
2. Every item must be SPECIFIC and ACTIONABLE — no generic advice like "stay on top of trends."
3. Reference the user's actual domains, categories, and products when relevant.
4. Include specific numbers: price points, search volumes, conversion rates, timelines.
5. Predictions must include confidence levels: "high" (80%+ likely), "medium" (50-80%), "low" (30-50%).
6. Action items must be completable in one day — not multi-week projects.
7. Niche hacks should be insider knowledge that most sellers don't know.
8. The title should reference the day and the single most important insight.
9. Tags should be relevant keywords that help with filtering and categorization.
10. Return ONLY the JSON object. No markdown, no explanation, no code blocks.`;
}

// ============================================================
// MAIN BRIEFING GENERATION FUNCTION
// ============================================================

export async function generateDailyBriefing(
  input: BriefingGenerateInput,
  env: Env
): Promise<BriefingGenerateResult> {
  // Step 1: Gather current dashboard context
  let context: string;
  try {
    context = await gatherDashboardContext(env);
  } catch {
    context = "No dashboard context available. Generate general digital business intelligence.";
  }

  // Step 2: Build the briefing prompt
  const prompt = buildBriefingPrompt(context, input);

  // Step 3: Run AI with failover (use "reasoning" task type for best quality)
  const result = await runWithFailover("reasoning", prompt, env);

  // Step 4: Parse the response
  const parsed = parseAIJSON(result.result) as unknown as {
    title: string;
    summary: string;
    sections: BriefingSection[];
  };

  // Validate required fields
  if (!parsed.title || !parsed.summary || !parsed.sections) {
    throw new Error("Briefing response missing required fields: title, summary, or sections");
  }

  // Validate sections have correct structure
  for (const section of parsed.sections) {
    if (!section.type || !section.title || !Array.isArray(section.items)) {
      throw new Error(`Invalid section structure: missing type, title, or items`);
    }
  }

  return {
    title: parsed.title,
    summary: parsed.summary,
    sections: parsed.sections,
    domains_analyzed: input.focus_domains ?? [],
    ai_model_used: result.model,
    tokens_used: result.tokens ?? 0,
  };
}
