// ============================================================
// Qwen AI Caller (via SiliconFlow API)
// Models: Qwen 3.5 Flash, Qwen 3.5 Max, Qwen 3.5 Coder
// API: https://api.siliconflow.cn/v1/chat/completions (OpenAI-compatible)
// ============================================================

import { AICallerError } from "./errors";

export interface QwenOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export async function callQwen(
  model: string,
  apiKey: string,
  prompt: string,
  options?: QwenOptions
): Promise<{ text: string; tokens?: number }> {
  const messages: Array<{ role: string; content: string }> = [];
  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(
      "https://api.siliconflow.cn/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.7,
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AICallerError("Qwen/SiliconFlow timed out after 15s", 408);
    }
    throw e;
  }

  if (!response.ok) {
    throw new AICallerError(
      `Qwen/SiliconFlow API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  const tokens = data.usage?.total_tokens;

  return { text, tokens };
}
