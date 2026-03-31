// API client utility for nexus-router API
// Base client with retry logic and authentication

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Retry wrapper for fetch: retries up to `retries` times with 1s delay
 * for network errors and 5xx responses. Does not retry 4xx (client errors).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) return response;
      if (i < retries) await new Promise((r) => setTimeout(r, 1000));
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Max retries exceeded");
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {} } = options;

  // Add auth token if available (8.4)
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("nexus_token")
      : process.env.DASHBOARD_SECRET;

  const authHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    authHeaders["Authorization"] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers: authHeaders,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetchWithRetry(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`,
      };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
