"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const defaults = {
  mode: "auto",
  goal: "sell",
  niche: "solo operators",
  audience: "people who want structured fast results",
  quality: "premium",
  sourceIdea: ""
};

export function ProjectForm() {
  const router = useRouter();
  const [form, setForm] = useState(defaults);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      alert(data.error || "Could not create project");
      return;
    }

    router.push(`/projects/${data.project.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2 text-sm">
        <span>Build mode</span>
        <select
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
          value={form.mode}
          onChange={(event) => setForm({ ...form, mode: event.target.value })}
        >
          <option value="auto">AI choose</option>
          <option value="digital-product">Digital product</option>
          <option value="site">Site</option>
        </select>
      </label>

      <label className="space-y-2 text-sm">
        <span>Goal</span>
        <select
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
          value={form.goal}
          onChange={(event) => setForm({ ...form, goal: event.target.value })}
        >
          <option value="sell">Sell</option>
          <option value="authority">Authority</option>
          <option value="freelance">Freelance</option>
          <option value="experiment">Experiment</option>
        </select>
      </label>

      <label className="space-y-2 text-sm">
        <span>Niche</span>
        <input
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
          value={form.niche}
          onChange={(event) => setForm({ ...form, niche: event.target.value })}
        />
      </label>

      <label className="space-y-2 text-sm">
        <span>Audience</span>
        <input
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
          value={form.audience}
          onChange={(event) => setForm({ ...form, audience: event.target.value })}
        />
      </label>

      <label className="space-y-2 text-sm md:col-span-2">
        <span>Optional idea or constraint</span>
        <textarea
          className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
          value={form.sourceIdea}
          onChange={(event) => setForm({ ...form, sourceIdea: event.target.value })}
          placeholder="Add a topic, format, trend angle, or leave blank for AI-led generation."
        />
      </label>

      <label className="space-y-2 text-sm md:col-span-2">
        <span>Quality</span>
        <select
          className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3"
          value={form.quality}
          onChange={(event) => setForm({ ...form, quality: event.target.value })}
        >
          <option value="balanced">Balanced</option>
          <option value="premium">Premium</option>
        </select>
      </label>

      <button
        disabled={loading}
        className="rounded-2xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70 md:col-span-2"
      >
        {loading ? "Creating..." : "Create project"}
      </button>
    </form>
  );
}
