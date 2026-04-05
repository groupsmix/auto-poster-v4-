// ============================================================
// Revenue Service — platform connections, revenue sync, dashboard
// Connect Etsy/Gumroad/Shopify stores, pull sales data,
// map back to NEXUS products, show revenue per domain/category
// ============================================================

import { generateId, now } from "@nexus/shared";
import type { RouterEnv } from "../helpers";
import { storageQuery } from "../helpers";

// --- Types ---

interface ConnectionCreateInput {
  platform: string;
  store_name?: string;
  auth_type?: string;
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  shop_domain?: string;
  metadata?: Record<string, unknown>;
}

interface ConnectionUpdateInput {
  store_name?: string;
  api_key?: string;
  api_secret?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  shop_domain?: string;
  is_active?: boolean;
  metadata?: Record<string, unknown>;
}

interface RevenueRecordInput {
  connection_id: string;
  platform: string;
  product_id?: string;
  external_order_id?: string;
  external_product_id?: string;
  external_product_title?: string;
  sku?: string;
  quantity?: number;
  revenue: number;
  currency?: string;
  fees?: number;
  net_revenue?: number;
  order_date: string;
  metadata?: Record<string, unknown>;
}

export interface ManualRevenueInput {
  product_id?: string;
  platform?: string;
  external_product_title?: string;
  quantity?: number;
  revenue: number;
  currency?: string;
  fees?: number;
  net_revenue?: number;
  order_date: string;
  notes?: string;
}

// --- Platform Connections CRUD ---

export async function listConnections(env: RouterEnv): Promise<unknown> {
  return storageQuery(
    env,
    `SELECT id, platform, store_name, auth_type, shop_domain, is_active,
            last_sync_at, sync_status, created_at, updated_at
     FROM platform_connections
     ORDER BY created_at DESC`
  );
}

export async function getConnection(id: string, env: RouterEnv): Promise<unknown> {
  return storageQuery(
    env,
    `SELECT id, platform, store_name, auth_type, shop_domain, is_active,
            last_sync_at, sync_status, metadata, created_at, updated_at
     FROM platform_connections WHERE id = ?`,
    [id]
  );
}

export async function createConnection(
  input: ConnectionCreateInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const id = generateId();
  const ts = now();

  await storageQuery(
    env,
    `INSERT INTO platform_connections (id, platform, store_name, auth_type, api_key, api_secret,
       access_token, refresh_token, token_expires_at, shop_domain, is_active, sync_status,
       metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'idle', ?, ?, ?)`,
    [
      id,
      input.platform,
      input.store_name ?? null,
      input.auth_type ?? "api_key",
      input.api_key ?? null,
      input.api_secret ?? null,
      input.access_token ?? null,
      input.refresh_token ?? null,
      input.token_expires_at ?? null,
      input.shop_domain ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      ts,
      ts,
    ]
  );

  return { id };
}

export async function updateConnection(
  id: string,
  input: ConnectionUpdateInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.store_name !== undefined) { setClauses.push("store_name = ?"); values.push(input.store_name); }
  if (input.api_key !== undefined) { setClauses.push("api_key = ?"); values.push(input.api_key); }
  if (input.api_secret !== undefined) { setClauses.push("api_secret = ?"); values.push(input.api_secret); }
  if (input.access_token !== undefined) { setClauses.push("access_token = ?"); values.push(input.access_token); }
  if (input.refresh_token !== undefined) { setClauses.push("refresh_token = ?"); values.push(input.refresh_token); }
  if (input.token_expires_at !== undefined) { setClauses.push("token_expires_at = ?"); values.push(input.token_expires_at); }
  if (input.shop_domain !== undefined) { setClauses.push("shop_domain = ?"); values.push(input.shop_domain); }
  if (input.is_active !== undefined) { setClauses.push("is_active = ?"); values.push(input.is_active ? 1 : 0); }
  if (input.metadata !== undefined) { setClauses.push("metadata = ?"); values.push(JSON.stringify(input.metadata)); }

  if (setClauses.length === 0) return { id };

  setClauses.push("updated_at = ?");
  values.push(now());
  values.push(id);

  await storageQuery(
    env,
    `UPDATE platform_connections SET ${setClauses.join(", ")} WHERE id = ?`,
    values
  );

  return { id };
}

export async function deleteConnection(id: string, env: RouterEnv): Promise<void> {
  await storageQuery(env, "DELETE FROM platform_connections WHERE id = ?", [id]);
}

// --- Revenue Records ---

