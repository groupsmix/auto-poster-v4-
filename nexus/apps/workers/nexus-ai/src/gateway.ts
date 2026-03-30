// ============================================================
// V4: AI Gateway Integration
// Routes ALL external AI calls through Cloudflare AI Gateway
// Gateway provides: logging, caching, rate limiting, analytics,
//   retry logic, fallback routing — all FREE with $5 plan
// Endpoint: https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/{provider}/{model}
// ============================================================

import type { AIModelConfig } from "./registry";
import type { Env } from "@nexus/shared";

/** Provider-to-gateway path mapping */
const PROVIDER_GATEWAY_MAP: Record<string, string> = {
  deepseek: "deepseek",
  qwen: "siliconflow",
  doubao: "siliconflow",
  groq: "groq",
  fireworks: "fireworks",
  moonshot: "moonshot",
  huggingface: "huggingface",
  minimax: "minimax",
};

/** Provider-to-base-URL mapping for API calls */
const PROVIDER_API_URL: Record<string, string> = {
  deepseek: "https://api.deepseek.com/chat/completions",
  qwen: "https://api.siliconflow.cn/v1/chat/completions",
  doubao: "https://api.siliconflow.cn/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  fireworks: "https://api.fireworks.ai/inference/v1/chat/completions",
  moonshot: "https://api.moonshot.cn/v1/chat/completions",
  huggingface: "https://api-inference.huggingface.co/models",
  minimax: "https://api.minimax.chat/v1/text/chatcompletion_v2",
};

/** Result from an AI Gateway call */
export interface GatewayCallResult {
  text: string;
  tokens?: number;
  provider: string;
  model: string;
  latencyMs: number;
  success: boolean;
}

/** Retry configuration */
const RETRY_MAX_ATTEMPTS = 1;
const RETRY_BASE_DELAY_MS = 1000;

/** Retryable HTTP status codes */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

// ============================================================
// CALL AI VIA GATEWAY — route external AI calls through CF AI Gateway
// ============================================================

export async function callAIviaGateway(
  model: AIModelConfig,
  apiKey: string,
  prompt: string,
  env: Env
): Promise<{ text: string; tokens?: number }> {
  // Retry wrapper: attempt once, retry on transient errors before failing
  for (let attempt = 0; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await callAIviaGatewayInternal(model, apiKey, prompt, env);
    } catch (err) {
      const status = (err as { status?: number }).status;
      const isRetryable = status !== undefined && RETRYABLE_STATUSES.has(status);
      if (attempt < RETRY_MAX_ATTEMPTS && isRetryable) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(
          `[GATEWAY RETRY] ${model.provider}/${model.model ?? model.id} -- attempt ${attempt + 1}, waiting ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  // Unreachable, but TypeScript requires a return
  throw new Error("Unexpected: retry loop exited without return or throw");
}

async function callAIviaGatewayInternal(
  model: AIModelConfig,
  apiKey: string,
  prompt: string,
  env: Env
): Promise<{ text: string; tokens?: number }> {
  const start = Date.now();
  const provider = model.provider;
  const modelId = model.model ?? model.id;

  // Build the request URL — route through AI Gateway if configured, otherwise direct
  const gatewayPath = PROVIDER_GATEWAY_MAP[provider];
  const accountId = env.CF_ACCOUNT_ID as string | undefined;
  const gatewayId = env.AI_GATEWAY_ID as string | undefined;
  let apiUrl: string;

  if (gatewayPath && accountId && gatewayId) {
    // Route through CF AI Gateway for logging, caching, rate limiting, analytics
    apiUrl = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${gatewayPath}`;
  } else {
    // Fallback to direct API call if gateway is not configured
    const directUrl = PROVIDER_API_URL[provider];
    if (!directUrl) {
      throw new Error(`Unknown provider for gateway: ${provider}`);
    }
    apiUrl = directUrl;
  }

  let response: Response;

  if (provider === "huggingface") {
    // HuggingFace uses a different API format
    const url = gatewayPath && accountId && gatewayId
      ? `${apiUrl}/${modelId}`
      : `${apiUrl}/${modelId}`;
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 4096, temperature: 0.7 },
      }),
    });
  } else {
    // OpenAI-compatible format (DeepSeek, Qwen, Doubao, Groq, Fireworks, Moonshot, MiniMax)
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });
  }

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.log(
      `[GATEWAY FAIL] ${provider}/${modelId} -- ${response.status} (${latencyMs}ms)`
    );

    // Rethrow with status for failover error handling
    const err: Error & { status?: number; code?: string } = new Error(
      `Gateway call failed: ${provider}/${modelId} -- ${response.status} ${errorText}`
    );
    err.status = response.status;
    // Check for quota exceeded in error body
    if (errorText.includes("QUOTA_EXCEEDED") || errorText.includes("quota")) {
      err.code = "QUOTA_EXCEEDED";
    }
    throw err;
  }

  // Parse response based on provider
  let text = "";
  let tokens: number | undefined;

  if (provider === "huggingface") {
    const data = (await response.json()) as
      | Array<{ generated_text?: string }>
      | { generated_text?: string };
    if (Array.isArray(data)) {
      text = data[0]?.generated_text ?? "";
    } else {
      text = data.generated_text ?? "";
    }
  } else {
    // OpenAI-compatible response
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };
    text = data.choices?.[0]?.message?.content ?? "";
    tokens = data.usage?.total_tokens;
  }

  console.log(
    `[GATEWAY OK] ${provider}/${modelId} -- ${latencyMs}ms, tokens: ${tokens ?? "n/a"}`
  );

  return { text, tokens };
}
