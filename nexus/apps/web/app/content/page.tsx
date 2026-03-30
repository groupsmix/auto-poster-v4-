"use client";

import { useState, useMemo } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import MockDataBanner from "@/components/MockDataBanner";
import { MOCK_ASSETS } from "@/lib/mock-data";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { Asset } from "@/lib/api";

const ASSET_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "image", label: "Images" },
  { value: "pdf", label: "PDFs" },
  { value: "audio", label: "Audio" },
  { value: "mockup", label: "Mockups" },
];

function AssetTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "image":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21z" />
        </svg>
      );
    case "pdf":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" />
        </svg>
      );
    case "audio":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
      );
    case "mockup":
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
        </svg>
      );
    default:
      return (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
        </svg>
      );
  }
}

export default function ContentPage() {
  const { data: assets, loading, isUsingMock } = useApiQuery(
    () => api.assets.list(),
    MOCK_ASSETS,
  );
  const [localAssets, setLocalAssets] = useState<Asset[] | null>(null);
  const [filterProduct, setFilterProduct] = useState("");
  const [filterType, setFilterType] = useState("");
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const effectiveAssets = localAssets ?? assets;

  const handleDelete = async (id: string) => {
    try {
      await api.assets.delete(id);
      toast.success("Asset deleted");
    } catch {
      toast.error("Failed to delete asset. Please try again.");
    }
    setLocalAssets((prev) => (prev ?? assets).filter((a) => a.id !== id));
    setDeleteConfirm(null);
    if (previewAsset?.id === id) setPreviewAsset(null);
  };

  const productNames = useMemo(
    () => [...new Set(effectiveAssets.map((a) => a.product_name).filter(Boolean))],
    [effectiveAssets]
  );

  const filtered = useMemo(() => {
    return effectiveAssets.filter((a) => {
      if (filterProduct && a.product_name !== filterProduct) return false;
      if (filterType && a.asset_type !== filterType) return false;
      return true;
    });
  }, [effectiveAssets, filterProduct, filterType]);

  const getFileName = (key: string) => {
    return key.split("/").pop() ?? key;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Content Manager</h1>
        <p className="text-muted text-sm mt-1">
          All generated assets (images, PDFs, audio, mockups)
        </p>
      </div>

      {isUsingMock && <MockDataBanner />}

      {/* Filters */}
      <div className="rounded-xl border border-card-border bg-card-bg p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground focus:outline-none focus:border-accent"
          >
            <option value="">All Products</option>
            {productNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-card-hover border border-card-border text-sm text-foreground focus:outline-none focus:border-accent"
          >
            {ASSET_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <span className="ml-auto text-sm text-muted">
            {filtered.length} asset{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Assets grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-card-border bg-card-bg p-4 animate-pulse"
            >
              <div className="aspect-video rounded-lg bg-card-border mb-3" />
              <div className="h-4 w-3/4 rounded bg-card-border mb-2" />
              <div className="h-3 w-1/2 rounded bg-card-border" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-12 text-center">
          <p className="text-muted text-sm">No assets match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              className="rounded-xl border border-card-border bg-card-bg overflow-hidden hover:border-accent/30 transition-all group"
            >
              {/* Preview area */}
              <button
                onClick={() => setPreviewAsset(asset)}
                className="w-full aspect-video bg-card-hover flex items-center justify-center relative cursor-pointer overflow-hidden"
              >
                {asset.asset_type === "image" || asset.asset_type === "mockup" ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={asset.url}
                    alt={getFileName(asset.r2_key)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted">
                    <AssetTypeIcon type={asset.asset_type} />
                    <span className="text-xs font-medium uppercase">
                      {asset.asset_type}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                  <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium transition-opacity">
                    Preview
                  </span>
                </div>
              </button>

              {/* Info */}
              <div className="p-4">
                <p className="text-sm font-medium text-foreground truncate">
                  {getFileName(asset.r2_key)}
                </p>
                <p className="text-xs text-muted mt-1 truncate">
                  {asset.product_name}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-card-hover text-muted capitalize">
                      {asset.asset_type}
                    </span>
                    <span className="text-xs text-muted">
                      {formatDate(asset.created_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Download */}
                    <a
                      href={asset.url}
                      download={getFileName(asset.r2_key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                      title="Download"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                        />
                      </svg>
                    </a>
                    {/* Delete */}
                    <button
                      onClick={() => setDeleteConfirm(asset.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewAsset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewAsset(null)}
        >
          <div
            className="relative max-w-3xl w-full mx-4 rounded-xl border border-card-border bg-card-bg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-card-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {getFileName(previewAsset.r2_key)}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {previewAsset.product_name}
                </p>
              </div>
              <button
                onClick={() => setPreviewAsset(null)}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18 18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4 flex items-center justify-center min-h-[300px] bg-card-hover">
              {previewAsset.asset_type === "image" ||
              previewAsset.asset_type === "mockup" ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewAsset.url}
                  alt={getFileName(previewAsset.r2_key)}
                  className="max-w-full max-h-[60vh] object-contain rounded"
                />
              ) : previewAsset.asset_type === "audio" ? (
                <div className="flex flex-col items-center gap-4">
                  <AssetTypeIcon type="audio" />
                  <audio controls src={previewAsset.url} className="w-full max-w-md">
                    Your browser does not support the audio element.
                  </audio>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted">
                  <AssetTypeIcon type={previewAsset.asset_type} />
                  <p className="text-sm">
                    Preview not available for this file type.
                  </p>
                  <a
                    href={previewAsset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
                  >
                    Open in new tab
                  </a>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-4 border-t border-card-border">
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="capitalize">{previewAsset.asset_type}</span>
                <span>{formatDate(previewAsset.created_at)}</span>
              </div>
              <div className="flex gap-2">
                <a
                  href={previewAsset.url}
                  download={getFileName(previewAsset.r2_key)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent-hover transition-colors"
                >
                  Download
                </a>
                <button
                  onClick={() => {
                    setDeleteConfirm(previewAsset.id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600/10 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-600/20 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="rounded-xl border border-card-border bg-card-bg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Delete Asset
            </h3>
            <p className="text-sm text-muted mb-6">
              This will permanently delete the asset and trigger synced cleanup
              across all storage (R2, CF Images, D1, KV cache). This action
              cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-card-border text-muted text-sm font-medium hover:text-foreground hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
