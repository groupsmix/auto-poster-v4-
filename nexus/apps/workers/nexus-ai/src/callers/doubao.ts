// ============================================================
// Doubao AI Caller (via SiliconFlow API)
// Models: Doubao 1.5 Pro, Doubao 1.5 Lite (ByteDance)
// API: https://api.siliconflow.cn/v1/chat/completions (OpenAI-compatible)
// ============================================================

import { AICallerError } from "./errors";

export interface DoubaoOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export async function callDoubao(
  model: string,
  apiKey: string,
  prompt: string,
  options?: DoubaoOptions
): Promise<{ text: string; tokens?: number }> {
  const messages: Array<{ role: string; content: string }> = [];
  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch(
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
    }
  );

  if (!response.ok) {
    throw new AICallerError(
      `Doubao/SiliconFlow API error: ${response.status} ${response.statusText}`,
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
