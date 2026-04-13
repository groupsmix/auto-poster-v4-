import { AssetKind, ProjectStatus, type Project } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { complete } from "@/lib/ai/provider";
import {
  briefPrompt,
  brandPrompt,
  productPrompt,
  salesPrompt,
  sitePrompt
} from "@/lib/ai/prompts";
import { prettyJson } from "@/lib/utils";

type StepResult = {
  name: string;
  summary: string;
};

async function upsertAsset(projectId: string, kind: AssetKind, name: string, content: string, format = "markdown", metadata?: object) {
  const existing = await prisma.asset.findFirst({
    where: { projectId, kind, name }
  });

  if (existing) {
    return prisma.asset.update({
      where: { id: existing.id },
      data: { content, format, metadata: metadata ? prettyJson(metadata) : undefined }
    });
  }

  return prisma.asset.create({
    data: {
      projectId,
      kind,
      name,
      content,
      format,
      metadata: metadata ? prettyJson(metadata) : undefined
    }
  });
}

async function log(runId: string, entry: StepResult, status: "done" | "failed" | "pending" = "done") {
  const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
  const current = run?.logsJson ? JSON.parse(run.logsJson) as Array<Record<string, string>> : [];
  current.push({
    step: entry.name,
    summary: entry.summary,
    status,
    timestamp: new Date().toISOString()
  });

  await prisma.workflowRun.update({
    where: { id: runId },
    data: { logsJson: JSON.stringify(current) }
  });
}

export async function runProjectWorkflow(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId }
  });

  if (!project) {
    throw new Error("Project not found");
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { status: ProjectStatus.RUNNING, progress: 5, currentStep: "Starting workflow" }
  });

  const run = await prisma.workflowRun.create({
    data: { projectId, status: "running", logsJson: "[]" }
  });

  try {
    const brief = await generateBrief(project, run.id);
    const main = project.mode === "site"
      ? await generateSite(project, brief, run.id)
      : await generateProduct(project, brief, run.id);

    await prisma.project.update({
      where: { id: projectId },
      data: { progress: 75, currentStep: "Building brand and sales assets" }
    });

    const brand = await generateBrand(project, brief, run.id);
    const sales = await generateSales(project, brief, run.id);

    const summary = [
      `Mode: ${project.mode}`,
      `Main artifact: ${main}`,
      `Brand package: ${brand}`,
      `Sales package: ${sales}`
    ].join("\n");

    await upsertAsset(projectId, AssetKind.SYSTEM, "project-summary", summary, "txt");

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.COMPLETED,
        progress: 100,
        currentStep: "Completed",
        summary
      }
    });

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "completed", endedAt: new Date() }
    });

    await log(run.id, {
      name: "Workflow Complete",
      summary: "Project finished successfully."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown workflow error";

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: ProjectStatus.FAILED,
        currentStep: "Failed",
        summary: message
      }
    });

    await prisma.workflowRun.update({
      where: { id: run.id },
      data: { status: "failed", endedAt: new Date() }
    });

    await log(run.id, { name: "Workflow Failed", summary: message }, "failed");

    throw error;
  }
}

async function generateBrief(project: Project, runId: string) {
  await prisma.project.update({
    where: { id: project.id },
    data: { progress: 18, currentStep: "Generating brief" }
  });

  const response = await complete(briefPrompt(project));
  await upsertAsset(project.id, AssetKind.BRIEF, "build-brief", response.text, "markdown", {
    provider: response.provider
  });
  await log(runId, { name: "Brief", summary: `Created build brief with ${response.provider}.` });

  return response.text;
}

async function generateProduct(project: Project, brief: string, runId: string) {
  await prisma.project.update({
    where: { id: project.id },
    data: { progress: 45, currentStep: "Generating digital product" }
  });

  const response = await complete(productPrompt(project, brief));
  await upsertAsset(project.id, AssetKind.PRODUCT, "product-package", response.text, "markdown", {
    provider: response.provider
  });
  await log(runId, { name: "Digital Product", summary: "Built digital product package." });

  return "product-package";
}

async function generateSite(project: Project, brief: string, runId: string) {
  await prisma.project.update({
    where: { id: project.id },
    data: { progress: 45, currentStep: "Generating site strategy and copy" }
  });

  const response = await complete(sitePrompt(project, brief));
  const html = buildSimpleSiteHtml(project.title, response.text);

  await upsertAsset(project.id, AssetKind.SITE, "site-blueprint", response.text, "markdown", {
    provider: response.provider
  });

  await upsertAsset(project.id, AssetKind.SITE, "index", html, "html");

  await log(runId, { name: "Site", summary: "Built site blueprint and starter HTML." });

  return "site-blueprint + index.html";
}

async function generateBrand(project: Project, brief: string, runId: string) {
  const response = await complete(brandPrompt(project, brief));
  await upsertAsset(project.id, AssetKind.BRAND, "brand-direction", response.text, "markdown", {
    provider: response.provider
  });
  await log(runId, { name: "Brand", summary: "Created visual and packaging direction." });

  return "brand-direction";
}

async function generateSales(project: Project, brief: string, runId: string) {
  const response = await complete(salesPrompt(project, brief));
  await upsertAsset(project.id, AssetKind.SALES, "sales-assets", response.text, "markdown", {
    provider: response.provider
  });
  await log(runId, { name: "Sales", summary: "Created sales and launch assets." });

  return "sales-assets";
}

function buildSimpleSiteHtml(title: string, blueprint: string) {
  const escaped = blueprint
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 0; background: #0b1020; color: #f3f4f6; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 72px 24px; }
    .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; padding: 32px; }
    h1, h2, h3 { line-height: 1.1; }
    pre { white-space: pre-wrap; font-size: 14px; line-height: 1.6; }
    .hero { margin-bottom: 24px; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card hero">
      <p>Generated site starter</p>
      <h1>${title}</h1>
      <p>This starter HTML is exported from the one-click site pipeline. Replace or refine sections using the site blueprint below.</p>
    </section>
    <section class="card">
      <h2>Blueprint and Copy</h2>
      <pre>${escaped}</pre>
    </section>
  </main>
</body>
</html>`;
}
