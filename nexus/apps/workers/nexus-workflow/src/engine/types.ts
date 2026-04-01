// ============================================================
// Workflow Engine — Types
// ============================================================

import type { AutoApproveSettings, CEOWorkflowConfig } from "@nexus/shared";
import type { StepName, ProductContext, PromptTemplates } from "../steps";

export type { CEOWorkflowConfig } from "@nexus/shared";

export interface WorkflowInput {
  productId: string;
  product: ProductContext;
  promptTemplates: PromptTemplates;
  revisionFeedback?: string;
  /** Steps to re-run on revision (only failed/rejected steps) */
  revisionSteps?: StepName[];
  /** Auto-approve settings (from scheduler/campaign or global settings) */
  autoApproveSettings?: AutoApproveSettings;
  /** Track auto-revision attempts to prevent infinite loops */
  autoRevisionAttempt?: number;
  /** CEO workflow recommendations for this category (loaded from KV) */
  ceoWorkflowConfig?: CEOWorkflowConfig;
}

export interface StepResult {
  stepName: StepName;
  output: Record<string, unknown>;
  model: string;
  cached: boolean;
  tokens: number;
  cost: number;
  latencyMs: number;
}
