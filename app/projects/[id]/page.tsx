import { notFound } from "next/navigation";
import { AssetViewer } from "@/components/asset-viewer";
import { ExportButton } from "@/components/export-button";
import { RunButton } from "@/components/run-button";
import { Badge, Card, PageShell, SectionTitle } from "@/components/ui";
import { getProject } from "@/lib/projects";
import { safeParseJson } from "@/lib/utils";

export default async function ProjectPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  const latestRun = project.runs[0];
  const logs = safeParseJson<Array<{ step: string; summary: string; timestamp: string; status: string }>>(
    latestRun?.logsJson,
    []
  );

  return (
    <PageShell>
      <div className="grid gap-6">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{project.mode}</Badge>
                <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">{project.status}</Badge>
                <Badge className="border-white/10 bg-white/10 text-slate-200">{project.goal}</Badge>
              </div>
              <div>
                <h1 className="text-3xl font-semibold">{project.title}</h1>
                <p className="text-sm text-slate-300">
                  {project.niche} · {project.audience}
                </p>
              </div>
              <p className="max-w-4xl text-sm text-slate-300">
                {project.summary || "Run the workflow to generate the full project package."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <RunButton projectId={project.id} />
              <ExportButton projectId={project.id} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="Progress" value={`${project.progress}%`} />
            <Stat label="Current step" value={project.currentStep || "Waiting"} />
            <Stat label="Assets" value={`${project.assets.length}`} />
            <Stat label="Runs" value={`${project.runs.length}`} />
          </div>
        </Card>

        <section className="space-y-4">
          <SectionTitle
            eyebrow="Workflow history"
            title="Latest run log"
            description="The engine saves each stage so you can see what happened and where to improve the pipeline."
          />
          <div className="grid gap-4">
            {logs.length ? (
              logs.map((log, index) => (
                <Card key={`${log.timestamp}-${index}`} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">{log.step}</h3>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{log.status}</span>
                  </div>
                  <p className="text-sm text-slate-300">{log.summary}</p>
                  <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString()}</p>
                </Card>
              ))
            ) : (
              <Card>No runs yet.</Card>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle
            eyebrow="Generated assets"
            title="Artifacts"
            description="Every generated output is stored as a project asset and included in the ZIP export."
          />
          <AssetViewer assets={project.assets} />
        </section>
      </div>
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}
