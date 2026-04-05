// ============================================================
// DataForSEO Caller — Keyword volume + difficulty data
// Most accurate SEO data provider
// API: https://api.dataforseo.com/v3/
// ============================================================

import { AICallerError } from "./errors";

export interface DataForSEOOptions {
  locationCode?: number;
  languageCode?: string;
}

export interface KeywordResult {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
  difficulty: number;
}

export async function callDataForSEO(
  apiKey: string,
  keywords: string[],
  options?: DataForSEOOptions
): Promise<{ text: string; results: KeywordResult[] }> {
  // apiKey format: "login:password" base64 encoded
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(
      "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${apiKey}`,
        },
        body: JSON.stringify([
          {
            keywords,
            location_code: options?.locationCode ?? 2840, // US
            language_code: options?.languageCode ?? "en",
          },
        ]),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AICallerError("DataForSEO timed out after 15s", 408);
    }
    throw e;
  }

  if (!response.ok) {
    throw new AICallerError(
      `DataForSEO API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    tasks?: Array<{
      result?: Array<{
        keyword?: string;
        search_volume?: number;
        competition?: number;
        cpc?: number;
        keyword_difficulty?: number;
      }>;
    }>;
  };

  const rawResults = data.tasks?.[0]?.result ?? [];
  const results: KeywordResult[] = rawResults.map((r) => ({
    keyword: r.keyword ?? "",
    searchVolume: r.search_volume ?? 0,
    competition: r.competition ?? 0,
    cpc: r.cpc ?? 0,
    difficulty: r.keyword_difficulty ?? 0,
  }));

  const text = results
    .map(
      (r) =>
        `${r.keyword}: vol=${r.searchVolume}, comp=${r.competition}, cpc=$${r.cpc}, diff=${r.difficulty}`
    )
    .join("\n");

  return { text, results };
}
