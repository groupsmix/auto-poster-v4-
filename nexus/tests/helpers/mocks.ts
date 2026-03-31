// ============================================================
// Shared mock helpers for NEXUS integration tests
// Provides mock implementations for D1, KV, R2, Fetcher, AI
// ============================================================

import { vi } from "vitest";

// --- Mock D1 Database ---

export interface MockD1Result {
  results: Record<string, unknown>[];
  success: boolean;
  meta: { changes: number; last_row_id: number; rows_read: number };
}

/** Mock D1 statement with typed methods for test assertions */
export interface MockD1Statement {
  bind: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  raw: ReturnType<typeof vi.fn>;
}

/** Mock D1 database with typed internal accessors for test setup */
export interface MockD1Database extends D1Database {
  _tables: Record<string, Record<string, unknown>[]>;
  _statement: MockD1Statement;
}

export function createMockD1(
  initialData: Record<string, Record<string, unknown>[]> = {}
): MockD1Database {
  const tables = { ...initialData };

  const mockStatement: MockD1Statement = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 1, last_row_id: 1, rows_read: 0 },
    }),
    all: vi.fn().mockResolvedValue({
      results: [],
      success: true,
      meta: { changes: 0, last_row_id: 0, rows_read: 0 },
    }),
    first: vi.fn().mockResolvedValue(null),
    raw: vi.fn().mockResolvedValue([]),
  };

  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    dump: vi.fn(),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
    _tables: tables,
    _statement: mockStatement,
  } as unknown as MockD1Database;
}

// --- Mock KV Namespace ---

/** Mock KV namespace with typed internal store for test setup */
export interface MockKVNamespace extends KVNamespace {
  _store: Map<string, string>;
}

export function createMockKV(): MockKVNamespace {
  const store = new Map<string, string>();

  return {
    get: vi.fn(async (key: string, opts?: unknown) => {
      const val = store.get(key);
      if (!val) return null;
      const type =
        typeof opts === "string" ? opts : (opts as { type?: string })?.type;
      if (type === "json") return JSON.parse(val);
      return val;
    }),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({
      keys: Array.from(store.keys()).map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    })),
    getWithMetadata: vi.fn(async () => ({
      value: null,
      metadata: null,
      cacheStatus: null,
    })),
    _store: store,
  } as unknown as MockKVNamespace;
}

// --- Mock R2 Bucket ---

/** Mock R2 bucket with typed internal store for test setup */
export interface MockR2Bucket extends R2Bucket {
  _objects: Map<string, { body: ArrayBuffer; metadata?: unknown }>;
}

export function createMockR2(): MockR2Bucket {
  const objects = new Map<string, { body: ArrayBuffer; metadata?: unknown }>();

  return {
    put: vi.fn(async (key: string, value: ArrayBuffer | string) => {
      const body =
        typeof value === "string" ? new TextEncoder().encode(value).buffer : value;
      objects.set(key, { body: body as ArrayBuffer });
      return {
        key,
        size: (body as ArrayBuffer).byteLength,
        uploaded: new Date(),
        httpEtag: '"mock-etag"',
        version: "mock-version",
      };
    }),
    get: vi.fn(async (key: string) => {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        key,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(obj.body));
            controller.close();
          },
        }),
        arrayBuffer: async () => obj.body,
        text: async () => new TextDecoder().decode(obj.body),
        json: async () => JSON.parse(new TextDecoder().decode(obj.body)),
        blob: async () => new Blob([obj.body]),
        size: obj.body.byteLength,
        uploaded: new Date(),
        httpEtag: '"mock-etag"',
      };
    }),
    delete: vi.fn(async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      for (const k of keys) objects.delete(k);
    }),
    head: vi.fn(async (key: string) => {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        key,
        size: obj.body.byteLength,
        uploaded: new Date(),
        httpEtag: '"mock-etag"',
      };
    }),
    list: vi.fn(async () => ({
      objects: Array.from(objects.keys()).map((key) => ({
        key,
        size: objects.get(key)!.body.byteLength,
        uploaded: new Date(),
      })),
      truncated: false,
      delimitedPrefixes: [],
    })),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
    _objects: objects,
  } as unknown as MockR2Bucket;
}

// --- Mock Fetcher (Service Binding) ---

export function createMockFetcher(
  handler?: (request: Request) => Promise<Response>
): Fetcher {
  const defaultHandler = async () =>
    new Response(JSON.stringify({ success: true, data: {} }), {
      headers: { "Content-Type": "application/json" },
    });

  return {
    fetch: vi.fn(async (input: string | Request, init?: RequestInit) => {
      const request =
        typeof input === "string" ? new Request(input, init) : input;
      return (handler ?? defaultHandler)(request);
    }),
    connect: vi.fn(),
  } as unknown as Fetcher;
}

// --- Mock AI binding (Workers AI) ---

export function createMockAI(
  response: string = "Mock AI response"
): { run: ReturnType<typeof vi.fn> } {
  return {
    run: vi.fn(async () => ({
      response,
    })),
  };
}

// --- Build a complete mock Env ---

export function createMockEnv(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    DB: createMockD1(),
    KV: createMockKV(),
    R2: createMockR2(),
    AI: createMockFetcher(),
    AI_GATEWAY: createMockFetcher(),
    NEXUS_AI: createMockFetcher(),
    NEXUS_WORKFLOW: createMockFetcher(),
    NEXUS_VARIATION: createMockFetcher(),
    NEXUS_STORAGE: createMockFetcher(),
    AI_SERVICE: createMockFetcher(),
    WORKFLOW_SERVICE: createMockFetcher(),
    VARIATION_SERVICE: createMockFetcher(),
    STORAGE_SERVICE: createMockFetcher(),
    DASHBOARD_SECRET: "test-secret-123",
    DEEPSEEK_API_KEY: "test-deepseek-key",
    SILICONFLOW_API_KEY: "test-siliconflow-key",
    ...overrides,
  };
}

// --- Helper: create a JSON Response ---

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Helper: create an AI success response ---

export function aiSuccessResponse(
  result: string = "mock AI result",
  model: string = "test-model"
): Response {
  return jsonResponse({
    success: true,
    data: { result, model, cached: false, tokens: 100 },
  });
}
