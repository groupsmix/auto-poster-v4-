import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function buildProjectZip(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      assets: { orderBy: [{ kind: "asc" }, { name: "asc" }] },
      runs: { orderBy: { startedAt: "desc" }, take: 1 }
    }
  });

  if (!project) throw new Error("Project not found");

  const zip = new JSZip();
  const root = zip.folder(slugify(project.title))!;
  const briefDir = root.folder("brief")!;
  const productDir = root.folder("product")!;
  const siteDir = root.folder("site")!;
  const brandDir = root.folder("branding")!;
  const salesDir = root.folder("sales")!;
  const systemDir = root.folder("system")!;

  root.file(
    "project.json",
    JSON.stringify(
      {
        id: project.id,
        title: project.title,
        mode: project.mode,
        goal: project.goal,
        niche: project.niche,
        audience: project.audience,
        quality: project.quality,
        status: project.status,
        summary: project.summary
      },
      null,
      2
    )
  );

  for (const asset of project.assets) {
    const ext = extensionFor(asset.format);
    const filename = `${slugify(asset.name)}.${ext}`;

    if (asset.kind === "BRIEF") briefDir.file(filename, asset.content);
    else if (asset.kind === "PRODUCT") productDir.file(filename, asset.content);
    else if (asset.kind === "SITE") siteDir.file(filename, asset.content);
    else if (asset.kind === "BRAND") brandDir.file(filename, asset.content);
    else if (asset.kind === "SALES") salesDir.file(filename, asset.content);
    else systemDir.file(filename, asset.content);
  }

  const latestRun = project.runs[0];
  if (latestRun?.logsJson) {
    systemDir.file("workflow-log.json", latestRun.logsJson);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

function extensionFor(format: string) {
  switch (format) {
    case "html":
      return "html";
    case "json":
      return "json";
    case "txt":
      return "txt";
    default:
      return "md";
  }
}
