// ============================================================
// Ideogram 3.0 Caller — Typography & graphic design
// Specialized in text rendering on images
// API: https://api.ideogram.ai/generate
// ============================================================

import { AICallerError } from "./errors";

export interface IdeogramOptions {
  aspectRatio?: string;
  model?: string;
  magicPromptOption?: "AUTO" | "ON" | "OFF";
  styleType?: string;
}

export async function callIdeogram(
  apiKey: string,
  prompt: string,
  options?: IdeogramOptions
): Promise<{ url: string }> {
  const response = await fetch("https://api.ideogram.ai/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify({
      image_request: {
        prompt,
        aspect_ratio: options?.aspectRatio ?? "ASPECT_1_1",
        model: options?.model ?? "V_2",
        magic_prompt_option: options?.magicPromptOption ?? "AUTO",
        style_type: options?.styleType ?? "DESIGN",
      },
    }),
  });

  if (!response.ok) {
    throw new AICallerError(
      `Ideogram API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    data?: Array<{ url?: string }>;
  };

  const url = data.data?.[0]?.url ?? "";
  if (!url) {
    throw new AICallerError("Ideogram returned no image URL", 500);
  }

  return { url };
}
