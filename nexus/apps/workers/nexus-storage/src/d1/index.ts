// ============================================================
// D1 Queries — Facade class that delegates to entity-specific modules
// ============================================================

import type {
  Domain,
  Category,
  Platform,
  SocialChannel,
  Product,
  WorkflowRun,
  WorkflowStep,
  Asset,
  PlatformVariant,
  SocialVariant,
  Review,
  RevisionHistory,
  PromptTemplate,
  AIModel,
  AnalyticsEvent,
  Setting,
  WorkflowStatus,
} from "@nexus/shared";

import * as domains from "./domains";
import * as categories from "./categories";
import * as platforms from "./platforms";
import * as socialChannels from "./social-channels";
import * as products from "./products";
import * as workflowRuns from "./workflow-runs";
import * as workflowSteps from "./workflow-steps";
import * as assets from "./assets";
import * as variants from "./variants";
import * as reviews from "./reviews";
import * as prompts from "./prompts";
import * as aiModels from "./ai-models";
import * as analytics from "./analytics";
import * as settings from "./settings";
import * as helpers from "./helpers";

export class D1Queries {
  constructor(private db: D1Database) {}

  /** Execute a raw parameterized query (used by POST /d1/query route) */
  async query(sql: string, params: unknown[] = []): Promise<D1Result> {
    return this.db
      .prepare(sql)
      .bind(...params)
      .all();
  }

  /** Execute a raw parameterized run (INSERT/UPDATE/DELETE) */
  async run(sql: string, params: unknown[] = []): Promise<D1Result> {
    return this.db
      .prepare(sql)
      .bind(...params)
      .run();
  }

  // --- DOMAINS ---
  getDomains(): Promise<Domain[]> { return domains.getDomains(this.db); }
  getDomainById(id: string): Promise<Domain | null> { return domains.getDomainById(this.db, id); }
  createDomain(domain: Omit<Domain, "created_at">): Promise<Domain> { return domains.createDomain(this.db, domain); }
  updateDomain(id: string, data: Partial<Omit<Domain, "id" | "created_at">>): Promise<void> { return domains.updateDomain(this.db, id, data); }
  deleteDomain(id: string): Promise<void> { return domains.deleteDomain(this.db, id); }

  // --- CATEGORIES ---
  getCategories(domainId?: string): Promise<Category[]> { return categories.getCategories(this.db, domainId); }
  getCategoryById(id: string): Promise<Category | null> { return categories.getCategoryById(this.db, id); }
  createCategory(category: Category): Promise<Category> { return categories.createCategory(this.db, category); }
  updateCategory(id: string, data: Partial<Omit<Category, "id">>): Promise<void> { return categories.updateCategory(this.db, id, data); }
  deleteCategory(id: string): Promise<void> { return categories.deleteCategory(this.db, id); }

  // --- PLATFORMS ---
  getPlatforms(): Promise<Platform[]> { return platforms.getPlatforms(this.db); }
  getPlatformById(id: string): Promise<Platform | null> { return platforms.getPlatformById(this.db, id); }
  createPlatform(platform: Platform): Promise<Platform> { return platforms.createPlatform(this.db, platform); }
  updatePlatform(id: string, data: Partial<Omit<Platform, "id">>): Promise<void> { return platforms.updatePlatform(this.db, id, data); }
  deletePlatform(id: string): Promise<void> { return platforms.deletePlatform(this.db, id); }

  // --- SOCIAL CHANNELS ---
  getSocialChannels(): Promise<SocialChannel[]> { return socialChannels.getSocialChannels(this.db); }
  getSocialChannelById(id: string): Promise<SocialChannel | null> { return socialChannels.getSocialChannelById(this.db, id); }
  createSocialChannel(channel: SocialChannel): Promise<SocialChannel> { return socialChannels.createSocialChannel(this.db, channel); }
  updateSocialChannel(id: string, data: Partial<Omit<SocialChannel, "id">>): Promise<void> { return socialChannels.updateSocialChannel(this.db, id, data); }
  deleteSocialChannel(id: string): Promise<void> { return socialChannels.deleteSocialChannel(this.db, id); }

