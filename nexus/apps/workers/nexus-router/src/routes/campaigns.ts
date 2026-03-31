// ============================================================
// Campaign Routes — plan campaigns weeks ahead with daily targets
// ============================================================

import { Hono } from "hono";
import type { ApiResponse } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { errorResponse, sanitizeInput } from "../helpers";
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignProgress,
  executeCampaignBatch,
} from "../services/campaign-service";

const campaigns = new Hono<{ Bindings: RouterEnv }>();

// GET /api/campaigns — list all campaigns
campaigns.get("/", async (c) => {
  try {
    const data = await listCampaigns(c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/campaigns/:id — get campaign by ID
campaigns.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await getCampaign(id, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// GET /api/campaigns/:id/progress — get campaign progress dashboard
campaigns.get("/:id/progress", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await getCampaignProgress(id, c.env);
    if (!data) {
      return c.json<ApiResponse>(
        { success: false, error: "Campaign not found" },
        404
      );
    }
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/campaigns — create new campaign
campaigns.post("/", async (c) => {
  try {
    const body = await c.req.json<{
      name: string;
      domain_id: string;
      category_id?: string;
      target_count: number;
      deadline?: string;
      niche_keywords?: string[];
      platforms?: string[];
      social_channels?: string[];
      language?: string;
      auto_approve_threshold?: number;
    }>();

    if (!body.name || !body.domain_id || !body.target_count) {
      return c.json<ApiResponse>(
        { success: false, error: "name, domain_id, and target_count are required" },
        400
      );
    }

    body.name = sanitizeInput(body.name);

    if (body.target_count < 1) {
      return c.json<ApiResponse>(
        { success: false, error: "target_count must be a positive integer" },
        400
      );
    }

    if (body.deadline) {
      const deadlineDate = new Date(body.deadline);
      if (isNaN(deadlineDate.getTime())) {
        return c.json<ApiResponse>(
          { success: false, error: "deadline must be a valid date string" },
          400
        );
      }
      if (deadlineDate.getTime() < Date.now()) {
        return c.json<ApiResponse>(
          { success: false, error: "deadline must be a future date" },
          400
        );
      }
    }

    const result = await createCampaign(body, c.env);
    return c.json<ApiResponse>({ success: true, data: result }, 201);
  } catch (err) {
    return errorResponse(c, err);
  }
});

// PUT /api/campaigns/:id — update campaign
campaigns.put("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json<Record<string, unknown>>();
    const result = await updateCampaign(id, body, c.env);
    return c.json<ApiResponse>({ success: true, data: result });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// POST /api/campaigns/:id/execute — execute a batch of products for this campaign
campaigns.post("/:id/execute", async (c) => {
  try {
    const id = c.req.param("id");
    const data = await executeCampaignBatch(id, c.env);
    return c.json<ApiResponse>({ success: true, data });
  } catch (err) {
    return errorResponse(c, err);
  }
});

// DELETE /api/campaigns/:id — delete campaign
campaigns.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await deleteCampaign(id, c.env);
    return c.json<ApiResponse>({ success: true, data: { deleted: id } });
  } catch (err) {
    return errorResponse(c, err);
  }
});

export default campaigns;
