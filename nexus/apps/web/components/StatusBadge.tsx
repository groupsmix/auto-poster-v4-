/**
 * Shared status badge component used across Products, History, and other pages.
 * Replaces duplicated StatusBadge functions in individual page files.
 */

const STATUS_COLORS: Record<string, string> = {
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
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-500/10 text-gray-400"}`}
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

export function DecisionBadge({ decision }: { decision?: string }) {
  if (!decision) return null;
  const colors: Record<string, string> = {
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
