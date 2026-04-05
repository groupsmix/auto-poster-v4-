// ============================================================
// AI Chatbot Engine — Smart Business Partner
//
// The chatbot acts as an AI business partner that:
// 1. Understands the user's entire dashboard state
// 2. Brainstorms business ideas and strategies
// 3. Proposes concrete actions to take
// 4. Executes actions when the user says "apply"
// ============================================================

import type { Env } from "@nexus/shared";
import type { ChatAction, ChatActionType } from "@nexus/shared";
import { generateId } from "@nexus/shared";
import { runWithFailover } from "./failover";

// ============================================================
// SYSTEM PROMPT — The Business Partner Personality
// ============================================================

function buildSystemPrompt(dashboardContext: string): string {
  return `You are NEXUS AI — a smart AI business partner embedded inside the NEXUS dashboard. You are NOT a generic chatbot. You are a sharp, experienced business strategist who also has full control of the dashboard.

=== YOUR PERSONALITY ===
- Talk like a real business partner — direct, smart, no corporate fluff
- Be honest and strategic — if something is a bad idea, say so
- When the user wants to brainstorm, think deeply about market opportunities
- When the user wants to take action, propose specific steps
- You know everything about digital products, e-commerce, social media marketing, SEO, and content creation
- Think like someone who has made millions selling digital and physical products online

=== YOUR CAPABILITIES ===
You can control the entire NEXUS dashboard. When you want to take an action, include a JSON block in your response with the actions to execute. The user will see a confirmation button before any action is executed.

Available actions you can propose:
1. create_domain — Create a new business domain (e.g., "Real Estate", "Digital Art")
   params: { name: string, description?: string, icon?: string }
2. create_category — Create a category under a domain
   params: { domain_id: string, name: string, description?: string, auto_setup?: boolean, niche_hint?: string }
3. start_workflow — Start an AI product generation workflow
   params: { domain_id: string, category_id: string, niche: string, language?: string, batch_count?: number }
4. update_setting — Change a dashboard setting
   params: { key: string, value: string }
5. add_api_key — Add an AI provider API key
   params: { key_name: string }
6. ceo_setup — Run AI CEO analysis for a category (deep niche analysis + prompt generation)
   params: { domain_id: string, category_id: string, niche_hint?: string }
7. create_platform — Add a selling platform
   params: { name: string, slug: string }
8. create_social_channel — Add a social media channel
   params: { name: string, slug: string }
9. approve_product — Approve a product for publishing
   params: { product_id: string }
10. reject_product — Reject a product with feedback
    params: { product_id: string, feedback: string }
11. publish_product — Publish an approved product
    params: { product_id: string, platforms: string[], channels: string[] }
12. update_prompt — Update a prompt template
    params: { prompt_id: string, prompt: string }

=== CURRENT DASHBOARD STATE ===
${dashboardContext}

=== RESPONSE FORMAT ===
Always respond in natural conversational language. When you want to propose actions, include them in a JSON block at the END of your message like this:

\`\`\`actions
[
  {
    "type": "create_domain",
    "label": "Create Real Estate domain",
    "description": "Sets up a new Real Estate business domain",
    "params": { "name": "Real Estate", "description": "Luxury and residential real estate products" }
  }
]
\`\`\`

Rules:
- Only include the actions block when you're proposing something concrete to do
- For brainstorming/discussion, just talk naturally without actions
- When the user says "apply", "do it", "yes", or similar, reference the previous actions
- NEVER execute actions without proposing them first — always let the user confirm
- If you need more info to take action, ASK — don't guess
- Keep responses concise but valuable. No filler text.
- When suggesting niches or products, be SPECIFIC — mention real market data, trends, and strategies
- If the user asks about their current data (domains, products, etc.), reference the dashboard state above`;
}

// ============================================================
// GATHER DASHBOARD CONTEXT
// Collects current state from the dashboard for the AI
// ============================================================

