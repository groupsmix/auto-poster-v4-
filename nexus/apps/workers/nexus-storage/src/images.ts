// ============================================================
// CF Images Operations — Upload, delete, get URL, list
// CF Images provides: CDN, resize, transform, optimize
// Accessed via Cloudflare Images API (account-level)
// ============================================================

export interface CFImageUploadResult {
  id: string;
  filename: string;
  uploaded: string;
  variants: string[];
  metadata?: Record<string, string>;
}

export interface CFImageInfo {
  id: string;
  filename: string;
  uploaded: string;
  variants: string[];
  metadata?: Record<string, string>;
}

/** Environment bindings needed for CF Images API calls */
export interface ImagesEnv {
  CF_ACCOUNT_ID?: string;
  CF_IMAGES_TOKEN?: string;
}

const CF_IMAGES_API = "https://api.cloudflare.com/client/v4/accounts";

export class CFImages {
  private accountId: string;
  private apiToken: string;

  constructor(env: ImagesEnv) {
    this.accountId = env.CF_ACCOUNT_ID ?? "";
    this.apiToken = env.CF_IMAGES_TOKEN ?? "";
  }

  private get baseUrl(): string {
    return `${CF_IMAGES_API}/${this.accountId}/images/v1`;
  }

  private get headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiToken}`,
    };
  }

  /** Upload image to CF Images */
  async uploadImage(
    file: ArrayBuffer | ReadableStream,
    metadata?: Record<string, string>
  ): Promise<CFImageUploadResult> {
    const formData = new FormData();
    formData.append("file", new Blob([file instanceof ArrayBuffer ? file : await new Response(file).arrayBuffer()]));

    if (metadata) {
      formData.append("metadata", JSON.stringify(metadata));
    }

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CF Images upload failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      success: boolean;
      result: CFImageUploadResult;
      errors: Array<{ message: string }>;
    };

    if (!data.success) {
      throw new Error(
        `CF Images upload failed: ${data.errors.map((e) => e.message).join(", ")}`
      );
    }

    return data.result;
  }

  /** Delete image from CF Images */
  async deleteImage(imageId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${imageId}`, {
      method: "DELETE",
      headers: this.headers,
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(
        `CF Images delete failed: ${response.status} ${errorText}`
      );
    }
  }

  /**
   * Get CDN URL for an image with optional transform variant.
   * CF Images serves images at: https://imagedelivery.net/{account_hash}/{image_id}/{variant}
   * Default variant is "public".
   */
  getImageUrl(imageId: string, variant = "public"): string {
    return `https://imagedelivery.net/${this.accountId}/${imageId}/${variant}`;
  }

  // NOTE: listImages was removed — it fetched ALL images from CF Images API
  // and filtered client-side by product_id metadata, which doesn't scale.
  // Use the D1 assets table to look up image IDs by product_id instead.
}
