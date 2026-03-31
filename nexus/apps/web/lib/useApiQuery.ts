"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseApiQueryOptions {
  /**
   * Optional dependency array; the query re-runs whenever any value in
   * this array changes (similar to useEffect deps).
   */
  deps?: readonly unknown[];
  /**
   * Re-fetch data when the browser tab regains focus.
   * Prevents looking at stale data after switching tabs.
   * @default true
   */
  refetchOnFocus?: boolean;
  /**
   * Polling interval in milliseconds. When set, the hook re-fetches
   * data at this interval. Polling pauses when the tab is hidden.
   * @default undefined (no polling)
   */
  pollInterval?: number;
}

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
 * Features:
 * - Automatic refetch on window focus (stale-while-revalidate pattern)
 * - Optional polling interval for near-real-time data
 * - Dependency array support for reactive re-fetching
 *
 * @param fetcher  — async function that calls the API
 * @param fallback — initial/fallback data (e.g. `[]` for lists, `null` for objects)
 * @param depsOrOptions — dependency array (legacy) or options object
 */
export function useApiQuery<T>(
  fetcher: () => Promise<{ success: boolean; data?: T; error?: string }>,
  fallback: T,
  depsOrOptions: readonly unknown[] | UseApiQueryOptions = {},
): UseApiQueryResult<T> {
  // Support legacy array-of-deps signature and new options object
  const options: UseApiQueryOptions = Array.isArray(depsOrOptions)
    ? { deps: depsOrOptions as readonly unknown[] }
    : (depsOrOptions as UseApiQueryOptions);

  const {
    deps = [],
    refetchOnFocus = true,
    pollInterval,
  } = options;

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

  // Initial fetch + re-fetch when deps change
  useEffect(() => {
    doFetch();
  }, [doFetch]);

  // Refetch on window focus (stale-while-revalidate)
  useEffect(() => {
    if (!refetchOnFocus) return;

    const onFocus = () => {
      // Only refetch if we're not already loading
      doFetch();
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetchOnFocus, doFetch]);

  // Optional polling interval (pauses when tab is hidden)
  useEffect(() => {
    if (!pollInterval || pollInterval <= 0) return;

    const id = setInterval(() => {
      if (!document.hidden) {
        doFetch();
      }
    }, pollInterval);

    return () => clearInterval(id);
  }, [pollInterval, doFetch]);

  return { data, loading, error, isUsingMock, refetch: doFetch };
}