  // --- PRODUCTS ---
  getProducts(): Promise<Product[]> { return products.getProducts(this.db); }
  getProductById(id: string): Promise<Product | null> { return products.getProductById(this.db, id); }
  getProductsByDomain(domainId: string): Promise<Product[]> { return products.getProductsByDomain(this.db, domainId); }
  getProductsByCategory(categoryId: string): Promise<Product[]> { return products.getProductsByCategory(this.db, categoryId); }
  getProductsByBatch(batchId: string): Promise<Product[]> { return products.getProductsByBatch(this.db, batchId); }
  createProduct(product: Omit<Product, "created_at" | "updated_at">): Promise<Product> { return products.createProduct(this.db, product); }
  updateProduct(id: string, data: Partial<Omit<Product, "id" | "created_at">>): Promise<void> { return products.updateProduct(this.db, id, data); }
  deleteProduct(id: string): Promise<void> { return products.deleteProduct(this.db, id); }

  // --- WORKFLOW RUNS ---
  getWorkflowRuns(productId?: string): Promise<WorkflowRun[]> { return workflowRuns.getWorkflowRuns(this.db, productId); }
  getWorkflowRunById(id: string): Promise<WorkflowRun | null> { return workflowRuns.getWorkflowRunById(this.db, id); }
  createWorkflowRun(run: Omit<WorkflowRun, "total_tokens" | "total_cost" | "cache_hits">): Promise<WorkflowRun> { return workflowRuns.createWorkflowRun(this.db, run); }
  updateWorkflowRun(id: string, data: Partial<Omit<WorkflowRun, "id">>): Promise<void> { return workflowRuns.updateWorkflowRun(this.db, id, data); }
  deleteWorkflowRun(id: string): Promise<void> { return workflowRuns.deleteWorkflowRun(this.db, id); }
  updateWorkflowStatus(runId: string, status: WorkflowStatus): Promise<void> { return workflowRuns.updateWorkflowStatus(this.db, runId, status); }
  getWorkflowWithSteps(runId: string): Promise<{ run: WorkflowRun; steps: WorkflowStep[] } | null> { return workflowRuns.getWorkflowWithSteps(this.db, runId); }

  // --- WORKFLOW STEPS ---
  getWorkflowSteps(runId: string): Promise<WorkflowStep[]> { return workflowSteps.getWorkflowSteps(this.db, runId); }
  getWorkflowStepById(id: string): Promise<WorkflowStep | null> { return workflowSteps.getWorkflowStepById(this.db, id); }
  createWorkflowStep(step: WorkflowStep): Promise<WorkflowStep> { return workflowSteps.createWorkflowStep(this.db, step); }
  updateWorkflowStep(id: string, data: Partial<Omit<WorkflowStep, "id">>): Promise<void> { return workflowSteps.updateWorkflowStep(this.db, id, data); }
  updateStepStatus(stepId: string, status: string, output?: Record<string, unknown>): Promise<void> { return workflowSteps.updateStepStatus(this.db, stepId, status, output); }
  deleteWorkflowStep(id: string): Promise<void> { return workflowSteps.deleteWorkflowStep(this.db, id); }

  // --- ASSETS ---
  getAssets(productId?: string): Promise<Asset[]> { return assets.getAssets(this.db, productId); }
  getAssetById(id: string): Promise<Asset | null> { return assets.getAssetById(this.db, id); }
  createAsset(asset: Omit<Asset, "created_at">): Promise<Asset> { return assets.createAsset(this.db, asset); }
  updateAsset(id: string, data: Partial<Omit<Asset, "id" | "created_at">>): Promise<void> { return assets.updateAsset(this.db, id, data); }
  deleteAsset(id: string): Promise<void> { return assets.deleteAsset(this.db, id); }

  // --- PLATFORM VARIANTS ---
  getPlatformVariants(productId?: string): Promise<PlatformVariant[]> { return variants.getPlatformVariants(this.db, productId); }
  getPlatformVariantById(id: string): Promise<PlatformVariant | null> { return variants.getPlatformVariantById(this.db, id); }
  createPlatformVariant(variant: PlatformVariant): Promise<PlatformVariant> { return variants.createPlatformVariant(this.db, variant); }
  updatePlatformVariant(id: string, data: Partial<Omit<PlatformVariant, "id">>): Promise<void> { return variants.updatePlatformVariant(this.db, id, data); }
  deletePlatformVariant(id: string): Promise<void> { return variants.deletePlatformVariant(this.db, id); }

  // --- SOCIAL VARIANTS ---
  getSocialVariants(productId?: string): Promise<SocialVariant[]> { return variants.getSocialVariants(this.db, productId); }
  getSocialVariantById(id: string): Promise<SocialVariant | null> { return variants.getSocialVariantById(this.db, id); }
  createSocialVariant(variant: SocialVariant): Promise<SocialVariant> { return variants.createSocialVariant(this.db, variant); }
  updateSocialVariant(id: string, data: Partial<Omit<SocialVariant, "id">>): Promise<void> { return variants.updateSocialVariant(this.db, id, data); }
  deleteSocialVariant(id: string): Promise<void> { return variants.deleteSocialVariant(this.db, id); }

