// ============================================================
// Segmind Caller — Serverless Stable Diffusion endpoints
// Fast image generation fallback
// API: https://api.segmind.com/v1/{model}
// ============================================================

import { AICallerError } from "./errors";

export interface SegmindOptions {
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  negativePrompt?: string;
}

export async function callSegmind(
  apiKey: string,
  prompt: string,
  options?: SegmindOptions
): Promise<{ imageData: ArrayBuffer }> {
  const model = options?.model ?? "sdxl1.0-txt2img";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`https://api.segmind.com/v1/${model}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: options?.negativePrompt ?? "",
        img_width: options?.width ?? 1024,
        img_height: options?.height ?? 1024,
        steps: options?.steps ?? 25,
        seed: Math.floor(Math.random() * 1000000),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new AICallerError("Segmind timed out after 15s", 408);
    }
    throw e;
  }

  if (!response.ok) {
    throw new AICallerError(
      `Segmind API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const imageData = await response.arrayBuffer();
  return { imageData };
}
