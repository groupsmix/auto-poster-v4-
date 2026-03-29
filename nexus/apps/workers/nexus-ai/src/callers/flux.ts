// ============================================================
// fal.ai Caller — FLUX.1 Pro and other image models
// API: https://fal.run/{model-id}
// ============================================================

import { AICallerError } from "./errors";

export interface FalOptions {
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
}

export async function callFal(
  apiKey: string,
  prompt: string,
  options?: FalOptions
): Promise<{ url: string }> {
  const model = options?.model ?? "fal-ai/flux-pro";

  const response = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: {
        width: options?.width ?? 1024,
        height: options?.height ?? 1024,
      },
      num_inference_steps: options?.steps ?? 28,
    }),
  });

  if (!response.ok) {
    throw new AICallerError(
      `fal.ai API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    images?: Array<{ url?: string }>;
  };

  const url = data.images?.[0]?.url ?? "";
  if (!url) {
    throw new AICallerError("fal.ai returned no image URL", 500);
  }

  return { url };
}
