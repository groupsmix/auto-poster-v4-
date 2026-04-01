/**
 * Reusable rate card component for displaying success/failure rates.
 * Extracted from the Health Dashboard page.
 */

interface RateCardProps {
  label: string;
  rate: number;
  total: number;
  failed: number;
  color: string;
}

export default function RateCard({ label, rate, total, failed, color }: RateCardProps) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-5">
      <p className="text-xs font-medium text-muted uppercase tracking-wider">{label}</p>
      <div className="flex items-end gap-2 mt-1">
        <p className={`text-3xl font-bold ${color}`}>{rate}%</p>
        <p className="text-xs text-muted mb-1">{total - failed} / {total}</p>
      </div>
      {failed > 0 && (
        <p className="text-xs text-red-400 mt-1">{failed} failed</p>
      )}
    </div>
  );
}
