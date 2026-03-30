/**
 * Shared status badge component used across Products, History, and other pages.
 * Replaces duplicated StatusBadge functions in individual page files.
 *
 * Uses typed color maps keyed by union types from @nexus/shared (4.9).
 */

import type { ProductStatus, WorkflowStatus, AIModelStatus, ReviewDecision } from "@nexus/shared";

/** All known status strings that map to a color class. */
type KnownStatus = ProductStatus | WorkflowStatus | AIModelStatus | "active" | "not_set" | "waiting";

const STATUS_COLORS: Record<KnownStatus, string> = {
  // Product / workflow statuses
  draft: "bg-gray-500/10 text-gray-400",
  running: "bg-blue-500/10 text-blue-400",
  queued: "bg-gray-500/10 text-gray-400",
  pending_review: "bg-yellow-500/10 text-yellow-300",
  approved: "bg-green-500/10 text-green-300",
  in_revision: "bg-orange-500/10 text-orange-400",
  published: "bg-accent/10 text-accent",
  rejected: "bg-red-500/10 text-red-400",
  cancelled: "bg-gray-500/10 text-gray-500",
  // Workflow-specific statuses
  completed: "bg-green-500/10 text-green-300",
  failed: "bg-red-500/10 text-red-400",
  waiting_cache: "bg-gray-500/10 text-gray-400",
  waiting_fallback: "bg-gray-500/10 text-gray-400",
  workers_ai_fallback: "bg-yellow-500/10 text-yellow-400",
  waiting: "bg-gray-500/10 text-gray-400",
  // AI model statuses
  active: "bg-green-500/10 text-green-300",
  sleeping: "bg-gray-500/10 text-gray-400",
  rate_limited: "bg-yellow-500/10 text-yellow-400",
  no_key: "bg-red-500/10 text-red-400",
  not_set: "bg-gray-500/10 text-gray-500",
};

const FALLBACK_COLOR = "bg-gray-500/10 text-gray-400";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${(STATUS_COLORS as Record<string, string>)[status] ?? FALLBACK_COLOR}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "text-green-300 bg-green-500/10"
      : score >= 6
        ? "text-yellow-300 bg-yellow-500/10"
        : "text-red-400 bg-red-500/10";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}

const DECISION_COLORS: Record<ReviewDecision, string> = {
  approved: "bg-green-500/10 text-green-300",
  rejected: "bg-red-500/10 text-red-400",
};

export function DecisionBadge({ decision }: { decision?: string }) {
  if (!decision) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${(DECISION_COLORS as Record<string, string>)[decision] ?? FALLBACK_COLOR}`}
    >
      {decision}
    </span>
  );
}
