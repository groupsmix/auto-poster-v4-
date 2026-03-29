interface SocialVariant {
  channel: string;
  caption: string;
  hashtags: string[];
  post_type: string;
  scheduled_time?: string;
}

interface SocialVariantPreviewProps {
  variant: SocialVariant;
}

export default function SocialVariantPreview({
  variant,
}: SocialVariantPreviewProps) {
  return (
    <div className="space-y-4">
      {/* Post Type */}
      <div>
        <label className="text-xs text-muted uppercase tracking-wider">
          Post Type
        </label>
        <p className="text-sm font-medium text-foreground mt-1">
          {variant.post_type}
        </p>
      </div>

      {/* Caption */}
      <div>
        <label className="text-xs text-muted uppercase tracking-wider">
          Caption
        </label>
        <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">
          {variant.caption}
        </p>
      </div>

      {/* Hashtags */}
      <div>
        <label className="text-xs text-muted uppercase tracking-wider">
          Hashtags
        </label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {variant.hashtags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Scheduled Time */}
      {variant.scheduled_time && (
        <div>
          <label className="text-xs text-muted uppercase tracking-wider">
            Scheduled
          </label>
          <p className="text-sm text-foreground mt-1">
            {variant.scheduled_time}
          </p>
        </div>
      )}
    </div>
  );
}

export type { SocialVariant };
