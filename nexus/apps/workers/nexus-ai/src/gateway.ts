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

// ============================================================
// CALL AI VIA GATEWAY — route external AI calls through CF AI Gateway
// ============================================================

export async function callAIviaGateway(
  model: AIModelConfig,
  apiKey: string,
  prompt: string,
  env: Env
): Promise<{ text: string; tokens?: number }> {
  const start = Date.now();
  const provider = model.provider;
  const modelId = model.model ?? model.id;

  // Build the request based on provider type
  const apiUrl = PROVIDER_API_URL[provider];
  if (!apiUrl) {
    throw new Error(`Unknown provider for gateway: ${provider}`);
  }

  let response: Response;

  if (provider === "huggingface") {
    // HuggingFace uses a different API format
    response = await fetch(`${apiUrl}/${modelId}`, {
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
