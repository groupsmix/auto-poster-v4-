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
 * Centralised hook for fetching API data.
 *
 * When the API call fails or returns `{ success: false }`, the hook
 * keeps `data` at the `fallback` value and sets `error` with the
 * failure message so the UI can display a proper error state.
 *
 * @param fetcher  — async function that calls the API
 * @param fallback — initial/fallback data (e.g. `[]` for lists, `null` for objects)
 * @param deps — optional dependency array; the query re-runs whenever any
 *               value in this array changes (similar to useEffect deps)
 */
export function useApiQuery<T>(
  fetcher: () => Promise<{ success: boolean; data?: T; error?: string }>,
  fallback: T,
  deps: readonly unknown[] = [],
): UseApiQueryResult<T> {
  const [data, setData] = useState<T>(fallback);
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
        setError(null);
      } else {
        // API returned an unsuccessful response — keep fallback, set error
        setData(fallback);
        setError(response.error || "Failed to load data");
        setIsUsingMock(true);
      }
    } catch (e) {
      // Network / parse error — keep fallback, set error
      setData(fallback);
      setError(e instanceof Error ? e.message : "Network error");
      setIsUsingMock(true);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback, ...deps]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  return { data, loading, error, isUsingMock, refetch: doFetch };
}
