// ============================================================
// Google Cloud Callers — Vision OCR & Text-to-Speech
// Free tier: 1000 units/month for Vision, TTS
// ============================================================

import { AICallerError } from "./errors";

// ============================================================
// Google Vision OCR
// API: https://vision.googleapis.com/v1/images:annotate
// ============================================================

export interface GoogleVisionOptions {
  languageHints?: string[];
}

export async function callGoogleVisionOCR(
  apiKey: string,
  imageUrl: string,
  options?: GoogleVisionOptions
): Promise<{ text: string }> {
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: { source: { imageUri: imageUrl } },
            features: [{ type: "TEXT_DETECTION", maxResults: 1 }],
            imageContext: {
              languageHints: options?.languageHints ?? ["en"],
            },
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new AICallerError(
      `Google Vision API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      error?: { message?: string; code?: number };
    }>;
  };

  const result = data.responses?.[0];
  if (result?.error) {
    throw new AICallerError(
      `Google Vision error: ${result.error.message}`,
      result.error.code ?? 500
    );
  }

  const text = result?.fullTextAnnotation?.text ?? "";
  return { text };
}

// ============================================================
// Google Text-to-Speech
// API: https://texttospeech.googleapis.com/v1/text:synthesize
// ============================================================

export interface GoogleTTSOptions {
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
  audioEncoding?: "MP3" | "LINEAR16" | "OGG_OPUS";
}

export async function callGoogleTTS(
  apiKey: string,
  text: string,
  options?: GoogleTTSOptions
): Promise<{ audioContent: string }> {
  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: options?.languageCode ?? "en-US",
          name: options?.voiceName ?? "en-US-Neural2-D",
        },
        audioConfig: {
          audioEncoding: options?.audioEncoding ?? "MP3",
          speakingRate: options?.speakingRate ?? 1.0,
          pitch: options?.pitch ?? 0,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new AICallerError(
      `Google TTS API error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    audioContent?: string;
  };

  const audioContent = data.audioContent ?? "";
  if (!audioContent) {
    throw new AICallerError("Google TTS returned no audio content", 500);
  }

  // audioContent is base64-encoded audio
  return { audioContent };
}