export async function addRevenueRecord(
  input: RevenueRecordInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const id = generateId();
  const netRevenue = input.net_revenue ?? (input.revenue - (input.fees ?? 0));

  await storageQuery(
    env,
    `INSERT INTO revenue_records (id, connection_id, platform, product_id, external_order_id,
       external_product_id, external_product_title, sku, quantity, revenue, currency, fees,
       net_revenue, order_date, synced_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.connection_id,
      input.platform,
      input.product_id ?? null,
      input.external_order_id ?? null,
      input.external_product_id ?? null,
      input.external_product_title ?? null,
      input.sku ?? null,
      input.quantity ?? 1,
      input.revenue,
      input.currency ?? "USD",
      input.fees ?? 0,
      netRevenue,
      input.order_date,
      now(),
      input.metadata ? JSON.stringify(input.metadata) : null,
    ]
  );

  return { id };
}

export async function addRevenueRecords(
  records: RevenueRecordInput[],
  env: RouterEnv
): Promise<{ count: number }> {
  let count = 0;
  for (const record of records) {
    await addRevenueRecord(record, env);
    count++;
  }
  return { count };
}

// --- Manual Revenue Entry (no connection required) ---

export async function addManualRevenueRecord(
  input: ManualRevenueInput,
  env: RouterEnv
): Promise<{ id: string }> {
  const id = generateId();
  const netRevenue = input.net_revenue ?? (input.revenue - (input.fees ?? 0));

  await storageQuery(
    env,
    `INSERT INTO revenue_records (id, connection_id, platform, product_id, external_order_id,
       external_product_id, external_product_title, sku, quantity, revenue, currency, fees,
       net_revenue, order_date, synced_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      null, // no connection required
      input.platform ?? "manual",
      input.product_id ?? null,
      null,
      null,
      input.external_product_title ?? null,
      null,
      input.quantity ?? 1,
      input.revenue,
      input.currency ?? "USD",
      input.fees ?? 0,
      netRevenue,
      input.order_date,
      now(),
      input.notes ? JSON.stringify({ notes: input.notes }) : null,
    ]
  );

  return { id };
}

// --- Product Matching ---

export async function matchRevenueToProducts(
  connectionId: string,
  env: RouterEnv
): Promise<{ matched: number }> {
  // Match unmatched revenue records to NEXUS products by title or SKU
  const unmatched = (await storageQuery(
    env,
    `SELECT id, external_product_title, sku FROM revenue_records
     WHERE connection_id = ? AND product_id IS NULL`,
    [connectionId]
  )) as Array<{ id: string; external_product_title: string | null; sku: string | null }> |
    { results?: Array<{ id: string; external_product_title: string | null; sku: string | null }> };

  const rows = Array.isArray(unmatched) ? unmatched : (unmatched?.results ?? []);
  let matched = 0;

  for (const record of rows) {
    // Try matching by name (fuzzy: contains check)
    if (record.external_product_title) {
      const products = (await storageQuery(
        env,
        `SELECT id FROM products WHERE name LIKE ? LIMIT 1`,
        [`%${record.external_product_title}%`]
      )) as Array<{ id: string }> | { results?: Array<{ id: string }> };

      const productRows = Array.isArray(products) ? products : (products?.results ?? []);
      if (productRows.length > 0) {
        await storageQuery(
          env,
          "UPDATE revenue_records SET product_id = ? WHERE id = ?",
          [productRows[0].id, record.id]
        );
        matched++;
        continue;
      }
    }

    // Try matching by niche (broader match)
    if (record.external_product_title) {
      const products = (await storageQuery(
        env,
        `SELECT id FROM products WHERE niche LIKE ? LIMIT 1`,
        [`%${record.external_product_title}%`]
      )) as Array<{ id: string }> | { results?: Array<{ id: string }> };

      const productRows = Array.isArray(products) ? products : (products?.results ?? []);
      if (productRows.length > 0) {
        await storageQuery(
          env,
          "UPDATE revenue_records SET product_id = ? WHERE id = ?",
          [productRows[0].id, record.id]
        );
        matched++;
      }
    }
  }

  return { matched };
}

// --- Sync Status Management ---

export async function updateSyncStatus(
  connectionId: string,
  status: string,
  env: RouterEnv
): Promise<void> {
  await storageQuery(
    env,
    `UPDATE platform_connections SET sync_status = ?, last_sync_at = ?, updated_at = ?
     WHERE id = ?`,
    [status, now(), now(), connectionId]
  );
}

// --- Revenue Dashboard ---

