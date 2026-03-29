"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

interface ReviewCountContextValue {
  pendingReviewCount: number;
  publishableCount: number;
  refetch: () => void;
}

const ReviewCountContext = createContext<ReviewCountContextValue>({
  pendingReviewCount: 0,
  publishableCount: 0,
  refetch: () => {},
});

// Mock fallback counts matching the mock data in review/page.tsx and publish/page.tsx
const MOCK_PENDING_COUNT = 3;
const MOCK_PUBLISHABLE_COUNT = 2;

async function loadCounts(): Promise<{ pending: number; publishable: number }> {
  try {
    const [pendingRes, publishRes] = await Promise.all([
      api.reviews.pending(),
      api.publishing.ready(),
    ]);
    return {
      pending:
        pendingRes.success && pendingRes.data
          ? pendingRes.data.length
          : MOCK_PENDING_COUNT,
      publishable:
        publishRes.success && publishRes.data
          ? publishRes.data.length
          : MOCK_PUBLISHABLE_COUNT,
    };
  } catch {
    return { pending: MOCK_PENDING_COUNT, publishable: MOCK_PUBLISHABLE_COUNT };
  }
}

// Module-level promise so the fetch fires once on import / first render
let countsPromise: Promise<{ pending: number; publishable: number }> | null = null;
function getCountsPromise() {
  if (!countsPromise) {
    countsPromise = loadCounts();
  }
  return countsPromise;
}

export function ReviewCountProvider({ children }: { children: ReactNode }) {
  const [pendingReviewCount, setPendingReviewCount] = useState(MOCK_PENDING_COUNT);
  const [publishableCount, setPublishableCount] = useState(MOCK_PUBLISHABLE_COUNT);

  // Use React 19's `use`-compatible pattern: resolve the module-level promise
  // in an event-handler style callback that we trigger once via useState init.
  const [initialized] = useState(() => {
    getCountsPromise().then(({ pending, publishable }) => {
      setPendingReviewCount(pending);
      setPublishableCount(publishable);
    });
    return true;
  });
  // Ensure the variable is referenced to avoid unused-var lint
  void initialized;

  const refetch = async () => {
    countsPromise = loadCounts();
    const { pending, publishable } = await countsPromise;
    setPendingReviewCount(pending);
    setPublishableCount(publishable);
  };

  return (
    <ReviewCountContext value={{ pendingReviewCount, publishableCount, refetch }}>
      {children}
    </ReviewCountContext>
  );
}

export function useReviewCounts() {
  return useContext(ReviewCountContext);
}
