// ============================================================
// Exa Neural Search Caller
// Finds by meaning, not keywords — discovers emerging niches
// API: https://api.exa.ai/search
// ============================================================

import { AICallerError } from "./errors";

export interface ExaOptions {
  numResults?: number;
  useAutoprompt?: boolean;
  type?: "keyword" | "neural" | "auto";
  contentsOptions?: { text?: boolean; highlights?: boolean };
}

export interface ExaResult {
  title: string;
  url: string;
  text: string;
  score: number;
}

export async function callExa(
  apiKey: string,
  query: string,
  options?: ExaOptions
): Promise<{ text: string; results: ExaResult[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        query,
        num_results: options?.numResults ?? 5,
        use_autoprompt: options?.useAutoprompt ?? true,
        type: options?.type ?? "auto",
        contents: options?.contentsOptions ?? { text: true },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AICallerError("Exa timed out after 15s", 408);
    }
    throw e;
  }

  if (!response.ok) {
    throw new AICallerError(
      `Exa API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      text?: string;
      score?: number;
    }>;
  };

  const results: ExaResult[] = (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    text: r.text ?? "",
    score: r.score ?? 0,
  }));

  const text = results
    .map((r) => `${r.title}\n${r.url}\n${r.text}`)
    .join("\n\n");

  return { text, results };
}
