/**
 * Reusable summary card for displaying a single metric.
 * Used across A/B Testing, Bundles, and other dashboard pages.
 */

interface SummaryCardProps {
  label: string;
  value: string | number;
  color?: string;
}

export default function SummaryCard({ label, value, color = "text-foreground" }: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-5">
      <p className="text-xs font-medium text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
