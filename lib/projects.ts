import { prisma } from "@/lib/prisma";
import { getOpportunities } from "@/lib/opportunities";
import { projectCreateSchema } from "@/lib/schemas";
import type { ProjectInput } from "@/lib/types";

export async function listProjects() {
  return prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      assets: { orderBy: { createdAt: "desc" } },
      runs: { orderBy: { startedAt: "desc" }, take: 1 }
    }
  });
}

export async function getProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assets: { orderBy: [{ kind: "asc" }, { createdAt: "asc" }] },
      runs: { orderBy: { startedAt: "desc" } }
    }
  });
}

export async function createProject(input: ProjectInput) {
  const data = projectCreateSchema.parse(input);
  let title = data.title?.trim();

  if (!title) {
    const opportunities = await getOpportunities();
    const best = opportunities.find((row) => data.mode === "auto" || row.suggestedMode === data.mode);
    title = best?.title ?? `Untitled ${data.mode === "site" ? "Site" : "Product"}`;
  }

  const resolvedMode =
    data.mode === "auto"
      ? data.goal === "authority"
        ? "site"
        : "digital-product"
      : data.mode;

  return prisma.project.create({
    data: {
      title,
      mode: resolvedMode,
      goal: data.goal,
      niche: data.niche,
      audience: data.audience,
      quality: data.quality,
      sourceIdea: data.sourceIdea
    }
  });
}
