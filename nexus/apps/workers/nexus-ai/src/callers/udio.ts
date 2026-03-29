// ============================================================
// Udio Music Generation Caller
// Different sonic character from Suno — strong for specific genres
// API: https://www.udio.com/api/generate-proxy
// ============================================================

import { AICallerError } from "./errors";

export interface UdioOptions {
  duration?: number;
  instrumental?: boolean;
  style?: string;
}

export async function callUdio(
  apiKey: string,
  prompt: string,
  options?: UdioOptions
): Promise<{ url: string; title?: string }> {
  const response = await fetch("https://www.udio.com/api/generate-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      generation_quality: "high",
      lyrics_type: options?.instrumental ? "instrumental" : "auto",
      custom_lyrics: options?.style ?? null,
    }),
  });

  if (!response.ok) {
    throw new AICallerError(
      `Udio API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    tracks?: Array<{ song_path?: string; title?: string }>;
  };

  const track = data.tracks?.[0];
  const url = track?.song_path ?? "";
  if (!url) {
    throw new AICallerError("Udio returned no audio URL", 500);
  }

  return { url, title: track?.title };
}
