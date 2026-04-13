export type BuildMode = "digital-product" | "site" | "auto";

export type BuildGoal = "sell" | "authority" | "freelance" | "experiment";

export type ProjectInput = {
  title?: string;
  mode: BuildMode;
  goal: BuildGoal;
  niche: string;
  audience: string;
  quality: "balanced" | "premium";
  sourceIdea?: string;
};

export type OpportunityCard = {
  title: string;
  niche: string;
  summary: string;
  score: number;
  suggestedMode: Exclude<BuildMode, "auto">;
};

export type WorkflowLog = {
  step: string;
  status: "pending" | "done" | "failed";
  summary: string;
  timestamp: string;
};

export type GeneratedArtifact = {
  kind: "brief" | "product" | "site" | "brand" | "sales" | "system";
  name: string;
  format: "markdown" | "json" | "txt" | "html";
  content: string;
  metadata?: Record<string, unknown>;
};
