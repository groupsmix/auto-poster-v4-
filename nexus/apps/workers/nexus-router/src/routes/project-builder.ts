// ============================================================
// AI Project Builder Routes
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse, validateStringField } from "../helpers";
import {
  startProjectBuild,
  listProjectBuilds,
  getProjectBuildProgress,
  getProjectBuildDetails,
  getProjectBuildFiles,
  rebuildProject,
  cancelProjectBuild,
  deleteProjectBuild,
} from "../services/project-builder-service";

const projectBuilder = new Hono<{ Bindings: RouterEnv }>();

// POST /api/project-builder — Start a new project build
projectBuilder.post("/", async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const idea = validateStringField(body, "idea");
    if (!idea) {
      return c.json<ApiResponse>(
        { success: false, error: "Field 'idea' is required and must be a non-empty string" },
        400
      );
    }

    const result = await startProjectBuild(
      {
        idea,
        tech_stack: typeof body.tech_stack === "string" ? body.tech_stack : undefined,
        features: Array.isArray(body.features) ? body.features as string[] : undefined,
        target_user: typeof body.target_user === "string" ? body.target_user : undefined,
        design_style: typeof body.design_style === "string" ? body.design_style : undefined,
      },
      c.env
    );

    if (!result.success) {
      return c.json<ApiResponse>(result, 500);
    }

    return c.json<ApiResponse>(result, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/project-builder — List all project builds
projectBuilder.get("/", async (c) => {
  try {
    const page = c.req.query("page");
    const pageSize = c.req.query("pageSize");
    const result = await listProjectBuilds(
      c.env,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined
    );
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/project-builder/:buildId — Get build progress
projectBuilder.get("/:buildId", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    const result = await getProjectBuildProgress(buildId, c.env);
    if (!result.success) {
      return c.json<ApiResponse>(result, 404);
    }
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/project-builder/:buildId/details — Get full build details
projectBuilder.get("/:buildId/details", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    const result = await getProjectBuildDetails(buildId, c.env);
    if (!result.success) {
      return c.json<ApiResponse>(result, 404);
    }
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/project-builder/:buildId/files — Get generated files
projectBuilder.get("/:buildId/files", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    const result = await getProjectBuildFiles(buildId, c.env);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/project-builder/:buildId/rebuild — Rebuild with feedback
projectBuilder.post("/:buildId/rebuild", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    const body = (await c.req.json()) as Record<string, unknown>;
    const feedback = validateStringField(body, "feedback");
    if (!feedback) {
      return c.json<ApiResponse>(
        { success: false, error: "Field 'feedback' is required" },
        400
      );
    }
    const result = await rebuildProject(buildId, feedback, c.env);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/project-builder/:buildId/cancel — Cancel a build
projectBuilder.post("/:buildId/cancel", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    const result = await cancelProjectBuild(buildId, c.env);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/project-builder/:buildId — Delete a build
projectBuilder.delete("/:buildId", async (c) => {
  try {
    const buildId = c.req.param("buildId");
    const result = await deleteProjectBuild(buildId, c.env);
    return c.json<ApiResponse>(result);
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default projectBuilder;
