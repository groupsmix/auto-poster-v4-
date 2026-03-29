/**
 * Shared StatusBadge component used across Products, History, AI Manager, and Review pages.
 * Single source of truth for status → color mappings.
 */

const STATUS_COLORS: Record<string, string> = {
  // Product / workflow statuses
  draft: "bg-gray-500/10 text-gray-400",
  running: "bg-blue-500/10 text-blue-400",
  queued: "bg-gray-500/10 text-gray-400",
  pending_review: "bg-yellow-500/10 text-yellow-400",
  approved: "bg-green-500/10 text-green-400",
  in_revision: "bg-orange-500/10 text-orange-400",
  published: "bg-accent/10 text-accent",
  rejected: "bg-red-500/10 text-red-400",
  cancelled: "bg-gray-500/10 text-gray-500",
  // Workflow run statuses
  completed: "bg-green-500/10 text-green-400",
  failed: "bg-red-500/10 text-red-400",
  waiting: "bg-gray-500/10 text-gray-400",
  // AI model statuses
  active: "bg-green-500/10 text-green-400",
  sleeping: "bg-gray-500/10 text-gray-400",
  error: "bg-red-500/10 text-red-400",
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
