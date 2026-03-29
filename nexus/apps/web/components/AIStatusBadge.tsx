// AI Status Badge — shows active/sleeping/rate-limited status
export default function AIStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    sleeping: "bg-gray-100 text-gray-800",
    rate_limited: "bg-yellow-100 text-yellow-800",
    no_key: "bg-red-100 text-red-800",
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}>
      {status.replace("_", " ")}
    </span>
  );
}
