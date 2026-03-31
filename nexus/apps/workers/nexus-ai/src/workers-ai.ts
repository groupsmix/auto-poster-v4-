// ============================================================
// Workers AI Fallback Caller
// On-platform via env.AI.run() — no API key needed
// These NEVER fail (included in $5/month Workers plan)
// ============================================================

import type { Env } from "@nexus/shared";
import { trackNeuronUsage } from "./neuron-tracker";

/** Env binding for Workers AI */
interface WorkersAIEnv {
  AI: {
    run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
  };
}

/** Text generation result from Workers AI */
interface TextGenResult {
  response?: string;
}

/** Image generation result from Workers AI (raw bytes) */
type ImageGenResult = ReadableStream | ArrayBuffer | Uint8Array;

/** Speech-to-text result from Workers AI */
interface SpeechToTextResult {
  text?: string;
  vtt?: string;
}

// ============================================================
// TEXT GENERATION — @cf/meta/llama-3.1-8b-instruct
// ============================================================

export async function runTextGeneration(
  env: WorkersAIEnv,
  prompt: string,
  options?: { maxTokens?: number; temperature?: number; systemPrompt?: string }
): Promise<{ text: string; tokens?: number }> {
  const modelName = "@cf/meta/llama-3.1-8b-instruct";
  const messages: Array<{ role: string; content: string }> = [];

  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const result = (await env.AI.run(modelName, {
    messages,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 0.7,
  })) as TextGenResult;

  const text = result.response ?? "";
  // Estimate tokens from response length (rough: 1 token ≈ 4 chars)
  const estimatedTokens = Math.ceil((prompt.length + text.length) / 4);

  // Track neuron usage for Workers AI calls
  await trackNeuronUsage(modelName, estimatedTokens, env as unknown as Env).catch(() => {
    // Non-critical — don't block the response
  });

  return { text, tokens: estimatedTokens };
}

// ============================================================
// IMAGE GENERATION — @cf/stabilityai/stable-diffusion-xl-base-1.0
// ============================================================

export async function runImageGeneration(
  env: WorkersAIEnv,
  prompt: string,
  options?: { steps?: number; width?: number; height?: number }
): Promise<{ image: Uint8Array }> {
  const result = (await env.AI.run(
    "@cf/stabilityai/stable-diffusion-xl-base-1.0",
    {
      prompt,
      num_steps: options?.steps ?? 20,
      width: options?.width ?? 1024,
      height: options?.height ?? 1024,
    }
  )) as ImageGenResult;

  if (result instanceof Uint8Array) {
    return { image: result };
  }
  if (result instanceof ArrayBuffer) {
    return { image: new Uint8Array(result) };
  }
  // ReadableStream — collect chunks
  const reader = (result as ReadableStream).getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const read = await reader.read();
    done = read.done;
    if (read.value) chunks.push(read.value as Uint8Array);
  }
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return { image: merged };
}

// ============================================================
// SPEECH-TO-TEXT — @cf/openai/whisper
// ============================================================

export async function runSpeechToText(
  env: WorkersAIEnv,
  audio: ArrayBuffer | Uint8Array
): Promise<{ text: string; vtt?: string }> {
  const audioArray = audio instanceof ArrayBuffer ? [...new Uint8Array(audio)] : [...audio];

  const result = (await env.AI.run("@cf/openai/whisper", {
    audio: audioArray,
  })) as SpeechToTextResult;

  return {
    text: result.text ?? "",
    vtt: result.vtt,
  };
}
