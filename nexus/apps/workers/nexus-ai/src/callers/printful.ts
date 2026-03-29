// ============================================================
// Printful Mockup API Caller
// Free real product catalog mockups
// API: https://api.printful.com/mockup-generator/
// ============================================================

import { AICallerError } from "./errors";

export interface PrintfulMockupOptions {
  productId: number;
  variantIds?: number[];
  format?: "jpg" | "png";
}

export interface MockupResult {
  mockupUrl: string;
  variantId?: number;
}

export async function callPrintful(
  apiKey: string,
  imageUrl: string,
  options: PrintfulMockupOptions
): Promise<{ mockups: MockupResult[]; taskKey?: string }> {
  // Step 1: Create mockup generation task
  const createResponse = await fetch(
    `https://api.printful.com/mockup-generator/create-task/${options.productId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        variant_ids: options.variantIds ?? [],
        format: options.format ?? "jpg",
        files: [
          {
            placement: "front",
            image_url: imageUrl,
            position: {
              area_width: 1800,
              area_height: 2400,
              width: 1800,
              height: 2400,
              top: 0,
              left: 0,
            },
          },
        ],
      }),
    }
  );

  if (!createResponse.ok) {
    throw new AICallerError(
      `Printful create task error: ${createResponse.status} ${createResponse.statusText}`,
      createResponse.status
    );
  }

  const createData = (await createResponse.json()) as {
    result?: { task_key?: string };
  };

  const taskKey = createData.result?.task_key;
  if (!taskKey) {
    throw new AICallerError("Printful returned no task key", 500);
  }

  // Step 2: Poll for result (max 30 seconds)
  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const statusResponse = await fetch(
      `https://api.printful.com/mockup-generator/task?task_key=${taskKey}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!statusResponse.ok) continue;

    const statusData = (await statusResponse.json()) as {
      result?: {
        status?: string;
        mockups?: Array<{
          mockup_url?: string;
          variant_ids?: number[];
        }>;
      };
    };

    if (statusData.result?.status === "completed") {
      const mockups: MockupResult[] = (
        statusData.result.mockups ?? []
      ).map((m) => ({
        mockupUrl: m.mockup_url ?? "",
        variantId: m.variant_ids?.[0],
      }));

      return { mockups, taskKey };
    }

    if (statusData.result?.status === "failed") {
      throw new AICallerError("Printful mockup generation failed", 500);
    }
  }

  throw new AICallerError("Printful mockup generation timed out", 504);
}
