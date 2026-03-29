"use client";

interface LoadingStateProps {
  count?: number;
}

export default function LoadingState({ count = 6 }: LoadingStateProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-card-border bg-card-bg p-6 animate-pulse"
        >
          <div className="h-10 w-10 rounded-lg bg-card-border mb-4" />
          <div className="h-5 w-3/4 rounded bg-card-border mb-2" />
          <div className="h-4 w-1/2 rounded bg-card-border" />
        </div>
      ))}
    </div>
  );
}
