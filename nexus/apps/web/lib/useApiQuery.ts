"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiQueryResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  isUsingMock: boolean;
  refetch: () => void;
}

/**
 * Centralised hook for fetching API data with automatic mock-data fallback.
 *
 * When the API call fails or returns `{ success: false }`, the hook
 * transparently falls back to `mockFallback` and sets `isUsingMock = true`
 * so the UI can display a banner.
 *
 * @param fetcher  — async function that calls the API
 * @param mockFallback — data returned when the API is unreachable
 * @param deps — optional dependency array; the query re-runs whenever any
 *               value in this array changes (similar to useEffect deps)
 */
export function useApiQuery<T>(
  fetcher: () => Promise<{ success: boolean; data?: T; error?: string }>,
  mockFallback: T,
  deps: readonly unknown[] = [],
): UseApiQueryResult<T> {
  const [data, setData] = useState<T>(mockFallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMock, setIsUsingMock] = useState(false);

  // Keep a stable reference to the fetcher so callers don't need to
  // memoize it themselves (we still honour identity changes).
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetcherRef.current();
      if (response.success && response.data) {
        setData(response.data);
        setIsUsingMock(false);
      } else {
        // API returned an unsuccessful response — fall back to mock data
        setData(mockFallback);
        setIsUsingMock(true);
      }
    } catch {
      // Network / parse error — fall back to mock data
      setData(mockFallback);
      setIsUsingMock(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mockFallback, ...deps]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, isUsingMock, refetch: doFetch };
}