export async function gatherDashboardContext(env: Env): Promise<string> {
  const sections: string[] = [];

  try {
    // Fetch domains
    const domainsResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: "SELECT id, name, slug, is_active FROM domains ORDER BY sort_order ASC", params: [] }),
    });
    const domainsJson = (await domainsResp.json()) as { success: boolean; data?: unknown[] };
    if (domainsJson.success && domainsJson.data) {
      sections.push(`Domains (${(domainsJson.data as unknown[]).length}): ${JSON.stringify(domainsJson.data)}`);
    }
  } catch { sections.push("Domains: unable to fetch"); }

  try {
    // Fetch categories
    const catsResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: "SELECT id, domain_id, name, slug FROM categories ORDER BY sort_order ASC", params: [] }),
    });
    const catsJson = (await catsResp.json()) as { success: boolean; data?: unknown[] };
    if (catsJson.success && catsJson.data) {
      sections.push(`Categories (${(catsJson.data as unknown[]).length}): ${JSON.stringify(catsJson.data)}`);
    }
  } catch { sections.push("Categories: unable to fetch"); }

  try {
    // Fetch product counts by status
    const productsResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: "SELECT status, COUNT(*) as count FROM products GROUP BY status", params: [] }),
    });
    const productsJson = (await productsResp.json()) as { success: boolean; data?: unknown[] };
    if (productsJson.success && productsJson.data) {
      sections.push(`Products by status: ${JSON.stringify(productsJson.data)}`);
    }
  } catch { sections.push("Products: unable to fetch"); }

  try {
    // Fetch recent workflow runs
    const runsResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sql: "SELECT id, status, started_at, completed_at FROM workflow_runs ORDER BY started_at DESC LIMIT 5",
        params: [],
      }),
    });
    const runsJson = (await runsResp.json()) as { success: boolean; data?: unknown[] };
    if (runsJson.success && runsJson.data) {
      sections.push(`Recent workflows (last 5): ${JSON.stringify(runsJson.data)}`);
    }
  } catch { sections.push("Workflows: unable to fetch"); }

  try {
    // Fetch platforms
    const platformsResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: "SELECT id, name, slug, is_active FROM platforms", params: [] }),
    });
    const platformsJson = (await platformsResp.json()) as { success: boolean; data?: unknown[] };
    if (platformsJson.success && platformsJson.data) {
      sections.push(`Platforms: ${JSON.stringify(platformsJson.data)}`);
    }
  } catch { sections.push("Platforms: unable to fetch"); }

  try {
    // Fetch social channels
    const socialResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: "SELECT id, name, slug, is_active FROM social_channels", params: [] }),
    });
    const socialJson = (await socialResp.json()) as { success: boolean; data?: unknown[] };
    if (socialJson.success && socialJson.data) {
      sections.push(`Social Channels: ${JSON.stringify(socialJson.data)}`);
    }
  } catch { sections.push("Social Channels: unable to fetch"); }

  try {
    // Fetch settings
    const settingsResp = await env.NEXUS_STORAGE.fetch("http://nexus-storage/d1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql: "SELECT key, value FROM settings", params: [] }),
    });
    const settingsJson = (await settingsResp.json()) as { success: boolean; data?: unknown[] };
    if (settingsJson.success && settingsJson.data) {
      sections.push(`Settings: ${JSON.stringify(settingsJson.data)}`);
    }
  } catch { sections.push("Settings: unable to fetch"); }

  return sections.join("\n");
}

// ============================================================
// PARSE ACTIONS FROM AI RESPONSE
// Extracts the ```actions JSON block from the response
// ============================================================

function parseActionsFromResponse(content: string): { cleanContent: string; actions: ChatAction[] } {
  const actionsMatch = content.match(/```actions\s*([\s\S]*?)```/);
  if (!actionsMatch?.[1]) {
    return { cleanContent: content.trim(), actions: [] };
  }

  // Remove the actions block from the visible content
  const cleanContent = content.replace(/```actions\s*[\s\S]*?```/, "").trim();

  try {
    const rawActions = JSON.parse(actionsMatch[1].trim()) as Array<{
      type: ChatActionType;
      label: string;
      description: string;
      params: Record<string, unknown>;
    }>;

    const actions: ChatAction[] = rawActions.map((a) => ({
      id: generateId(),
      type: a.type,
      label: a.label,
      description: a.description,
      params: a.params,
    }));

    return { cleanContent, actions };
  } catch {
    return { cleanContent: content.trim(), actions: [] };
  }
}

// ============================================================
// MAIN CHAT FUNCTION
// Takes user message + conversation history, returns AI response
// ============================================================

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export async function runChatbot(
  userMessage: string,
  history: ChatHistoryMessage[],
  env: Env
): Promise<{ content: string; actions: ChatAction[] }> {
  // Gather current dashboard state
  const dashboardContext = await gatherDashboardContext(env);

  // Build the full prompt with system context + history + new message
  const systemPrompt = buildSystemPrompt(dashboardContext);

  // Build conversation as a single prompt (since we use runWithFailover which takes a single string)
  const parts: string[] = [systemPrompt, ""];

  // Add conversation history (last 20 messages to stay within context limits)
  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    if (msg.role === "user") {
      parts.push(`User: ${msg.content}`);
    } else {
      parts.push(`Assistant: ${msg.content}`);
    }
  }

  // Add current user message
  parts.push(`User: ${userMessage}`);
  parts.push("Assistant:");

  const fullPrompt = parts.join("\n");

  // Use the "writing" task type for conversational responses
  const result = await runWithFailover("writing", fullPrompt, env);

  // Parse out any proposed actions from the response
  const { cleanContent, actions } = parseActionsFromResponse(result.result);

  return { content: cleanContent, actions };
}
