import { Asset } from "@prisma/client";
import { Card } from "@/components/ui";

export function AssetViewer({ assets }: { assets: Asset[] }) {
  if (!assets.length) {
    return <Card>No assets yet. Run the workflow to generate them.</Card>;
  }

  return (
    <div className="grid gap-4">
      {assets.map((asset) => (
        <Card key={asset.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{asset.kind}</p>
              <h3 className="text-lg font-semibold">{asset.name}</h3>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{asset.format}</span>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-slate-950 p-4 text-sm text-slate-200">
            {asset.content}
          </pre>
        </Card>
      ))}
    </div>
  );
}
