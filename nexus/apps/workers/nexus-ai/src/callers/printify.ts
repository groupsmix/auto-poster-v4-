// ============================================================
// Printify Mockup API Caller
// Free product catalog mockups — different catalog from Printful
// API: https://api.printify.com/v1/
// ============================================================

import { AICallerError } from "./errors";

export interface PrintifyMockupOptions {
  blueprintId: number;
  printProviderId: number;
  variantIds?: number[];
}

export interface PrintifyMockupResult {
  mockupUrl: string;
  variantId?: number;
}

export async function callPrintify(
  apiKey: string,
  imageUrl: string,
  options: PrintifyMockupOptions
): Promise<{ mockups: PrintifyMockupResult[] }> {
  // Step 1: Upload image to Printify
  const uploadResponse = await fetch(
    "https://api.printify.com/v1/uploads/images.json",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        file_name: "design.png",
        url: imageUrl,
      }),
    }
  );

  if (!uploadResponse.ok) {
    throw new AICallerError(
      `Printify upload error: ${uploadResponse.status} ${uploadResponse.statusText}`,
      uploadResponse.status
    );
  }

  const uploadData = (await uploadResponse.json()) as {
    id?: string;
    preview_url?: string;
  };

  const imageId = uploadData.id;
  if (!imageId) {
    throw new AICallerError("Printify returned no image ID", 500);
  }

  // Step 2: Get print provider variants for blueprint
  const variantsResponse = await fetch(
    `https://api.printify.com/v1/catalog/blueprints/${options.blueprintId}/print_providers/${options.printProviderId}/variants.json`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (!variantsResponse.ok) {
    throw new AICallerError(
      `Printify variants error: ${variantsResponse.status} ${variantsResponse.statusText}`,
      variantsResponse.status
    );
  }

  const variantsData = (await variantsResponse.json()) as {
    variants?: Array<{ id?: number; title?: string }>;
  };

  const selectedVariants =
    options.variantIds ??
    (variantsData.variants ?? []).slice(0, 3).map((v) => v.id ?? 0);

  // Return image info — actual mockup generation happens on product creation
  const mockups: PrintifyMockupResult[] = selectedVariants.map((vId) => ({
    mockupUrl: uploadData.preview_url ?? imageUrl,
    variantId: vId,
  }));

  return { mockups };
}
