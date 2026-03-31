// ============================================================
// Tavily Search Caller
// Purpose-built for AI agents — returns clean structured web data
// API: https://api.tavily.com/search
// ============================================================

import { AICallerError } from "./errors";

export interface TavilyOptions {
  searchDepth?: "basic" | "advanced";
  maxResults?: number;
  includeAnswer?: boolean;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function callTavily(
  apiKey: string,
  query: string,
  options?: TavilyOptions
): Promise<{ text: string; results: TavilyResult[] }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: options?.searchDepth ?? "basic",
        max_results: options?.maxResults ?? 5,
        include_answer: options?.includeAnswer ?? true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AICallerError("Tavily timed out after 15s", 408);
    }
    throw e;
  }

  if (!response.ok) {
    throw new AICallerError(
      `Tavily API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    answer?: string;
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      score?: number;
    }>;
  };

  const results: TavilyResult[] = (data.results ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    content: r.content ?? "",
    score: r.score ?? 0,
  }));

  const text =
    data.answer ??
    results.map((r) => `${r.title}\n${r.url}\n${r.content}`).join("\n\n");

  return { text, results };
}
