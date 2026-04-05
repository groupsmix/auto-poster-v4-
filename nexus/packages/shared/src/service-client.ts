// ============================================================
// Shared ServiceClient — typed wrapper for Service Binding calls
// Reduces boilerplate across all workers that call other workers
// ============================================================

import type { ApiResponse } from "./types";

/**
 * A lightweight, typed client for calling other Cloudflare Workers
 * via Service Bindings. Encapsulates fetch + JSON parsing + error handling.
 *
 * Usage:
 *   const storage = new ServiceClient(env.NEXUS_STORAGE, "nexus-storage");
 *   const data = await storage.post<Product[]>("/d1/query", { sql, params });
 */
export class ServiceClient {
  private fetcher: { fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> };
  private name: string;

  constructor(
    fetcher: { fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response> },
    name: string
  ) {
    this.fetcher = fetcher;
    this.name = name;
  }

  /** Send a GET request */
  async get<T>(path: string): Promise<ApiResponse<T>> {
    const resp = await this.fetcher.fetch(`http://${this.name}${path}`);
    return (await resp.json()) as ApiResponse<T>;
  }

  /** Send a POST request with a JSON body */
  async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const resp = await this.fetcher.fetch(`http://${this.name}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await resp.json()) as ApiResponse<T>;
  }

  /** Send a PUT request with a JSON body */
  async put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    const resp = await this.fetcher.fetch(`http://${this.name}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await resp.json()) as ApiResponse<T>;
  }

  /** Send a DELETE request */
  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const resp = await this.fetcher.fetch(`http://${this.name}${path}`, {
      method: "DELETE",
    });
    return (await resp.json()) as ApiResponse<T>;
  }

  /**
   * POST and assert success — throws if the response has success: false.
   * Useful when you want to propagate errors as exceptions.
   */
  async postOrThrow<T>(path: string, body: unknown): Promise<T> {
    const resp = await this.post<T>(path, body);
    if (!resp.success) {
      throw new Error(
        `ServiceClient [${this.name}] POST ${path} failed: ${resp.error ?? "unknown error"}`
      );
    }
    return resp.data as T;
  }

  /**
   * GET and assert success — throws if the response has success: false.
   */
  async getOrThrow<T>(path: string): Promise<T> {
    const resp = await this.get<T>(path);
    if (!resp.success) {
      throw new Error(
        `ServiceClient [${this.name}] GET ${path} failed: ${resp.error ?? "unknown error"}`
      );
    }
    return resp.data as T;
  }
}
