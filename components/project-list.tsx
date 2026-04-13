import Link from "next/link";
import { Project } from "@prisma/client";
import { Badge, Card } from "@/components/ui";

type Row = Project & {
  assets: Array<{ id: string }>;
};

export function ProjectList({ projects }: { projects: Row[] }) {
  if (!projects.length) {
    return (
      <Card>
        No projects yet. Create one above and run the workflow.
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {projects.map((project) => (
        <Card key={project.id} className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge>{project.mode}</Badge>
              <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">{project.status}</Badge>
            </div>
            <div>
              <h3 className="text-xl font-semibold">{project.title}</h3>
              <p className="text-sm text-slate-300">
                {project.niche} · {project.goal} · {project.audience}
              </p>
            </div>
            <p className="text-sm text-slate-400">Progress: {project.progress}% · Assets: {project.assets.length}</p>
          </div>

          <Link
            href={`/projects/${project.id}`}
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/10"
          >
            Open project
          </Link>
        </Card>
      ))}
    </div>
  );
}
