// ============================================================
// Mistral OCR Caller
// Best open OCR for documents — free tier
// API: https://api.mistral.ai/v1/chat/completions (vision endpoint)
// ============================================================

import { AICallerError } from "./errors";

export interface MistralOCROptions {
  model?: string;
}

export async function callMistralOCR(
  apiKey: string,
  imageUrl: string,
  options?: MistralOCROptions
): Promise<{ text: string }> {
  const model = options?.model ?? "mistral-small-latest";

  const response = await fetch(
    "https://api.mistral.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
              {
                type: "text",
                text: "Extract all text from this image. Return only the extracted text, preserving formatting where possible.",
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    }
  );

  if (!response.ok) {
    throw new AICallerError(
      `Mistral OCR API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = data.choices?.[0]?.message?.content ?? "";
  return { text };
}
