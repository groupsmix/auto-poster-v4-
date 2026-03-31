// API client utility for nexus-router API
// Base client with retry logic and authentication

/**
 * Base URL for all API requests.
 *
 * DEPLOYMENT NOTE: When the frontend is deployed on CF Pages (or any
 * separate domain from the nexus-router worker), the default `/api`
 * path won't work. You MUST set NEXT_PUBLIC_API_URL to the router
 * worker's full URL, e.g.:
 *   NEXT_PUBLIC_API_URL=https://nexus-router.<your-subdomain>.workers.dev
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * Retry wrapper for fetch: retries up to `retries` times with exponential
 * backoff for network errors and 5xx responses.
 * Does not retry 4xx (client errors) including 429 rate-limit responses.
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
      if (i < retries) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    } catch (e) {
      if (i === retries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
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
