interface PlatformScore {
  seo: number;
  title: number;
  tags: number;
}

interface PlatformVariant {
  platform: string;
  title: string;
  description: string;
  tags: string[];
  price: number;
  scores: PlatformScore;
}

interface PlatformVariantPreviewProps {
  variant: PlatformVariant;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 8
      ? "bg-green-500"
      : score >= 6
        ? "bg-yellow-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted w-12">{label}</span>
      <div className="flex-1 h-1.5 bg-card-hover rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full`}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <span className="text-xs font-medium text-foreground w-8 text-right">
        {score}/10
      </span>
    </div>
  );
}

export default function PlatformVariantPreview({
  variant,
}: PlatformVariantPreviewProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="text-xs text-muted uppercase tracking-wider">
          Title
        </label>
        <p className="text-sm font-medium text-foreground mt-1">
          {variant.title}
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs text-muted uppercase tracking-wider">
          Description
        </label>
        <p className="text-sm text-foreground/80 mt-1 line-clamp-4">
          {variant.description}
        </p>
      </div>

      {/* Tags */}
      <div>
        <label className="text-xs text-muted uppercase tracking-wider">
          Tags
        </label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {variant.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded bg-card-hover text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <label className="text-xs text-muted uppercase tracking-wider">
          Price
        </label>
        <p className="text-sm font-semibold text-accent mt-1">
          ${variant.price.toFixed(2)}
        </p>
      </div>

      {/* Scores */}
      <div className="space-y-2 pt-2 border-t border-card-border">
        <label className="text-xs text-muted uppercase tracking-wider">
          Platform Scores
        </label>
        <ScoreBar label="SEO" score={variant.scores.seo} />
        <ScoreBar label="Title" score={variant.scores.title} />
        <ScoreBar label="Tags" score={variant.scores.tags} />
      </div>
    </div>
  );
}

export type { PlatformVariant, PlatformScore };
