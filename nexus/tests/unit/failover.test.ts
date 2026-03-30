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
      "copywriting",
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

  it("aliases resolve to their base chains", () => {
    // image is aliased to copywriting
    expect(getModelsForTask("image")).toBe(getModelsForTask("copywriting"));
    // review is aliased to quality_review
    expect(getModelsForTask("review")).toBe(getModelsForTask("quality_review"));
    // variation is aliased to platform_variation
    expect(getModelsForTask("variation")).toBe(getModelsForTask("platform_variation"));
    // social is aliased to social_adaptation
    expect(getModelsForTask("social")).toBe(getModelsForTask("social_adaptation"));
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
    expect(types).toContain("copywriting");
    expect(types).toContain("humanizer");
    expect(types.length).toBeGreaterThanOrEqual(8);
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
