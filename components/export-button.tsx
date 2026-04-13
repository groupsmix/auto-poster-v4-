"use client";

export function ExportButton({ projectId }: { projectId: string }) {
  async function download() {
    const response = await fetch(`/api/projects/${projectId}/export`);
    if (!response.ok) {
      const data = await response.json();
      alert(data.error || "Export failed");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${projectId}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold transition hover:bg-white/10"
    >
      Export ZIP
    </button>
  );
}
