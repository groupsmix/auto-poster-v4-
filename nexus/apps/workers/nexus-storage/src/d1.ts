// ============================================================
// D1 Query Helpers — CRUD for every table + specialized helpers
// All queries use parameterized statements (no string interpolation)
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
import { generateId, now } from "@nexus/shared";

// --- Generic query executor ---

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

  // ============================================================
  // DOMAINS
  // ============================================================

  async getDomains(): Promise<Domain[]> {
    const result = await this.db
      .prepare("SELECT * FROM domains ORDER BY sort_order ASC")
      .all<Domain>();
    return result.results;
  }

  async getDomainById(id: string): Promise<Domain | null> {
    return this.db
      .prepare("SELECT * FROM domains WHERE id = ?")
      .bind(id)
      .first<Domain>();
  }

  async createDomain(domain: Omit<Domain, "created_at">): Promise<Domain> {
    const created_at = now();
    await this.db
      .prepare(
        "INSERT INTO domains (id, name, slug, description, icon, sort_order, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        domain.id,
        domain.name,
        domain.slug,
        domain.description ?? null,
        domain.icon ?? null,
        domain.sort_order,
        domain.is_active ? 1 : 0,
        created_at
      )
      .run();
    return { ...domain, created_at };
  }

  async updateDomain(
    id: string,
    data: Partial<Omit<Domain, "id" | "created_at">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.slug !== undefined) { fields.push("slug = ?"); values.push(data.slug); }
    if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
    if (data.icon !== undefined) { fields.push("icon = ?"); values.push(data.icon); }
    if (data.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(data.sort_order); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); values.push(data.is_active ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE domains SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteDomain(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM domains WHERE id = ?").bind(id).run();
  }

  // ============================================================
  // CATEGORIES
  // ============================================================

  async getCategories(domainId?: string): Promise<Category[]> {
    if (domainId) {
      const result = await this.db
        .prepare("SELECT * FROM categories WHERE domain_id = ? ORDER BY sort_order ASC")
        .bind(domainId)
        .all<Category>();
      return result.results;
    }
    const result = await this.db
      .prepare("SELECT * FROM categories ORDER BY sort_order ASC")
      .all<Category>();
    return result.results;
  }

  async getCategoryById(id: string): Promise<Category | null> {
    return this.db
      .prepare("SELECT * FROM categories WHERE id = ?")
      .bind(id)
      .first<Category>();
  }

  async createCategory(category: Category): Promise<Category> {
    await this.db
      .prepare(
        "INSERT INTO categories (id, domain_id, name, slug, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        category.id,
        category.domain_id,
        category.name,
        category.slug,
        category.description ?? null,
        category.sort_order,
        category.is_active ? 1 : 0
      )
      .run();
    return category;
  }

  async updateCategory(
    id: string,
    data: Partial<Omit<Category, "id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.domain_id !== undefined) { fields.push("domain_id = ?"); values.push(data.domain_id); }
    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.slug !== undefined) { fields.push("slug = ?"); values.push(data.slug); }
    if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
    if (data.sort_order !== undefined) { fields.push("sort_order = ?"); values.push(data.sort_order); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); values.push(data.is_active ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteCategory(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  }

  // ============================================================
  // PLATFORMS
  // ============================================================

  async getPlatforms(): Promise<Platform[]> {
    const result = await this.db
      .prepare("SELECT * FROM platforms ORDER BY name ASC")
      .all<Platform>();
    return result.results;
  }

  async getPlatformById(id: string): Promise<Platform | null> {
    return this.db
      .prepare("SELECT * FROM platforms WHERE id = ?")
      .bind(id)
      .first<Platform>();
  }

  async createPlatform(platform: Platform): Promise<Platform> {
    await this.db
      .prepare(
        "INSERT INTO platforms (id, name, slug, title_max_chars, tag_count, tag_max_chars, audience, tone, seo_style, description_style, cta_style, rules_json, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        platform.id,
        platform.name,
        platform.slug,
        platform.title_max_chars ?? null,
        platform.tag_count ?? null,
        platform.tag_max_chars ?? null,
        platform.audience ?? null,
        platform.tone ?? null,
        platform.seo_style ?? null,
        platform.description_style ?? null,
        platform.cta_style ?? null,
        platform.rules_json ? JSON.stringify(platform.rules_json) : null,
        platform.is_active ? 1 : 0
      )
      .run();
    return platform;
  }

  async updatePlatform(
    id: string,
    data: Partial<Omit<Platform, "id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.slug !== undefined) { fields.push("slug = ?"); values.push(data.slug); }
    if (data.title_max_chars !== undefined) { fields.push("title_max_chars = ?"); values.push(data.title_max_chars); }
    if (data.tag_count !== undefined) { fields.push("tag_count = ?"); values.push(data.tag_count); }
    if (data.tag_max_chars !== undefined) { fields.push("tag_max_chars = ?"); values.push(data.tag_max_chars); }
    if (data.audience !== undefined) { fields.push("audience = ?"); values.push(data.audience); }
    if (data.tone !== undefined) { fields.push("tone = ?"); values.push(data.tone); }
    if (data.seo_style !== undefined) { fields.push("seo_style = ?"); values.push(data.seo_style); }
    if (data.description_style !== undefined) { fields.push("description_style = ?"); values.push(data.description_style); }
    if (data.cta_style !== undefined) { fields.push("cta_style = ?"); values.push(data.cta_style); }
    if (data.rules_json !== undefined) { fields.push("rules_json = ?"); values.push(JSON.stringify(data.rules_json)); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); values.push(data.is_active ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE platforms SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deletePlatform(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM platforms WHERE id = ?").bind(id).run();
  }

  // ============================================================
  // SOCIAL CHANNELS
  // ============================================================

  async getSocialChannels(): Promise<SocialChannel[]> {
    const result = await this.db
      .prepare("SELECT * FROM social_channels ORDER BY name ASC")
      .all<SocialChannel>();
    return result.results;
  }

  async getSocialChannelById(id: string): Promise<SocialChannel | null> {
    return this.db
      .prepare("SELECT * FROM social_channels WHERE id = ?")
      .bind(id)
      .first<SocialChannel>();
  }

  async createSocialChannel(channel: SocialChannel): Promise<SocialChannel> {
    await this.db
      .prepare(
        "INSERT INTO social_channels (id, name, slug, caption_max_chars, hashtag_count, tone, format, content_types, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        channel.id,
        channel.name,
        channel.slug,
        channel.caption_max_chars ?? null,
        channel.hashtag_count ?? null,
        channel.tone ?? null,
        channel.format ?? null,
        channel.content_types ? JSON.stringify(channel.content_types) : null,
        channel.is_active ? 1 : 0
      )
      .run();
    return channel;
  }

  async updateSocialChannel(
    id: string,
    data: Partial<Omit<SocialChannel, "id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.slug !== undefined) { fields.push("slug = ?"); values.push(data.slug); }
    if (data.caption_max_chars !== undefined) { fields.push("caption_max_chars = ?"); values.push(data.caption_max_chars); }
    if (data.hashtag_count !== undefined) { fields.push("hashtag_count = ?"); values.push(data.hashtag_count); }
    if (data.tone !== undefined) { fields.push("tone = ?"); values.push(data.tone); }
    if (data.format !== undefined) { fields.push("format = ?"); values.push(data.format); }
    if (data.content_types !== undefined) { fields.push("content_types = ?"); values.push(JSON.stringify(data.content_types)); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); values.push(data.is_active ? 1 : 0); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE social_channels SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteSocialChannel(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM social_channels WHERE id = ?")
      .bind(id)
      .run();
  }

  // ============================================================
  // PRODUCTS
  // ============================================================

  async getProducts(): Promise<Product[]> {
    const result = await this.db
      .prepare("SELECT * FROM products ORDER BY created_at DESC")
      .all<Product>();
    return result.results;
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.db
      .prepare("SELECT * FROM products WHERE id = ?")
      .bind(id)
      .first<Product>();
  }

  async getProductsByDomain(domainId: string): Promise<Product[]> {
    const result = await this.db
      .prepare("SELECT * FROM products WHERE domain_id = ? ORDER BY created_at DESC")
      .bind(domainId)
      .all<Product>();
    return result.results;
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const result = await this.db
      .prepare("SELECT * FROM products WHERE category_id = ? ORDER BY created_at DESC")
      .bind(categoryId)
      .all<Product>();
    return result.results;
  }

  async getProductsByBatch(batchId: string): Promise<Product[]> {
    const result = await this.db
      .prepare("SELECT * FROM products WHERE batch_id = ? ORDER BY created_at ASC")
      .bind(batchId)
      .all<Product>();
    return result.results;
  }

  async createProduct(product: Omit<Product, "created_at" | "updated_at">): Promise<Product> {
    const created_at = now();
    await this.db
      .prepare(
        "INSERT INTO products (id, domain_id, category_id, name, niche, language, user_input, batch_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        product.id,
        product.domain_id,
        product.category_id,
        product.name ?? null,
        product.niche ?? null,
        product.language,
        product.user_input ? JSON.stringify(product.user_input) : null,
        product.batch_id ?? null,
        product.status,
        created_at
      )
      .run();
    return { ...product, created_at, updated_at: undefined };
  }

  async updateProduct(
    id: string,
    data: Partial<Omit<Product, "id" | "created_at">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.domain_id !== undefined) { fields.push("domain_id = ?"); values.push(data.domain_id); }
    if (data.category_id !== undefined) { fields.push("category_id = ?"); values.push(data.category_id); }
    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.niche !== undefined) { fields.push("niche = ?"); values.push(data.niche); }
    if (data.language !== undefined) { fields.push("language = ?"); values.push(data.language); }
    if (data.user_input !== undefined) { fields.push("user_input = ?"); values.push(JSON.stringify(data.user_input)); }
    if (data.batch_id !== undefined) { fields.push("batch_id = ?"); values.push(data.batch_id); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }

    fields.push("updated_at = ?");
    values.push(now());
    values.push(id);

    await this.db
      .prepare(`UPDATE products SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteProduct(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM products WHERE id = ?").bind(id).run();
  }

  // ============================================================
  // WORKFLOW RUNS
  // ============================================================

  async getWorkflowRuns(productId?: string): Promise<WorkflowRun[]> {
    if (productId) {
      const result = await this.db
        .prepare("SELECT * FROM workflow_runs WHERE product_id = ? ORDER BY started_at DESC")
        .bind(productId)
        .all<WorkflowRun>();
      return result.results;
    }
    const result = await this.db
      .prepare("SELECT * FROM workflow_runs ORDER BY started_at DESC")
      .all<WorkflowRun>();
    return result.results;
  }

  async getWorkflowRunById(id: string): Promise<WorkflowRun | null> {
    return this.db
      .prepare("SELECT * FROM workflow_runs WHERE id = ?")
      .bind(id)
      .first<WorkflowRun>();
  }

  async createWorkflowRun(run: Omit<WorkflowRun, "total_tokens" | "total_cost" | "cache_hits">): Promise<WorkflowRun> {
    await this.db
      .prepare(
        "INSERT INTO workflow_runs (id, product_id, batch_id, status, started_at, completed_at, current_step, total_steps, total_tokens, total_cost, cache_hits, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)"
      )
      .bind(
        run.id,
        run.product_id,
        run.batch_id ?? null,
        run.status,
        run.started_at ?? null,
        run.completed_at ?? null,
        run.current_step ?? null,
        run.total_steps ?? null,
        run.error ?? null
      )
      .run();
    return { ...run, total_tokens: 0, total_cost: 0, cache_hits: 0 };
  }

  async updateWorkflowRun(
    id: string,
    data: Partial<Omit<WorkflowRun, "id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.product_id !== undefined) { fields.push("product_id = ?"); values.push(data.product_id); }
    if (data.batch_id !== undefined) { fields.push("batch_id = ?"); values.push(data.batch_id); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.started_at !== undefined) { fields.push("started_at = ?"); values.push(data.started_at); }
    if (data.completed_at !== undefined) { fields.push("completed_at = ?"); values.push(data.completed_at); }
    if (data.current_step !== undefined) { fields.push("current_step = ?"); values.push(data.current_step); }
    if (data.total_steps !== undefined) { fields.push("total_steps = ?"); values.push(data.total_steps); }
    if (data.total_tokens !== undefined) { fields.push("total_tokens = ?"); values.push(data.total_tokens); }
    if (data.total_cost !== undefined) { fields.push("total_cost = ?"); values.push(data.total_cost); }
    if (data.cache_hits !== undefined) { fields.push("cache_hits = ?"); values.push(data.cache_hits); }
    if (data.error !== undefined) { fields.push("error = ?"); values.push(data.error); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE workflow_runs SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteWorkflowRun(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM workflow_runs WHERE id = ?")
      .bind(id)
      .run();
  }

  /** Helper: update workflow status shorthand */
  async updateWorkflowStatus(
    runId: string,
    status: WorkflowStatus
  ): Promise<void> {
    const completedStatuses: WorkflowStatus[] = [
      "completed",
      "failed",
      "approved",
      "rejected",
      "published",
      "cancelled",
    ];
    const completed_at = completedStatuses.includes(status) ? now() : null;

    if (completed_at) {
      await this.db
        .prepare("UPDATE workflow_runs SET status = ?, completed_at = ? WHERE id = ?")
        .bind(status, completed_at, runId)
        .run();
    } else {
      await this.db
        .prepare("UPDATE workflow_runs SET status = ? WHERE id = ?")
        .bind(status, runId)
        .run();
    }
  }

  /** Helper: get workflow run joined with its steps */
  async getWorkflowWithSteps(
    runId: string
  ): Promise<{ run: WorkflowRun; steps: WorkflowStep[] } | null> {
    const run = await this.getWorkflowRunById(runId);
    if (!run) return null;

    const stepsResult = await this.db
      .prepare("SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY step_order ASC")
      .bind(runId)
      .all<WorkflowStep>();

    return { run, steps: stepsResult.results };
  }

  // ============================================================
  // WORKFLOW STEPS
  // ============================================================

  async getWorkflowSteps(runId: string): Promise<WorkflowStep[]> {
    const result = await this.db
      .prepare("SELECT * FROM workflow_steps WHERE run_id = ? ORDER BY step_order ASC")
      .bind(runId)
      .all<WorkflowStep>();
    return result.results;
  }

  async getWorkflowStepById(id: string): Promise<WorkflowStep | null> {
    return this.db
      .prepare("SELECT * FROM workflow_steps WHERE id = ?")
      .bind(id)
      .first<WorkflowStep>();
  }

  async createWorkflowStep(step: WorkflowStep): Promise<WorkflowStep> {
    await this.db
      .prepare(
        "INSERT INTO workflow_steps (id, run_id, step_name, step_order, status, ai_used, ai_tried, input, output, tokens_used, cost, cached, latency_ms, started_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        step.id,
        step.run_id,
        step.step_name,
        step.step_order,
        step.status,
        step.ai_used ?? null,
        step.ai_tried ? JSON.stringify(step.ai_tried) : null,
        step.input ? JSON.stringify(step.input) : null,
        step.output ? JSON.stringify(step.output) : null,
        step.tokens_used ?? null,
        step.cost,
        step.cached ? 1 : 0,
        step.latency_ms ?? null,
        step.started_at ?? null,
        step.completed_at ?? null
      )
      .run();
    return step;
  }

  async updateWorkflowStep(
    id: string,
    data: Partial<Omit<WorkflowStep, "id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.run_id !== undefined) { fields.push("run_id = ?"); values.push(data.run_id); }
    if (data.step_name !== undefined) { fields.push("step_name = ?"); values.push(data.step_name); }
    if (data.step_order !== undefined) { fields.push("step_order = ?"); values.push(data.step_order); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.ai_used !== undefined) { fields.push("ai_used = ?"); values.push(data.ai_used); }
    if (data.ai_tried !== undefined) { fields.push("ai_tried = ?"); values.push(JSON.stringify(data.ai_tried)); }
    if (data.input !== undefined) { fields.push("input = ?"); values.push(JSON.stringify(data.input)); }
    if (data.output !== undefined) { fields.push("output = ?"); values.push(JSON.stringify(data.output)); }
    if (data.tokens_used !== undefined) { fields.push("tokens_used = ?"); values.push(data.tokens_used); }
    if (data.cost !== undefined) { fields.push("cost = ?"); values.push(data.cost); }
    if (data.cached !== undefined) { fields.push("cached = ?"); values.push(data.cached ? 1 : 0); }
    if (data.latency_ms !== undefined) { fields.push("latency_ms = ?"); values.push(data.latency_ms); }
    if (data.started_at !== undefined) { fields.push("started_at = ?"); values.push(data.started_at); }
    if (data.completed_at !== undefined) { fields.push("completed_at = ?"); values.push(data.completed_at); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE workflow_steps SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  /** Helper: update step status with optional output */
  async updateStepStatus(
    stepId: string,
    status: string,
    output?: Record<string, unknown>
  ): Promise<void> {
    if (output) {
      const completed_at = status === "completed" || status === "failed" ? now() : null;
      await this.db
        .prepare(
          "UPDATE workflow_steps SET status = ?, output = ?, completed_at = ? WHERE id = ?"
        )
        .bind(status, JSON.stringify(output), completed_at, stepId)
        .run();
    } else {
      await this.db
        .prepare("UPDATE workflow_steps SET status = ? WHERE id = ?")
        .bind(status, stepId)
        .run();
    }
  }

  async deleteWorkflowStep(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM workflow_steps WHERE id = ?")
      .bind(id)
      .run();
  }

  // ============================================================
  // ASSETS
  // ============================================================

  async getAssets(productId?: string): Promise<Asset[]> {
    if (productId) {
      const result = await this.db
        .prepare("SELECT * FROM assets WHERE product_id = ? ORDER BY created_at DESC")
        .bind(productId)
        .all<Asset>();
      return result.results;
    }
    const result = await this.db
      .prepare("SELECT * FROM assets ORDER BY created_at DESC")
      .all<Asset>();
    return result.results;
  }

  async getAssetById(id: string): Promise<Asset | null> {
    return this.db
      .prepare("SELECT * FROM assets WHERE id = ?")
      .bind(id)
      .first<Asset>();
  }

  async createAsset(asset: Omit<Asset, "created_at">): Promise<Asset> {
    const created_at = now();
    await this.db
      .prepare(
        "INSERT INTO assets (id, product_id, asset_type, r2_key, cf_image_id, url, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        asset.id,
        asset.product_id,
        asset.asset_type,
        asset.r2_key,
        asset.cf_image_id ?? null,
        asset.url,
        asset.metadata ? JSON.stringify(asset.metadata) : null,
        created_at
      )
      .run();
    return { ...asset, created_at };
  }

  async updateAsset(
    id: string,
    data: Partial<Omit<Asset, "id" | "created_at">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.product_id !== undefined) { fields.push("product_id = ?"); values.push(data.product_id); }
    if (data.asset_type !== undefined) { fields.push("asset_type = ?"); values.push(data.asset_type); }
    if (data.r2_key !== undefined) { fields.push("r2_key = ?"); values.push(data.r2_key); }
    if (data.cf_image_id !== undefined) { fields.push("cf_image_id = ?"); values.push(data.cf_image_id); }
    if (data.url !== undefined) { fields.push("url = ?"); values.push(data.url); }
    if (data.metadata !== undefined) { fields.push("metadata = ?"); values.push(JSON.stringify(data.metadata)); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE assets SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteAsset(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM assets WHERE id = ?").bind(id).run();
  }

  // ============================================================
  // PLATFORM VARIANTS
  // ============================================================

  async getPlatformVariants(productId?: string): Promise<PlatformVariant[]> {
    if (productId) {
      const result = await this.db
        .prepare("SELECT * FROM platform_variants WHERE product_id = ?")
        .bind(productId)
        .all<PlatformVariant>();
      return result.results;
    }
    const result = await this.db
      .prepare("SELECT * FROM platform_variants")
      .all<PlatformVariant>();
    return result.results;
  }

  async getPlatformVariantById(id: string): Promise<PlatformVariant | null> {
    return this.db
      .prepare("SELECT * FROM platform_variants WHERE id = ?")
      .bind(id)
      .first<PlatformVariant>();
  }

  async createPlatformVariant(variant: PlatformVariant): Promise<PlatformVariant> {
    await this.db
      .prepare(
        "INSERT INTO platform_variants (id, product_id, platform_id, title, description, tags, price, metadata, status, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        variant.id,
        variant.product_id,
        variant.platform_id,
        variant.title,
        variant.description,
        variant.tags ? JSON.stringify(variant.tags) : null,
        variant.price ?? null,
        variant.metadata ? JSON.stringify(variant.metadata) : null,
        variant.status,
        variant.published_at ?? null
      )
      .run();
    return variant;
  }

  async updatePlatformVariant(
    id: string,
    data: Partial<Omit<PlatformVariant, "id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.product_id !== undefined) { fields.push("product_id = ?"); values.push(data.product_id); }
    if (data.platform_id !== undefined) { fields.push("platform_id = ?"); values.push(data.platform_id); }
    if (data.title !== undefined) { fields.push("title = ?"); values.push(data.title); }
    if (data.description !== undefined) { fields.push("description = ?"); values.push(data.description); }
    if (data.tags !== undefined) { fields.push("tags = ?"); values.push(JSON.stringify(data.tags)); }
    if (data.price !== undefined) { fields.push("price = ?"); values.push(data.price); }
    if (data.metadata !== undefined) { fields.push("metadata = ?"); values.push(JSON.stringify(data.metadata)); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.published_at !== undefined) { fields.push("published_at = ?"); values.push(data.published_at); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE platform_variants SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deletePlatformVariant(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM platform_variants WHERE id = ?")
      .bind(id)
      .run();
  }

  // ============================================================
  // SOCIAL VARIANTS
  // ============================================================

  async getSocialVariants(productId?: string): Promise<SocialVariant[]> {
    if (productId) {
      const result = await this.db
        .prepare("SELECT * FROM social_variants WHERE product_id = ?")
        .bind(productId)
        .all<SocialVariant>();
      return result.results;
    }
    const result = await this.db
      .prepare("SELECT * FROM social_variants")
      .all<SocialVariant>();
    return result.results;
  }

  async getSocialVariantById(id: string): Promise<SocialVariant | null> {
    return this.db
      .prepare("SELECT * FROM social_variants WHERE id = ?")
      .bind(id)
      .first<SocialVariant>();
  }

  async createSocialVariant(variant: SocialVariant): Promise<SocialVariant> {
    await this.db
      .prepare(
        "INSERT INTO social_variants (id, product_id, channel_id, content, status, scheduled_at, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        variant.id,
        variant.product_id,
        variant.channel_id,
        JSON.stringify(variant.content),
        variant.status,
        variant.scheduled_at ?? null,
        variant.published_at ?? null
      )
      .run();
    return variant;
  }

  async updateSocialVariant(
    id: string,
    data: Partial<Omit<SocialVariant, "id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.product_id !== undefined) { fields.push("product_id = ?"); values.push(data.product_id); }
    if (data.channel_id !== undefined) { fields.push("channel_id = ?"); values.push(data.channel_id); }
    if (data.content !== undefined) { fields.push("content = ?"); values.push(JSON.stringify(data.content)); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.scheduled_at !== undefined) { fields.push("scheduled_at = ?"); values.push(data.scheduled_at); }
    if (data.published_at !== undefined) { fields.push("published_at = ?"); values.push(data.published_at); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE social_variants SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteSocialVariant(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM social_variants WHERE id = ?")
      .bind(id)
      .run();
  }

  // ============================================================
  // REVIEWS
  // ============================================================

  async getReviews(productId?: string): Promise<Review[]> {
    if (productId) {
      const result = await this.db
        .prepare("SELECT * FROM reviews WHERE product_id = ? ORDER BY reviewed_at DESC")
        .bind(productId)
        .all<Review>();
      return result.results;
    }
    const result = await this.db
      .prepare("SELECT * FROM reviews ORDER BY reviewed_at DESC")
      .all<Review>();
    return result.results;
  }

  async getReviewById(id: string): Promise<Review | null> {
    return this.db
      .prepare("SELECT * FROM reviews WHERE id = ?")
      .bind(id)
      .first<Review>();
  }

  async createReview(review: Omit<Review, "reviewed_at">): Promise<Review> {
    const reviewed_at = now();
    await this.db
      .prepare(
        "INSERT INTO reviews (id, product_id, run_id, version, ai_score, ai_model, decision, feedback, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        review.id,
        review.product_id,
        review.run_id,
        review.version,
        review.ai_score ?? null,
        review.ai_model ?? null,
        review.decision,
        review.feedback ?? null,
        reviewed_at
      )
      .run();
    return { ...review, reviewed_at };
  }

  async updateReview(
    id: string,
    data: Partial<Omit<Review, "id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.product_id !== undefined) { fields.push("product_id = ?"); values.push(data.product_id); }
    if (data.run_id !== undefined) { fields.push("run_id = ?"); values.push(data.run_id); }
    if (data.version !== undefined) { fields.push("version = ?"); values.push(data.version); }
    if (data.ai_score !== undefined) { fields.push("ai_score = ?"); values.push(data.ai_score); }
    if (data.ai_model !== undefined) { fields.push("ai_model = ?"); values.push(data.ai_model); }
    if (data.decision !== undefined) { fields.push("decision = ?"); values.push(data.decision); }
    if (data.feedback !== undefined) { fields.push("feedback = ?"); values.push(data.feedback); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE reviews SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteReview(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM reviews WHERE id = ?").bind(id).run();
  }

  // ============================================================
  // REVISION HISTORY
  // ============================================================

  async getRevisionHistory(productId: string): Promise<RevisionHistory[]> {
    const result = await this.db
      .prepare(
        "SELECT * FROM revision_history WHERE product_id = ? ORDER BY version ASC"
      )
      .bind(productId)
      .all<RevisionHistory>();
    return result.results;
  }

  async getRevisionById(id: string): Promise<RevisionHistory | null> {
    return this.db
      .prepare("SELECT * FROM revision_history WHERE id = ?")
      .bind(id)
      .first<RevisionHistory>();
  }

  async createRevision(revision: RevisionHistory): Promise<RevisionHistory> {
    await this.db
      .prepare(
        "INSERT INTO revision_history (id, product_id, version, output, feedback, ai_score, ai_model, reviewed_at, decision) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        revision.id,
        revision.product_id,
        revision.version,
        JSON.stringify(revision.output),
        revision.feedback ?? null,
        revision.ai_score ?? null,
        revision.ai_model ?? null,
        revision.reviewed_at ?? null,
        revision.decision
      )
      .run();
    return revision;
  }

  async deleteRevision(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM revision_history WHERE id = ?")
      .bind(id)
      .run();
  }

  // ============================================================
  // PROMPT TEMPLATES
  // ============================================================

  async getPromptTemplates(layer?: string): Promise<PromptTemplate[]> {
    if (layer) {
      const result = await this.db
        .prepare("SELECT * FROM prompt_templates WHERE layer = ? AND is_active = 1 ORDER BY name ASC")
        .bind(layer)
        .all<PromptTemplate>();
      return result.results;
    }
    const result = await this.db
      .prepare("SELECT * FROM prompt_templates WHERE is_active = 1 ORDER BY layer, name ASC")
      .all<PromptTemplate>();
    return result.results;
  }

  async getPromptTemplateById(id: string): Promise<PromptTemplate | null> {
    return this.db
      .prepare("SELECT * FROM prompt_templates WHERE id = ?")
      .bind(id)
      .first<PromptTemplate>();
  }

  async createPromptTemplate(
    template: Omit<PromptTemplate, "updated_at">
  ): Promise<PromptTemplate> {
    const updated_at = now();
    await this.db
      .prepare(
        "INSERT INTO prompt_templates (id, layer, target_id, name, prompt, version, is_active, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        template.id,
        template.layer,
        template.target_id ?? null,
        template.name,
        template.prompt,
        template.version,
        template.is_active ? 1 : 0,
        updated_at
      )
      .run();
    return { ...template, updated_at };
  }

  async updatePromptTemplate(
    id: string,
    data: Partial<Omit<PromptTemplate, "id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.layer !== undefined) { fields.push("layer = ?"); values.push(data.layer); }
    if (data.target_id !== undefined) { fields.push("target_id = ?"); values.push(data.target_id); }
    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.prompt !== undefined) { fields.push("prompt = ?"); values.push(data.prompt); }
    if (data.version !== undefined) { fields.push("version = ?"); values.push(data.version); }
    if (data.is_active !== undefined) { fields.push("is_active = ?"); values.push(data.is_active ? 1 : 0); }

    fields.push("updated_at = ?");
    values.push(now());
    values.push(id);

    await this.db
      .prepare(`UPDATE prompt_templates SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deletePromptTemplate(id: string): Promise<void> {
    await this.db
      .prepare("DELETE FROM prompt_templates WHERE id = ?")
      .bind(id)
      .run();
  }

  // ============================================================
  // AI MODELS
  // ============================================================

  async getAIModels(): Promise<AIModel[]> {
    const result = await this.db
      .prepare("SELECT * FROM ai_models ORDER BY task_type, rank ASC")
      .all<AIModel>();
    return result.results;
  }

  async getAIModelById(id: string): Promise<AIModel | null> {
    return this.db
      .prepare("SELECT * FROM ai_models WHERE id = ?")
      .bind(id)
      .first<AIModel>();
  }

  /** Helper: get AI models for a specific task type, ordered by rank */
  async getAIModelsByTaskType(taskType: string): Promise<AIModel[]> {
    const result = await this.db
      .prepare(
        "SELECT * FROM ai_models WHERE task_type = ? AND status = 'active' ORDER BY rank ASC"
      )
      .bind(taskType)
      .all<AIModel>();
    return result.results;
  }

  async createAIModel(model: AIModel): Promise<AIModel> {
    await this.db
      .prepare(
        "INSERT INTO ai_models (id, name, provider, task_type, rank, api_key_secret_name, is_workers_ai, status, rate_limit_reset_at, daily_limit_reset_at, is_free_tier, health_score, total_calls, total_failures, avg_latency_ms, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        model.id,
        model.name,
        model.provider ?? null,
        model.task_type,
        model.rank,
        model.api_key_secret_name ?? null,
        model.is_workers_ai ? 1 : 0,
        model.status,
        model.rate_limit_reset_at ?? null,
        model.daily_limit_reset_at ?? null,
        model.is_free_tier ? 1 : 0,
        model.health_score,
        model.total_calls,
        model.total_failures,
        model.avg_latency_ms,
        model.notes ?? null
      )
      .run();
    return model;
  }

  async updateAIModel(
    id: string,
    data: Partial<Omit<AIModel, "id">>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push("name = ?"); values.push(data.name); }
    if (data.provider !== undefined) { fields.push("provider = ?"); values.push(data.provider); }
    if (data.task_type !== undefined) { fields.push("task_type = ?"); values.push(data.task_type); }
    if (data.rank !== undefined) { fields.push("rank = ?"); values.push(data.rank); }
    if (data.api_key_secret_name !== undefined) { fields.push("api_key_secret_name = ?"); values.push(data.api_key_secret_name); }
    if (data.is_workers_ai !== undefined) { fields.push("is_workers_ai = ?"); values.push(data.is_workers_ai ? 1 : 0); }
    if (data.status !== undefined) { fields.push("status = ?"); values.push(data.status); }
    if (data.rate_limit_reset_at !== undefined) { fields.push("rate_limit_reset_at = ?"); values.push(data.rate_limit_reset_at); }
    if (data.daily_limit_reset_at !== undefined) { fields.push("daily_limit_reset_at = ?"); values.push(data.daily_limit_reset_at); }
    if (data.is_free_tier !== undefined) { fields.push("is_free_tier = ?"); values.push(data.is_free_tier ? 1 : 0); }
    if (data.health_score !== undefined) { fields.push("health_score = ?"); values.push(data.health_score); }
    if (data.total_calls !== undefined) { fields.push("total_calls = ?"); values.push(data.total_calls); }
    if (data.total_failures !== undefined) { fields.push("total_failures = ?"); values.push(data.total_failures); }
    if (data.avg_latency_ms !== undefined) { fields.push("avg_latency_ms = ?"); values.push(data.avg_latency_ms); }
    if (data.notes !== undefined) { fields.push("notes = ?"); values.push(data.notes); }

    if (fields.length === 0) return;
    values.push(id);

    await this.db
      .prepare(`UPDATE ai_models SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  async deleteAIModel(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM ai_models WHERE id = ?").bind(id).run();
  }

  // ============================================================
  // ANALYTICS
  // ============================================================

  async getAnalytics(limit = 100): Promise<AnalyticsEvent[]> {
    const result = await this.db
      .prepare("SELECT * FROM analytics ORDER BY created_at DESC LIMIT ?")
      .bind(limit)
      .all<AnalyticsEvent>();
    return result.results;
  }

  async getAnalyticsByType(eventType: string, limit = 100): Promise<AnalyticsEvent[]> {
    const result = await this.db
      .prepare("SELECT * FROM analytics WHERE event_type = ? ORDER BY created_at DESC LIMIT ?")
      .bind(eventType, limit)
      .all<AnalyticsEvent>();
    return result.results;
  }

  /** Helper: record an analytics event */
  async recordAnalyticsEvent(
    event: Omit<AnalyticsEvent, "id" | "created_at">
  ): Promise<AnalyticsEvent> {
    const id = generateId();
    const created_at = now();
    await this.db
      .prepare(
        "INSERT INTO analytics (id, event_type, product_id, run_id, ai_model, tokens_used, cost, latency_ms, cached, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        id,
        event.event_type,
        event.product_id ?? null,
        event.run_id ?? null,
        event.ai_model ?? null,
        event.tokens_used ?? null,
        event.cost,
        event.latency_ms ?? null,
        event.cached ? 1 : 0,
        event.metadata ? JSON.stringify(event.metadata) : null,
        created_at
      )
      .run();
    return { ...event, id, created_at };
  }

  async deleteAnalyticsEvent(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM analytics WHERE id = ?").bind(id).run();
  }

  // ============================================================
  // SETTINGS
  // ============================================================

  async getSettingByKey(key: string): Promise<Setting | null> {
    return this.db
      .prepare("SELECT * FROM settings WHERE key = ?")
      .bind(key)
      .first<Setting>();
  }

  /** Helper: get all settings as key-value object */
  async getSettings(): Promise<Record<string, string>> {
    const result = await this.db
      .prepare("SELECT * FROM settings")
      .all<Setting>();

    const settings: Record<string, string> = {};
    for (const row of result.results) {
      settings[row.key] = row.value;
    }
    return settings;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?"
      )
      .bind(key, value, now(), value, now())
      .run();
  }

  async deleteSetting(key: string): Promise<void> {
    await this.db.prepare("DELETE FROM settings WHERE key = ?").bind(key).run();
  }

  // ============================================================
  // HELPERS — Cross-entity queries for cleanup
  // ============================================================

  /** Get all product IDs for a domain (for cascading deletion) */
  async getProductIdsByDomain(domainId: string): Promise<string[]> {
    const result = await this.db
      .prepare("SELECT id FROM products WHERE domain_id = ?")
      .bind(domainId)
      .all<{ id: string }>();
    return result.results.map((r) => r.id);
  }

  /** Get all product IDs for a category (for cascading deletion) */
  async getProductIdsByCategory(categoryId: string): Promise<string[]> {
    const result = await this.db
      .prepare("SELECT id FROM products WHERE category_id = ?")
      .bind(categoryId)
      .all<{ id: string }>();
    return result.results.map((r) => r.id);
  }

  /** Get all assets for a product (for cleanup — need R2 keys + CF Image IDs) */
  async getAssetsByProduct(productId: string): Promise<Asset[]> {
    const result = await this.db
      .prepare("SELECT * FROM assets WHERE product_id = ?")
      .bind(productId)
      .all<Asset>();
    return result.results;
  }
}
