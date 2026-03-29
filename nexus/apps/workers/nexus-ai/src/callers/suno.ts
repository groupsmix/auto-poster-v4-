// ============================================================
// Suno Music Generation Caller
// API: https://studio-api.suno.ai/api/generate/v2/
// 50 songs/day free tier
// ============================================================

import { AICallerError } from "./errors";

export interface SunoOptions {
  duration?: number;
  instrumental?: boolean;
  style?: string;
}

export async function callSuno(
  apiKey: string,
  prompt: string,
  options?: SunoOptions
): Promise<{ url: string; title?: string }> {
  const response = await fetch("https://studio-api.suno.ai/api/generate/v2/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      gpt_description_prompt: prompt,
      make_instrumental: options?.instrumental ?? false,
      mv: "chirp-v3-5",
      prompt: options?.style ?? "",
    }),
  });

  if (!response.ok) {
    throw new AICallerError(
      `Suno API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    clips?: Array<{ audio_url?: string; title?: string }>;
  };

  const clip = data.clips?.[0];
  const url = clip?.audio_url ?? "";
  if (!url) {
    throw new AICallerError("Suno returned no audio URL", 500);
  }

  return { url, title: clip?.title };
}
