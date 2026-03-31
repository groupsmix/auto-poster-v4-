// ============================================================
// MiniMax AI Caller
// Models: MiniMax M2.5 — best "human-like flow"
// API: https://api.minimax.chat/v1/text/chatcompletion_v2
// ============================================================

import { AICallerError } from "./errors";

export interface MiniMaxOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export async function callMiniMax(
  apiKey: string,
  prompt: string,
  options?: MiniMaxOptions
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
      "https://api.minimax.chat/v1/text/chatcompletion_v2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "MiniMax-Text-01",
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
      throw new AICallerError("MiniMax timed out after 15s", 408);
    }
    throw e;
  }

  if (!response.ok) {
    throw new AICallerError(
      `MiniMax API error: ${response.status} ${response.statusText}`,
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
