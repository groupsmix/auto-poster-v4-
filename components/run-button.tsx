"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const response = await fetch(`/api/projects/${projectId}/run`, {
      method: "POST"
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      alert(data.error || "Run failed");
      return;
    }

    router.refresh();
  }

  return (
    <button
      onClick={run}
      disabled={loading}
      className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
    >
      {loading ? "Running..." : "Run end-to-end workflow"}
    </button>
  );
}
