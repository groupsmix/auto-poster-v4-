// ============================================================
// SerpAPI Caller — Raw Google results
// Reliable backup for trend data and SEO research
// API: https://serpapi.com/search.json
// ============================================================

import { AICallerError } from "./errors";

export interface SerpAPIOptions {
  engine?: string;
  location?: string;
  num?: number;
}

export interface SerpAPIResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export async function callSerpAPI(
  apiKey: string,
  query: string,
  options?: SerpAPIOptions
): Promise<{ text: string; results: SerpAPIResult[] }> {
  const params = new URLSearchParams({
    api_key: apiKey,
    q: query,
    engine: options?.engine ?? "google",
    num: String(options?.num ?? 10),
  });

  if (options?.location) {
    params.set("location", options.location);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(
      `https://serpapi.com/search.json?${params.toString()}`,
      { method: "GET", signal: controller.signal }
    );
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AICallerError("SerpAPI timed out after 15s", 408);
    }
    throw e;
  }

  if (!response.ok) {
    throw new AICallerError(
      `SerpAPI error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    organic_results?: Array<{
      title?: string;
      link?: string;
      snippet?: string;
      position?: number;
    }>;
  };

  const results: SerpAPIResult[] = (data.organic_results ?? []).map((r) => ({
    title: r.title ?? "",
    link: r.link ?? "",
    snippet: r.snippet ?? "",
    position: r.position ?? 0,
  }));

  const text = results
    .map((r) => `${r.position}. ${r.title}\n${r.link}\n${r.snippet}`)
    .join("\n\n");

  return { text, results };
}
