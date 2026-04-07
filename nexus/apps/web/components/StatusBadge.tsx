/**
 * Shared status badge component used across Products, History, and other pages.
 * Replaces duplicated StatusBadge functions in individual page files.
 */

import type { ProductStatus, AIModelStatus, WorkflowStatus, ReviewDecision } from "@nexus/shared";

/** All possible status values across products, workflows, and AI models (4.9) */
type AnyStatus = ProductStatus | AIModelStatus | WorkflowStatus | ReviewDecision;

/** Extra status values not covered by shared types but used in the UI */
type ExtraStatus = "waiting" | "not_set";

const STATUS_COLORS: Partial<Record<AnyStatus | ExtraStatus, string>> = {
  // Product statuses
  draft: "bg-gray-500/10 text-gray-400",
  running: "bg-blue-500/10 text-blue-400",
  queued: "bg-gray-500/10 text-gray-400",
  pending_review: "bg-yellow-500/10 text-yellow-300",
  approved: "bg-green-500/10 text-green-300",
  in_revision: "bg-orange-500/10 text-orange-400",
  published: "bg-accent/10 text-accent",
  rejected: "bg-red-500/10 text-red-400",
  cancelled: "bg-gray-500/10 text-gray-500",
  // Workflow statuses
  completed: "bg-green-500/10 text-green-300",
  failed: "bg-red-500/10 text-red-400",
  waiting: "bg-gray-500/10 text-gray-400",
  active: "bg-green-500/10 text-green-300",
  not_set: "bg-gray-500/10 text-gray-500",
  // AI model statuses
  sleeping: "bg-gray-500/10 text-gray-400",
  rate_limited: "bg-yellow-500/10 text-yellow-400",
  no_key: "bg-red-500/10 text-red-400",
};

export type { AnyStatus };

export default function StatusBadge({ status }: { status: AnyStatus | (string & {}) }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status as AnyStatus | ExtraStatus] ?? "bg-gray-500/10 text-gray-400"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function ScoreBadge({ score }: { score?: number }) {
  const currentScore = score ?? 0;
  const color =
    currentScore >= 8
      ? "text-green-300 bg-green-500/10"
      : currentScore >= 6
        ? "text-yellow-300 bg-yellow-500/10"
        : "text-red-400 bg-red-500/10";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>
      {currentScore.toFixed(1)}
    </span>
  );
}

export function DecisionBadge({ decision }: { decision?: ReviewDecision }) {
  if (!decision) return null;
  const colors: Record<ReviewDecision, string> = {
    approved: "bg-green-500/10 text-green-300",
    rejected: "bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[decision] ?? "bg-gray-500/10 text-gray-400"}`}
    >
      {decision}
    </span>
  );
}
