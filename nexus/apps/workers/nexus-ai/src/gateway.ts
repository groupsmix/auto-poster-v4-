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
  anthropic: "anthropic",
  openai: "openai",
  google: "google-ai-studio",
  perplexity: "perplexity",
  together: "together-ai",
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
  anthropic: "https://api.anthropic.com/v1/messages",
  openai: "https://api.openai.com/v1/chat/completions",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
  perplexity: "https://api.perplexity.ai/chat/completions",
  together: "https://api.together.xyz/v1/images/generations",
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

/** Retry configuration — increased from 1 to 2 for better resilience (code-review #20) */
const RETRY_MAX_ATTEMPTS = 2;
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    // Split prompt into system + user messages for better role adherence.
    // Convention: everything before "=== TASK ===" is system context;
    // everything from "=== TASK ===" onward is the user request.
    const taskSplit = prompt.indexOf("=== TASK ===");
    const systemContent = taskSplit > 0
      ? prompt.slice(0, taskSplit).trim()
      : "You are NEXUS — a world-class AI business engine. Follow all instructions precisely and output valid JSON only.";
    const userContent = taskSplit > 0
      ? prompt.slice(taskSplit).trim()
      : prompt;

    if (provider === "huggingface") {
      // HuggingFace uses a different API format
      const url = `${apiUrl}/${modelId}`;
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
        signal: controller.signal,
      });
    } else if (provider === "anthropic") {
      // Anthropic uses x-api-key header and a different body structure
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelId,
          system: systemContent,
          messages: [{ role: "user", content: userContent }],
          max_tokens: 4096,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } else if (provider === "google") {
      // Google Gemini uses generateContent endpoint with API key as query param
      const url = `${apiUrl}/${modelId}:generateContent?key=${apiKey}`;
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemContent }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
        }),
        signal: controller.signal,
      });
    } else {
      // OpenAI-compatible format (DeepSeek, Qwen, Doubao, Groq, Fireworks, Moonshot, MiniMax, OpenAI, Perplexity)
      const messages = [
        { role: "system" as const, content: systemContent },
        { role: "user" as const, content: userContent },
      ];

      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          max_tokens: 4096,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    }
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      const err: Error & { status?: number } = new Error(
        `Gateway call timed out: ${provider}/${modelId} after 15s`
      );
      err.status = 408;
      throw err;
    }
    throw e;
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
  } else if (provider === "anthropic") {
    // Anthropic response format
    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    text = data.content?.find((c) => c.type === "text")?.text ?? "";
    tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0) || undefined;
  } else if (provider === "google") {
    // Google Gemini response format
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { totalTokenCount?: number };
    };
    text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    tokens = data.usageMetadata?.totalTokenCount;
  } else {
    // OpenAI-compatible response (OpenAI, DeepSeek, Qwen, Doubao, Groq, Fireworks, Moonshot, MiniMax, Perplexity)
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

// ============================================================
// CALL IMAGE GENERATION VIA TOGETHER.AI
// Returns base64 image data from Together.ai Flux models
// ============================================================

export async function callImageViaGateway(
  model: AIModelConfig,
  apiKey: string,
  prompt: string,
  options: { width?: number; height?: number; steps?: number } = {}
): Promise<{ imageBase64: string; model: string }> {
  const modelId = model.model ?? model.id;
  const start = Date.now();

  const apiUrl = PROVIDER_API_URL[model.provider];
  if (!apiUrl) {
    throw new Error(`Unknown provider for image generation: ${model.provider}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for image gen

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        prompt,
        width: options.width ?? 1024,
        height: options.height ?? 1024,
        steps: options.steps ?? 28,
        n: 1,
        response_format: "b64_json",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      const err: Error & { status?: number } = new Error(
        `Image generation timed out: ${model.provider}/${modelId} after 60s`
      );
      err.status = 408;
      throw err;
    }
    throw e;
  }

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.log(
      `[IMAGE FAIL] ${model.provider}/${modelId} -- ${response.status} (${latencyMs}ms)`
    );
    const err: Error & { status?: number; code?: string } = new Error(
      `Image generation failed: ${model.provider}/${modelId} -- ${response.status} ${errorText}`
    );
    err.status = response.status;
    if (errorText.includes("QUOTA_EXCEEDED") || errorText.includes("quota")) {
      err.code = "QUOTA_EXCEEDED";
    }
    throw err;
  }

  const data = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const imageData = data.data?.[0]?.b64_json;
  if (!imageData) {
    throw new Error(`No image data returned from ${model.provider}/${modelId}`);
  }

  console.log(
    `[IMAGE OK] ${model.provider}/${modelId} -- ${latencyMs}ms`
  );

  return { imageBase64: imageData, model: `${model.provider}/${modelId}` };
}
