// ============================================================
// R2 File Operations — Upload, get, delete, list, presigned URLs
// R2 stores: PDFs, images, audio, exports, mockups
// Zero egress fees — serve directly to browser for free
// ============================================================

export interface R2UploadResult {
  key: string;
  size: number;
  etag: string;
  httpMetadata?: R2HTTPMetadata;
}

export interface R2FileInfo {
  key: string;
  size: number;
  etag: string;
  uploaded: string;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

export class R2Storage {
  constructor(private bucket: R2Bucket) {}

  /** Upload file to R2 bucket */
  async uploadFile(
    key: string,
    data: ArrayBuffer | ReadableStream | string,
    contentType?: string,
    customMetadata?: Record<string, string>
  ): Promise<R2UploadResult> {
    const httpMetadata: R2HTTPMetadata = {};
    if (contentType) {
      httpMetadata.contentType = contentType;
    }

    const object = await this.bucket.put(key, data, {
      httpMetadata,
      customMetadata,
    });

    return {
      key: object.key,
      size: object.size,
      etag: object.etag,
      httpMetadata: object.httpMetadata,
    };
  }

  /** Get file from R2 */
  async getFile(
    key: string
  ): Promise<{ body: ReadableStream; info: R2FileInfo } | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;

    return {
      body: object.body,
      info: {
        key: object.key,
        size: object.size,
        etag: object.etag,
        uploaded: object.uploaded.toISOString(),
        httpMetadata: object.httpMetadata,
        customMetadata: object.customMetadata,
      },
    };
  }

  /** Delete file from R2 */
  async deleteFile(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  /** Delete multiple files from R2 in batch */
  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.bucket.delete(keys);
  }

  /** List files by prefix (e.g., all files for a product) */
  async listFiles(prefix: string, limit = 1000): Promise<R2FileInfo[]> {
    const files: R2FileInfo[] = [];
    let cursor: string | undefined;

    do {
      const list = await this.bucket.list({
        prefix,
        cursor,
        limit: Math.min(limit - files.length, 1000),
      });

      for (const object of list.objects) {
        files.push({
          key: object.key,
          size: object.size,
          etag: object.etag,
          uploaded: object.uploaded.toISOString(),
          httpMetadata: object.httpMetadata,
          customMetadata: object.customMetadata,
        });
      }

      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor && files.length < limit);

    return files;
  }

  /**
   * Generate a presigned URL for an R2 object.
   * Note: R2 presigned URLs require the S3 API compatibility.
   * This returns a direct R2 public URL if the bucket has public access,
   * otherwise it returns the key for use with a Worker-based proxy.
   */
  async getSignedUrl(key: string): Promise<string> {
    // R2 doesn't have a native presigned URL API in the Workers binding.
    // The standard approach is to serve files through a Worker endpoint.
    // Return the key to be used with the GET /r2/:key route.
    return `/r2/${encodeURIComponent(key)}`;
  }

  /** Check if a file exists in R2 */
  async fileExists(key: string): Promise<boolean> {
    const head = await this.bucket.head(key);
    return head !== null;
  }
}
