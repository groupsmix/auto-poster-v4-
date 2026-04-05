/**
 * Shared ModelBadge component for AI model name pills.
 */

export default function ModelBadge({ model }: { model: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-xs">
      {model}
    </span>
  );
}
