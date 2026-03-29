// ============================================================
// AI Gateway Integration
// Routes all external AI calls through Cloudflare AI Gateway
// Provides: logging, response caching, rate limiting, analytics,
//           retry logic, fallback routing
// ============================================================

import type { AIModelConfig } from "./registry";

/** Env bindings for AI Gateway */
interface GatewayEnv {
  AI_GATEWAY_ACCOUNT_ID: string;
  AI_GATEWAY_ID: string;
  [key: string]: unknown; // for dynamic API key lookups
}

/** Gateway call log entry */
export interface GatewayCallLog {
  provider: string;
  model: string;
  tokens?: number;
  latencyMs: number;
  success: boolean;
  timestamp: number;
}

/** Provider-to-gateway path mapping */
const PROVIDER_GATEWAY_MAP: Record<string, string> = {
  deepseek: "deepseek",
  qwen: "siliconflow",
  doubao: "siliconflow",
  groq: "groq",
  fireworks: "fireworks-ai",
  moonshot: "moonshot",
  minimax: "minimax",
  huggingface: "huggingface",
};

/** Provider-to-base-URL mapping (for direct calls when gateway is unavailable) */
const PROVIDER_BASE_URL: Record<string, string> = {
  deepseek: "https://api.deepseek.com",
  qwen: "https://api.siliconflow.cn/v1",
  doubao: "https://api.siliconflow.cn/v1",
  groq: "https://api.groq.com/openai/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  moonshot: "https://api.moonshot.cn/v1",
  minimax: "https://api.minimax.chat/v1",
  huggingface: "https://api-inference.huggingface.co",
};

// In-memory call log (recent calls for diagnostics)
const recentCalls: GatewayCallLog[] = [];
const MAX_RECENT_CALLS = 100;

function logCall(entry: GatewayCallLog): void {
  recentCalls.push(entry);
  if (recentCalls.length > MAX_RECENT_CALLS) {
    recentCalls.shift();
  }
}

export function getRecentCalls(): GatewayCallLog[] {
  return [...recentCalls];
}

// ============================================================
// MAIN GATEWAY CALLER
// ============================================================

export async function callAIviaGateway(
  model: AIModelConfig,
  apiKey: string,
  prompt: string,
  env: GatewayEnv
): Promise<{ text: string; tokens?: number }> {
  const start = Date.now();
  const gatewayProvider = PROVIDER_GATEWAY_MAP[model.provider];

  // Build the request URL — try gateway first, fall back to direct
  let url: string;
  if (env.AI_GATEWAY_ACCOUNT_ID && env.AI_GATEWAY_ID && gatewayProvider) {
    url = `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_ID}/${gatewayProvider}/chat/completions`;
  } else {
    const baseUrl = PROVIDER_BASE_URL[model.provider];
    if (!baseUrl) {
      throw new GatewayError(
        `Unknown provider: ${model.provider}`,
        500
      );
    }
    url = `${baseUrl}/chat/completions`;
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: "user", content: prompt },
  ];

  const body: Record<string, unknown> = {
    model: model.model ?? model.id,
    messages,
    max_tokens: 4096,
    temperature: 0.7,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      logCall({
        provider: model.provider,
        model: model.name,
        latencyMs,
        success: false,
        timestamp: Date.now(),
      });

      throw new GatewayError(
        `Gateway ${model.provider} error: ${response.status} ${response.statusText}`,
        response.status
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    const text = data.choices?.[0]?.message?.content ?? "";
    const tokens = data.usage?.total_tokens;

    logCall({
      provider: model.provider,
      model: model.name,
      tokens,
      latencyMs,
      success: true,
      timestamp: Date.now(),
    });

    console.log(
      `[GATEWAY] ${model.provider}/${model.name} — ${latencyMs}ms, ${tokens ?? "?"} tokens`
    );

    return { text, tokens };
  } catch (err) {
    const latencyMs = Date.now() - start;

    if (err instanceof GatewayError) throw err;

    logCall({
      provider: model.provider,
      model: model.name,
      latencyMs,
      success: false,
      timestamp: Date.now(),
    });

    throw new GatewayError(
      `Gateway call failed for ${model.name}: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }
}

// ============================================================
// GATEWAY ERROR
// ============================================================

export class GatewayError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
    this.code = code;
  }
}