  // --- REVIEWS ---
  getReviews(productId?: string): Promise<Review[]> { return reviews.getReviews(this.db, productId); }
  getReviewById(id: string): Promise<Review | null> { return reviews.getReviewById(this.db, id); }
  createReview(review: Omit<Review, "reviewed_at">): Promise<Review> { return reviews.createReview(this.db, review); }
  updateReview(id: string, data: Partial<Omit<Review, "id">>): Promise<void> { return reviews.updateReview(this.db, id, data); }
  deleteReview(id: string): Promise<void> { return reviews.deleteReview(this.db, id); }

  // --- REVISION HISTORY ---
  getRevisionHistory(productId: string): Promise<RevisionHistory[]> { return reviews.getRevisionHistory(this.db, productId); }
  getRevisionById(id: string): Promise<RevisionHistory | null> { return reviews.getRevisionById(this.db, id); }
  createRevision(revision: RevisionHistory): Promise<RevisionHistory> { return reviews.createRevision(this.db, revision); }
  deleteRevision(id: string): Promise<void> { return reviews.deleteRevision(this.db, id); }

  // --- PROMPT TEMPLATES ---
  getPromptTemplates(layer?: string): Promise<PromptTemplate[]> { return prompts.getPromptTemplates(this.db, layer); }
  getPromptTemplateById(id: string): Promise<PromptTemplate | null> { return prompts.getPromptTemplateById(this.db, id); }
  createPromptTemplate(template: Omit<PromptTemplate, "updated_at">): Promise<PromptTemplate> { return prompts.createPromptTemplate(this.db, template); }
  updatePromptTemplate(id: string, data: Partial<Omit<PromptTemplate, "id">>): Promise<void> { return prompts.updatePromptTemplate(this.db, id, data); }
  deletePromptTemplate(id: string): Promise<void> { return prompts.deletePromptTemplate(this.db, id); }

  // --- AI MODELS ---
  getAIModels(): Promise<AIModel[]> { return aiModels.getAIModels(this.db); }
  getAIModelById(id: string): Promise<AIModel | null> { return aiModels.getAIModelById(this.db, id); }
  getAIModelsByTaskType(taskType: string): Promise<AIModel[]> { return aiModels.getAIModelsByTaskType(this.db, taskType); }
  createAIModel(model: AIModel): Promise<AIModel> { return aiModels.createAIModel(this.db, model); }
  updateAIModel(id: string, data: Partial<Omit<AIModel, "id">>): Promise<void> { return aiModels.updateAIModel(this.db, id, data); }
  deleteAIModel(id: string): Promise<void> { return aiModels.deleteAIModel(this.db, id); }

  // --- ANALYTICS ---
  getAnalytics(limit?: number): Promise<AnalyticsEvent[]> { return analytics.getAnalytics(this.db, limit); }
  getAnalyticsByType(eventType: string, limit?: number): Promise<AnalyticsEvent[]> { return analytics.getAnalyticsByType(this.db, eventType, limit); }
  recordAnalyticsEvent(event: Omit<AnalyticsEvent, "id" | "created_at">): Promise<AnalyticsEvent> { return analytics.recordAnalyticsEvent(this.db, event); }
  deleteAnalyticsEvent(id: string): Promise<void> { return analytics.deleteAnalyticsEvent(this.db, id); }

  // --- SETTINGS ---
  getSettingByKey(key: string): Promise<Setting | null> { return settings.getSettingByKey(this.db, key); }
  getSettings(): Promise<Record<string, string>> { return settings.getSettings(this.db); }
  setSetting(key: string, value: string): Promise<void> { return settings.setSetting(this.db, key, value); }
  deleteSetting(key: string): Promise<void> { return settings.deleteSetting(this.db, key); }

  // --- HELPERS — Cross-entity queries for cleanup ---
  getProductIdsByDomain(domainId: string): Promise<string[]> { return helpers.getProductIdsByDomain(this.db, domainId); }
  getProductIdsByCategory(categoryId: string): Promise<string[]> { return helpers.getProductIdsByCategory(this.db, categoryId); }
  getAssetsByProduct(productId: string): Promise<Asset[]> { return helpers.getAssetsByProduct(this.db, productId); }
}
