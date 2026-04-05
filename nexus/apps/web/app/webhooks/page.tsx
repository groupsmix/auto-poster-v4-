"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApiQuery } from "@/lib/useApiQuery";
import type { WebhookConfig, WebhookLog } from "@/lib/api";
import { SummaryCard } from "@/components/ui";

const EVENT_LABELS: Record<string, string> = {
  product_approved: "Product Approved",
  product_published: "Product Published",
  publish_failed: "Publish Failed",
  daily_summary: "Daily Summary",
};

export default function WebhooksPage() {
  const { data: configs, loading, refetch } = useApiQuery(
    () => api.webhooks.list(),
    [] as WebhookConfig[],
  );
  const { data: logs, refetch: refetchLogs } = useApiQuery(
    () => api.webhooks.logs(30),
    [] as WebhookLog[],
  );

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<"discord" | "telegram" | "custom">("discord");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    await api.webhooks.create({ name, url, type });
    setName("");
    setUrl("");
    setShowForm(false);
    setSaving(false);
    refetch();
  }

  async function handleTest(id: string) {
    const res = await api.webhooks.test(id);
    if (res.success) {
      alert("Test webhook sent!");
    } else {
      alert("Test failed: " + (res.error ?? "Unknown error"));
    }
    refetch();
    refetchLogs();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this webhook?")) return;
    await api.webhooks.delete(id);
    refetch();
  }

  async function handleToggle(id: string, currentActive: boolean) {
    await api.webhooks.update(id, { is_active: !currentActive } as Partial<WebhookConfig>);
    refetch();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Webhook Alerts</h1>
          <p className="text-muted text-sm mt-1">
            Send notifications to Discord, Telegram, or custom endpoints
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          {showForm ? "Cancel" : "+ Add Webhook"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl border border-card-border bg-card-bg p-5 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">New Webhook</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-muted block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground"
                placeholder="My Discord Webhook"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Webhook URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground"
                placeholder="https://discord.com/api/webhooks/..."
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "discord" | "telegram" | "custom")}
                className="w-full px-3 py-2 bg-background border border-card-border rounded-lg text-sm text-foreground"
              >
                <option value="discord">Discord</option>
                <option value="telegram">Telegram</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim() || !url.trim()}
            className="mt-4 px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Webhook"}
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard label="Total Webhooks" value={configs.length} />
        <SummaryCard label="Active" value={configs.filter((c) => c.is_active).length} color="text-green-400" />
        <SummaryCard label="Total Sent" value={configs.reduce((sum, c) => sum + c.total_sent, 0)} />
      </div>

      {/* Webhook List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-card-border bg-card-bg p-5 animate-pulse">
              <div className="h-4 w-48 bg-card-border rounded mb-2" />
              <div className="h-3 w-72 bg-card-border rounded" />
            </div>
          ))}
        </div>
      ) : configs.length === 0 ? (
        <div className="rounded-xl border border-card-border bg-card-bg p-8 text-center">
          <p className="text-muted">No webhooks configured yet.</p>
          <p className="text-xs text-muted mt-1">Add a Discord or Telegram webhook to get notified on key events.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((cfg) => (
            <div key={cfg.id} className="rounded-xl border border-card-border bg-card-bg p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{cfg.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.is_active ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                      {cfg.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-card-border text-muted capitalize">
                      {cfg.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1 truncate">{cfg.url}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted">
                    <span>{cfg.total_sent} sent</span>
                    {cfg.total_failed > 0 && <span className="text-red-400">{cfg.total_failed} failed</span>}
                    {cfg.last_fired_at && <span>Last: {new Date(cfg.last_fired_at).toLocaleDateString()}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(Array.isArray(cfg.events) ? cfg.events : []).map((ev) => (
                      <span key={ev} className="text-[10px] px-1.5 py-0.5 rounded bg-card-border text-muted">
                        {EVENT_LABELS[ev] ?? ev}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleTest(cfg.id)}
                    className="px-3 py-1.5 text-xs bg-card-border text-foreground rounded-lg hover:opacity-80"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => handleToggle(cfg.id, cfg.is_active)}
                    className="px-3 py-1.5 text-xs bg-card-border text-foreground rounded-lg hover:opacity-80"
                  >
                    {cfg.is_active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => handleDelete(cfg.id)}
                    className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 rounded-lg hover:opacity-80"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Logs */}
      {logs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Webhook Logs</h2>
          <div className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left bg-card-bg">
                  <th className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">Event</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">Code</th>
                  <th className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="border-b border-card-border last:border-0">
                    <td className="px-4 py-2 text-foreground">{EVENT_LABELS[log.event_type] ?? log.event_type}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${log.status === "sent" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted font-mono">{log.response_code ?? "—"}</td>
                    <td className="px-4 py-2 text-muted">{new Date(log.sent_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