export async function getRevenueDashboard(
  env: RouterEnv,
  options?: {
    start_date?: string;
    end_date?: string;
    platform?: string;
    domain_id?: string;
  }
): Promise<Record<string, unknown>> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.start_date) {
    conditions.push("rr.order_date >= ?");
    params.push(options.start_date);
  }
  if (options?.end_date) {
    conditions.push("rr.order_date <= ?");
    params.push(options.end_date);
  }
  if (options?.platform) {
    conditions.push("rr.platform = ?");
    params.push(options.platform);
  }
  if (options?.domain_id) {
    conditions.push("p.domain_id = ?");
    params.push(options.domain_id);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  // Total summary
  const totalResult = (await storageQuery(
    env,
    `SELECT
       COALESCE(SUM(rr.revenue), 0) as total_revenue,
       COUNT(DISTINCT rr.external_order_id) as total_orders,
       COALESCE(SUM(rr.quantity), 0) as total_products_sold
     FROM revenue_records rr
     LEFT JOIN products p ON p.id = rr.product_id
     ${whereClause}`,
    params
  )) as Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> };

  const totalRows = Array.isArray(totalResult) ? totalResult : (totalResult?.results ?? []);
  const totals = totalRows[0] ?? { total_revenue: 0, total_orders: 0, total_products_sold: 0 };

  // By platform
  const byPlatformResult = (await storageQuery(
    env,
    `SELECT
       rr.platform,
       COALESCE(SUM(rr.revenue), 0) as revenue,
       COUNT(DISTINCT rr.external_order_id) as orders,
       COUNT(DISTINCT rr.product_id) as products
     FROM revenue_records rr
     LEFT JOIN products p ON p.id = rr.product_id
     ${whereClause}
     GROUP BY rr.platform
     ORDER BY revenue DESC`,
    params
  )) as Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> };

  const byPlatform = Array.isArray(byPlatformResult) ? byPlatformResult : (byPlatformResult?.results ?? []);

  // By domain
  const byDomainResult = (await storageQuery(
    env,
    `SELECT
       p.domain_id,
       d.name as domain_name,
       COALESCE(SUM(rr.revenue), 0) as revenue,
       COUNT(DISTINCT rr.external_order_id) as orders,
       COUNT(DISTINCT rr.product_id) as products,
       CASE WHEN COUNT(DISTINCT rr.product_id) > 0
         THEN ROUND(COALESCE(SUM(rr.revenue), 0) / COUNT(DISTINCT rr.product_id), 2)
         ELSE 0 END as avg_per_product
     FROM revenue_records rr
     INNER JOIN products p ON p.id = rr.product_id
     LEFT JOIN domains d ON d.id = p.domain_id
     ${whereClause.replace("rr.order_date", "rr.order_date")}
     GROUP BY p.domain_id
     ORDER BY revenue DESC`,
    params
  )) as Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> };

  const byDomain = Array.isArray(byDomainResult) ? byDomainResult : (byDomainResult?.results ?? []);

  // By category
  const byCategoryResult = (await storageQuery(
    env,
    `SELECT
       p.category_id,
       c.name as category_name,
       p.domain_id,
       COALESCE(SUM(rr.revenue), 0) as revenue,
       COUNT(DISTINCT rr.external_order_id) as orders,
       COUNT(DISTINCT rr.product_id) as products,
       CASE WHEN COUNT(DISTINCT rr.product_id) > 0
         THEN ROUND(COALESCE(SUM(rr.revenue), 0) / COUNT(DISTINCT rr.product_id), 2)
         ELSE 0 END as avg_per_product
     FROM revenue_records rr
     INNER JOIN products p ON p.id = rr.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereClause.replace("rr.order_date", "rr.order_date")}
     GROUP BY p.category_id
     ORDER BY revenue DESC`,
    params
  )) as Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> };

  const byCategory = Array.isArray(byCategoryResult) ? byCategoryResult : (byCategoryResult?.results ?? []);

  // Top products
  const topProductsResult = (await storageQuery(
    env,
    `SELECT
       rr.product_id,
       p.name as product_name,
       rr.platform,
       COALESCE(SUM(rr.revenue), 0) as revenue,
       COUNT(DISTINCT rr.external_order_id) as orders
     FROM revenue_records rr
     INNER JOIN products p ON p.id = rr.product_id
     ${whereClause.replace("rr.order_date", "rr.order_date")}
     GROUP BY rr.product_id, rr.platform
     ORDER BY revenue DESC
     LIMIT 20`,
    params
  )) as Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> };

  const topProducts = Array.isArray(topProductsResult) ? topProductsResult : (topProductsResult?.results ?? []);

  // Daily trend (last 30 days)
  const dailyTrendResult = (await storageQuery(
    env,
    `SELECT
       DATE(rr.order_date) as date,
       COALESCE(SUM(rr.revenue), 0) as revenue,
       COUNT(DISTINCT rr.external_order_id) as orders
     FROM revenue_records rr
     LEFT JOIN products p ON p.id = rr.product_id
     ${whereClause}
     GROUP BY DATE(rr.order_date)
     ORDER BY date DESC
     LIMIT 30`,
    params
  )) as Array<Record<string, unknown>> | { results?: Array<Record<string, unknown>> };

  const dailyTrend = Array.isArray(dailyTrendResult) ? dailyTrendResult : (dailyTrendResult?.results ?? []);

  return {
    total_revenue: totals.total_revenue,
    total_orders: totals.total_orders,
    total_products_sold: totals.total_products_sold,
    by_platform: byPlatform,
    by_domain: byDomain,
    by_category: byCategory,
    top_products: topProducts,
    daily_trend: dailyTrend,
  };
}

// --- Revenue by Product ---

export async function getRevenueByProduct(
  productId: string,
  env: RouterEnv
): Promise<unknown> {
  return storageQuery(
    env,
    `SELECT
       rr.platform,
       COALESCE(SUM(rr.revenue), 0) as revenue,
       COALESCE(SUM(rr.fees), 0) as fees,
       COALESCE(SUM(rr.net_revenue), 0) as net_revenue,
       COUNT(*) as orders,
       COALESCE(SUM(rr.quantity), 0) as units_sold
     FROM revenue_records rr
     WHERE rr.product_id = ?
     GROUP BY rr.platform
     ORDER BY revenue DESC`,
    [productId]
  );
}
