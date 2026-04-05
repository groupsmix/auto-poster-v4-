/**
 * Reusable horizontal bar for comparing variant metrics.
 * Extracted from A/B Testing page.
 */

interface VariantBarProps {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

export default function VariantBar({ label, value, maxValue, color }: VariantBarProps) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted w-6 font-bold">{label}</span>
      <div className="flex-1 h-4 bg-card-border rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted w-16 text-right">{value.toFixed(1)}%</span>
    </div>
  );
}
