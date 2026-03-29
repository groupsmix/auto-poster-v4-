// ============================================================
// HuggingFace Inference API Caller
// Models: Phi-4 (text), SDXL (image), MusicGen (audio),
//         Kokoro TTS, Coqui TTS (voice), CogView-3, Wan 2.6
// API: https://api-inference.huggingface.co/models/{model}
// ============================================================

import { AICallerError } from "./errors";

export interface HuggingFaceTextOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface HuggingFaceImageOptions {
  width?: number;
  height?: number;
  steps?: number;
}

export interface HuggingFaceTTSOptions {
  voice?: string;
}

// --- Text generation (Phi-4, etc.) ---

export async function callHuggingFaceText(
  model: string,
  apiKey: string,
  prompt: string,
  options?: HuggingFaceTextOptions
): Promise<{ text: string; tokens?: number }> {
  const fullPrompt = options?.systemPrompt
    ? `${options.systemPrompt}\n\n${prompt}`
    : prompt;

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature ?? 0.7,
          return_full_text: false,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new AICallerError(
      `HuggingFace API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as
    | Array<{ generated_text?: string }>
    | { generated_text?: string };

  const text = Array.isArray(data)
    ? data[0]?.generated_text ?? ""
    : data.generated_text ?? "";

  return { text };
}

// --- Image generation (SDXL, CogView-3, Wan 2.6, etc.) ---

export async function callHuggingFaceImage(
  model: string,
  apiKey: string,
  prompt: string,
  options?: HuggingFaceImageOptions
): Promise<{ imageData: ArrayBuffer }> {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width: options?.width ?? 1024,
          height: options?.height ?? 1024,
          num_inference_steps: options?.steps ?? 30,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new AICallerError(
      `HuggingFace Image API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const imageData = await response.arrayBuffer();
  return { imageData };
}

// --- Music generation (MusicGen) ---

export async function callHuggingFaceMusic(
  model: string,
  apiKey: string,
  prompt: string
): Promise<{ audioData: ArrayBuffer }> {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: prompt,
      }),
    }
  );

  if (!response.ok) {
    throw new AICallerError(
      `HuggingFace Music API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const audioData = await response.arrayBuffer();
  return { audioData };
}

// --- TTS (Kokoro, Coqui XTTS-v2) ---

export async function callHuggingFaceTTS(
  model: string,
  apiKey: string,
  text: string,
  _options?: HuggingFaceTTSOptions
): Promise<{ audioData: ArrayBuffer }> {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${model}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: text,
      }),
    }
  );

  if (!response.ok) {
    throw new AICallerError(
      `HuggingFace TTS API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const audioData = await response.arrayBuffer();
  return { audioData };
}
