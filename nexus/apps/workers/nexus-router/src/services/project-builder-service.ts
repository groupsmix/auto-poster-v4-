// ============================================================
// Project Builder Service — forwards to nexus-workflow
// ============================================================

import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";

/** Forward a request to the nexus-workflow project builder endpoints */
async function forwardToWorkflow(
  env: RouterEnv,
  path: string,
  init?: RequestInit
): Promise<ApiResponse> {
  const resp = await env.NEXUS_WORKFLOW.fetch(
    `http://nexus-workflow/workflow/project-builder${path}`,
    init
  );
  return (await resp.json()) as ApiResponse;
}

/** Start a new project build */
export async function startProjectBuild(
  body: { idea: string; tech_stack?: string; features?: string[]; target_user?: string; design_style?: string },
  env: RouterEnv
): Promise<ApiResponse> {
  return forwardToWorkflow(env, "/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** List all project builds */
export async function listProjectBuilds(
  env: RouterEnv,
  page?: number,
  pageSize?: number
): Promise<ApiResponse> {
  const params = new URLSearchParams();
  if (page) params.set("page", String(page));
  if (pageSize) params.set("pageSize", String(pageSize));
  const qs = params.toString();
  return forwardToWorkflow(env, `/list${qs ? `?${qs}` : ""}`);
}

/** Get project build progress */
export async function getProjectBuildProgress(
  buildId: string,
  env: RouterEnv
): Promise<ApiResponse> {
  return forwardToWorkflow(env, `/${buildId}`);
}

/** Get full project build details */
export async function getProjectBuildDetails(
  buildId: string,
  env: RouterEnv
): Promise<ApiResponse> {
  return forwardToWorkflow(env, `/${buildId}/details`);
}

/** Get generated files for a project build */
export async function getProjectBuildFiles(
  buildId: string,
  env: RouterEnv
): Promise<ApiResponse> {
  return forwardToWorkflow(env, `/${buildId}/files`);
}

/** Rebuild with feedback */
export async function rebuildProject(
  buildId: string,
  feedback: string,
  env: RouterEnv
): Promise<ApiResponse> {
  return forwardToWorkflow(env, `/${buildId}/rebuild`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback }),
  });
}

/** Cancel a project build */
export async function cancelProjectBuild(
  buildId: string,
  env: RouterEnv
): Promise<ApiResponse> {
  return forwardToWorkflow(env, `/${buildId}/cancel`, {
    method: "POST",
  });
}

/** Delete a project build */
export async function deleteProjectBuild(
  buildId: string,
  env: RouterEnv
): Promise<ApiResponse> {
  return forwardToWorkflow(env, `/${buildId}`, {
    method: "DELETE",
  });
}
