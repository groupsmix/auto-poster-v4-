import type { AIModelStatus } from "@nexus/shared";

// AI Status Badge — shows active/sleeping/rate-limited status
export default function AIStatusBadge({ status }: { status: AIModelStatus }) {
  const colors: Record<AIModelStatus, string> = {
    active: "bg-green-500/10 text-green-400",
    sleeping: "bg-gray-500/10 text-gray-400",
    rate_limited: "bg-yellow-500/10 text-yellow-400",
    no_key: "bg-red-500/10 text-red-400",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-500/10 text-gray-400"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
