// ============================================================
// Workflow Engine — Types
// ============================================================

import type { AutoApproveSettings } from "@nexus/shared";
import type { StepName, ProductContext, PromptTemplates } from "../steps";

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
