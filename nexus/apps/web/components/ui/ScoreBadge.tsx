/**
 * Shared ScoreBadge component for AI review scores.
 * Green >= 8, Yellow >= 6, Red < 6.
 */

export default function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "text-green-400 bg-green-500/10"
      : score >= 6
        ? "text-yellow-400 bg-yellow-500/10"
        : "text-red-400 bg-red-500/10";
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-bold ${color}`}>
      {score.toFixed(1)}
    </span>
  );
}
