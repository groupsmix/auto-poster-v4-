// ============================================================
// Clipdrop Caller — Image editing operations
// Background removal, upscaling, cleanup
// API: https://clipdrop-api.co/
// ============================================================

import { AICallerError } from "./errors";

export type ClipDropOperation =
  | "remove-background"
  | "image-upscaling"
  | "cleanup"
  | "reimagine";

export interface ClipDropOptions {
  operation: ClipDropOperation;
}

/** Remove background from an image */
export async function callClipDropRemoveBackground(
  apiKey: string,
  imageData: ArrayBuffer
): Promise<{ imageData: ArrayBuffer }> {
  const formData = new FormData();
  formData.append(
    "image_file",
    new Blob([imageData], { type: "image/png" })
  );

  const response = await fetch(
    "https://clipdrop-api.co/remove-background/v1",
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new AICallerError(
      `Clipdrop remove-background error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const result = await response.arrayBuffer();
  return { imageData: result };
}

/** Upscale an image */
export async function callClipDropUpscale(
  apiKey: string,
  imageData: ArrayBuffer,
  targetWidth?: number,
  targetHeight?: number
): Promise<{ imageData: ArrayBuffer }> {
  const formData = new FormData();
  formData.append(
    "image_file",
    new Blob([imageData], { type: "image/png" })
  );
  formData.append("target_width", String(targetWidth ?? 2048));
  formData.append("target_height", String(targetHeight ?? 2048));

  const response = await fetch(
    "https://clipdrop-api.co/image-upscaling/v1/upscale",
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new AICallerError(
      `Clipdrop upscale error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const result = await response.arrayBuffer();
  return { imageData: result };
}

/** Cleanup / remove objects from an image */
export async function callClipDropCleanup(
  apiKey: string,
  imageData: ArrayBuffer,
  maskData: ArrayBuffer
): Promise<{ imageData: ArrayBuffer }> {
  const formData = new FormData();
  formData.append(
    "image_file",
    new Blob([imageData], { type: "image/png" })
  );
  formData.append(
    "mask_file",
    new Blob([maskData], { type: "image/png" })
  );

  const response = await fetch("https://clipdrop-api.co/cleanup/v1", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new AICallerError(
      `Clipdrop cleanup error: ${response.status} ${response.statusText}`,
      response.status
    );
  }

  const result = await response.arrayBuffer();
  return { imageData: result };
}
