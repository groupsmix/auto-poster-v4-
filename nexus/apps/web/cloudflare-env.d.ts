// Ambient type declarations for Cloudflare Worker types referenced by @nexus/shared.
// These stubs allow the web (Next.js) TypeScript build to resolve the Env interface
// without pulling in @cloudflare/workers-types.

declare interface KVNamespace {
  get(key: string, options?: unknown): Promise<string | null>;
  put(key: string, value: string, options?: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: unknown): Promise<{ keys: { name: string }[] }>;
}

declare interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
  exec(query: string): Promise<unknown>;
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}

declare interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: unknown, options?: unknown): Promise<R2Object>;
  delete(key: string): Promise<void>;
  list(options?: unknown): Promise<{ objects: R2Object[] }>;
}

declare interface R2Object {
  key: string;
  size: number;
  httpEtag: string;
}

declare interface Fetcher {
  fetch(input: RequestInfo, init?: RequestInit): Promise<Response>;
}
