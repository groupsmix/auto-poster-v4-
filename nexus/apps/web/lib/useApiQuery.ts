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
 */
export function useApiQuery<T>(
  fetcher: () => Promise<{ success: boolean; data?: T; error?: string }>,
  mockFallback: T,
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
  }, [mockFallback]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, isUsingMock, refetch: doFetch };
}
