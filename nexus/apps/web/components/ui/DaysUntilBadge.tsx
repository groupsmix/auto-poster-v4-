/**
 * Reusable badge showing days until an event with color coding.
 * Extracted from Seasonal Calendar page.
 */

interface DaysUntilBadgeProps {
  days: number | undefined;
}

export default function DaysUntilBadge({ days }: DaysUntilBadgeProps) {
  if (days === undefined) return null;
  if (days <= 0)
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">Passed</span>;
  if (days <= 14)
    return <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">{days}d away</span>;
  if (days <= 42)
    return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">{days}d away</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">{days}d away</span>;
}
