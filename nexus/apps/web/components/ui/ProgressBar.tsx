/**
 * Reusable progress bar component for displaying usage metrics.
 * Extracted from the Health Dashboard page for reuse across the app.
 */

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  color: string;
}

export default function ProgressBar({ value, max, label, color }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs text-muted">
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="h-2 bg-card-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
