// ============================================================
// Unit Tests — AI Failover: registry & model state helpers
// ============================================================

import { describe, it, expect } from "vitest";
import {
  getModelsForTask,
  getModelById,
  getTaskTypes,
  getAllModelIds,
  TASK_MODEL_REGISTRY,
} from "../../apps/workers/nexus-ai/src/registry";

describe("getModelsForTask", () => {
  it("returns models for known task types", () => {
    const models = getModelsForTask("research");
    expect(models.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown task type", () => {
    const models = getModelsForTask("nonexistent_task");
    expect(models).toEqual([]);
  });

  it("every text-based chain ends with Workers AI", () => {
    const textTaskTypes = [
      "research",
      "writing",
      "seo",
      "code",
      "humanizer",
      "quality_review",
      "platform_variation",
      "social_adaptation",
    ];
    for (const taskType of textTaskTypes) {
      const models = getModelsForTask(taskType);
      const lastModel = models[models.length - 1];
      expect(lastModel.isWorkersAI).toBe(true);
      expect(lastModel.provider).toBe("workers-ai");
    }
  });

  it("image chains end with Workers AI image model", () => {
    const imageTaskTypes = ["text_on_image", "artistic_image"];
    for (const taskType of imageTaskTypes) {
      const models = getModelsForTask(taskType);
      const lastModel = models[models.length - 1];
      expect(lastModel.isWorkersAI).toBe(true);
      expect(lastModel.model).toContain("stable-diffusion");
    }
  });

  it("all external models have apiKeyEnvName set", () => {
    for (const [, models] of Object.entries(TASK_MODEL_REGISTRY)) {
      for (const model of models) {
        if (!model.isWorkersAI) {
          expect(model.apiKeyEnvName).toBeTruthy();
        }
      }
    }
  });

  it("all Workers AI models have empty apiKeyEnvName", () => {
    for (const [, models] of Object.entries(TASK_MODEL_REGISTRY)) {
      for (const model of models) {
        if (model.isWorkersAI) {
          expect(model.apiKeyEnvName).toBe("");
        }
      }
    }
  });
});

describe("getModelById", () => {
  it("finds a known model", () => {
    const model = getModelById("workers-ai-llama");
    expect(model).not.toBeNull();
    expect(model!.name).toContain("Workers AI");
  });

  it("returns null for unknown model ID", () => {
    const model = getModelById("nonexistent-model-xyz");
    expect(model).toBeNull();
  });
});

describe("getTaskTypes", () => {
  it("returns all registered task types", () => {
    const types = getTaskTypes();
    expect(types).toContain("research");
    expect(types).toContain("writing");
    expect(types).toContain("seo");
    expect(types).toContain("code");
    expect(types).toContain("humanizer");
    expect(types.length).toBeGreaterThanOrEqual(10);
  });
});

describe("getAllModelIds", () => {
  it("returns unique model IDs", () => {
    const ids = getAllModelIds();
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("includes Workers AI models", () => {
    const ids = getAllModelIds();
    expect(ids).toContain("workers-ai-llama");
  });
});
