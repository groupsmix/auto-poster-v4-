"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { RevenueDashboard } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function ConnectionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    connected: "bg-green-500/10 text-green-400",
    disconnected: "bg-red-500/10 text-red-400",
    error: "bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-gray-500/10 text-gray-400"}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SyncStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    idle: "bg-gray-500/10 text-gray-400",
    syncing: "bg-blue-500/10 text-blue-400",
    error: "bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? "bg-gray-500/10 text-gray-400"}`}
    >
      {status === "idle" ? "Synced" : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const emptyDashboard: RevenueDashboard = {
  total_revenue: 0,
  total_orders: 0,
  total_products_sold: 0,
  by_platform: [],
  by_domain: [],
  by_category: [],
  top_products: [],
  daily_trend: [],
};

export default function RevenuePage() {
  const { data: connections, loading: loadingConn, refetch: refetchConn } = useApiQuery(
    () => api.revenue.connections.list(),
    [],
  );
  const { data: dashboard, loading: loadingDash } = useApiQuery(
    () => api.revenue.dashboard(),
    emptyDashboard,
  );
  const [showConnect, setShowConnect] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Form state
  const [formPlatform, setFormPlatform] = useState("etsy");
  const [formShopName, setFormShopName] = useState("");
  const [formApiKey, setFormApiKey] = useState("");

  async function handleConnect() {
    if (!formShopName) return;
    setCreating(true);
    try {
      await api.revenue.connections.create({
        platform: formPlatform,
        store_name: formShopName,
        api_key: formApiKey || undefined,
        is_active: true,
      });
      setShowConnect(false);
      setFormShopName("");
      setFormApiKey("");
      refetchConn();
    } finally {
      setCreating(false);
    }
  }

  async function handleSync(id: string) {
    setSyncing(id);
    try {
      await api.revenue.connections.sync(id);
      refetchConn();
    } finally {
      setSyncing(null);
    }
  }

  async function handleDisconnect(id: string) {
    if (!confirm("Disconnect this platform?")) return;
    await api.revenue.connections.delete(id);
    refetchConn();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revenue Tracker</h1>
          <p className="text-muted text-sm mt-1">
            Track sales across platforms and see what&apos;s making money
          </p>
        </div>
        <button
          onClick={() => setShowConnect(true)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          + Connect Platform
        </button>
      </div>

      {/* Revenue Summary Cards */}
      {loadingDash ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse"
            >
              <div className="h-4 w-24 bg-card-border rounded mb-3" />
              <div className="h-8 w-20 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              Total Revenue
            </p>
            <p className="text-2xl font-bold text-success mt-1">
              {formatCurrency(dashboard.total_revenue)}
            </p>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              Total Orders
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {dashboard.total_orders.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-card-border bg-card-bg p-5">
            <p className="text-xs font-medium text-muted uppercase tracking-wider">
              Products Sold
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {dashboard.total_products_sold.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Revenue by Platform */}
      {dashboard.by_platform.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Revenue by Platform
          </h3>
          <div className="space-y-3">
            {dashboard.by_platform.map((p) => (
              <div key={p.platform} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground capitalize">
                    {p.platform}
                  </span>
                  <span className="text-xs text-muted">
                    {p.orders} orders
                  </span>
                </div>
                <span className="text-sm font-semibold text-success">
                  {formatCurrency(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Revenue by Domain */}
      {dashboard.by_domain.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Revenue by Domain
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left">
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">
                    Revenue
                  </th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">
                    Products
                  </th>
                  <th className="pb-2 text-xs font-medium text-muted uppercase tracking-wider text-right">
                    Avg/Product
                  </th>
                </tr>
              </thead>
              <tbody>
                {dashboard.by_domain.map((d) => (
                  <tr
                    key={d.domain_id ?? d.domain_name}
                    className="border-b border-card-border last:border-0"
                  >
                    <td className="py-2.5 font-medium text-foreground">
                      {d.domain_name}
                    </td>
                    <td className="py-2.5 text-right text-success font-semibold">
                      {formatCurrency(d.revenue)}
                    </td>
                    <td className="py-2.5 text-right text-muted">
                      {d.products}
                    </td>
                    <td className="py-2.5 text-right text-muted">
                      {d.products > 0
                        ? formatCurrency(d.revenue / d.products)
                        : "$0.00"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Products */}
      {dashboard.top_products.length > 0 && (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Top Revenue Products
          </h3>
          <div className="space-y-2">
            {dashboard.top_products.map((p, i) => (
              <div
                key={p.product_id}
                className="flex items-center justify-between py-2 border-b border-card-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted w-5">{i + 1}</span>
                  <span className="text-sm font-medium text-foreground truncate max-w-xs">
                    {p.product_name}
                  </span>
                </div>
                <span className="text-sm font-semibold text-success">
                  {formatCurrency(p.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connected Platforms */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Connected Platforms
        </h2>
        {loadingConn ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse"
              >
                <div className="h-5 w-32 bg-card-border rounded mb-2" />
                <div className="h-4 w-48 bg-card-border rounded" />
              </div>
            ))}
          </div>
          ) : connections.length === 0 ? (
            <EmptyState
              message="No platforms connected. Connect your Etsy, Gumroad, or Shopify store to start tracking revenue."
            />
        ) : (
          <div className="space-y-3">
            {connections.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-card-border bg-card-bg p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold text-foreground capitalize">
                      {c.platform}
                    </span>
                    <ConnectionStatusBadge status={c.is_active ? "connected" : "disconnected"} />
                    <SyncStatusBadge status={c.sync_status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSync(c.id)}
                      disabled={syncing === c.id}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-card-border text-foreground hover:bg-card-hover transition-colors disabled:opacity-50"
                    >
                      {syncing === c.id ? "Syncing..." : "Sync Now"}
                    </button>
                    <button
                      onClick={() => handleDisconnect(c.id)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-sm text-muted">
                  <span>Shop: {c.store_name}</span>
                  {c.last_sync_at && (
                    <span className="ml-4">
                      Last synced: {new Date(c.last_sync_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Connect Platform Modal */}
      <Modal isOpen={showConnect} onClose={() => setShowConnect(false)} title="Connect Platform">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Platform
              </label>
              <select
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="etsy">Etsy</option>
                <option value="gumroad">Gumroad</option>
                <option value="shopify">Shopify</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Shop Name / Store URL
              </label>
              <input
                type="text"
                value={formShopName}
                onChange={(e) => setFormShopName(e.target.value)}
                placeholder="e.g. mystore.etsy.com"
                className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                API Key / Access Token
              </label>
              <input
                type="password"
                value={formApiKey}
                onChange={(e) => setFormApiKey(e.target.value)}
                placeholder="OAuth token or API key"
                className="w-full px-3 py-2 rounded-lg border border-card-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <p className="text-xs text-muted mt-1">
                Used for nightly revenue sync. Stored securely.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConnect(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-card-border text-foreground hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConnect}
                disabled={creating || !formShopName}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {creating ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </Modal>
    </div>
  );
}
