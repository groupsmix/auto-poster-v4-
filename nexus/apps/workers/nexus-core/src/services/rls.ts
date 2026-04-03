// ============================================================
// RLS (Row Level Security) Middleware
// Enforces niche isolation at the application layer
// Every query without niche_id = REJECTED
// ============================================================

import type { Context, Next } from "hono";
import type { CoreEnv } from "../index";

// Parse allowed niches from API key configuration
// In production, this would be stored in KV or D1
const API_KEY_NICHES: Record<string, string[]> = {
  // Format: 'api-key-value': ['niche-id-1', 'niche-id-2']
  // Default: all niches allowed
};

// Routes that don't require niche filtering (global)
const GLOBAL_ROUTES = [
  '/api/niches', // Listing niches is global
  '/api/health',
  '/api/nuke',
];

// Routes that are exempt from RLS (but still need auth)
const RLS_EXEMPT_ROUTES: string[] = [];

export async function RLSMiddleware(c: Context<{ Bindings: CoreEnv; Variables: { requestId: string; nicheId?: string; apiKey?: string } }>, next: Next): Promise<void | Response> {
  const requestId = c.get('requestId');
  const path = c.req.path;
  
  // Skip RLS for global routes
  if (GLOBAL_ROUTES.some(route => path.startsWith(route))) {
    await next();
    return;
  }
  
  // Skip RLS for exempt routes
  if (RLS_EXEMPT_ROUTES.some(route => path.startsWith(route))) {
    await next();
    return;
  }
  
  // Get niche_id from header or query param
  const nicheId = c.req.header('X-Niche-ID') || c.req.query('niche_id');
  
  if (!nicheId) {
    console.log(`[${requestId}] RLS REJECTED: Missing niche_id`);
    return c.json({ 
      success: false, 
      error: 'niche_id required. Provide via X-Niche-ID header or niche_id query param.' 
    }, 403);
  }
  
  // Validate niche_id format
  if (!isValidNicheId(nicheId)) {
    console.log(`[${requestId}] RLS REJECTED: Invalid niche_id format: ${nicheId}`);
    return c.json({ 
      success: false, 
      error: 'Invalid niche_id format' 
    }, 400);
  }
  
  // Check if API key has access to this niche
  const apiKey = c.get('apiKey');
  if (apiKey && !hasNicheAccess(apiKey, nicheId)) {
    console.log(`[${requestId}] RLS REJECTED: API key does not have access to niche: ${nicheId}`);
    return c.json({ 
      success: false, 
      error: 'Access denied for this niche' 
    }, 403);
  }
  
  // Store niche_id in context for route handlers
  c.set('nicheId', nicheId);
  
  // Add niche_id to response header for debugging
  c.header('X-Niche-ID-Applied', nicheId);
  
  await next();
}

// Validate niche_id format (UUID or slug)
function isValidNicheId(nicheId: string): boolean {
  // Allow UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Allow slugs (lowercase, alphanumeric, hyphens)
  const slugRegex = /^[a-z0-9-]+$/;
  
  return uuidRegex.test(nicheId) || slugRegex.test(nicheId);
}

// Check if API key has access to a specific niche
function hasNicheAccess(apiKey: string, nicheId: string): boolean {
  // If no specific niches configured for this key, allow all
  const allowedNiches = API_KEY_NICHES[apiKey];
  if (!allowedNiches || allowedNiches.length === 0) {
    return true;
  }
  
  return allowedNiches.includes(nicheId);
}

// Helper to add niche_id to SQL queries
export function addNicheFilter(sql: string, nicheId: string, tableAlias?: string): string {
  const prefix = tableAlias ? `${tableAlias}.` : '';
  
  // Check if query already has WHERE clause
  if (sql.includes('WHERE')) {
    return sql.replace(/WHERE/i, `WHERE ${prefix}niche_id = ? AND`);
  }
  
  // Check if query has ORDER BY, LIMIT, etc.
  const clauseOrder = ['ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET'];
  for (const clause of clauseOrder) {
    if (sql.includes(clause)) {
      return sql.replace(new RegExp(clause, 'i'), `WHERE ${prefix}niche_id = ? ${clause}`);
    }
  }
  
  // No clauses found, append WHERE
  return `${sql} WHERE ${prefix}niche_id = ?`;
}

// Helper to validate niche_id is present in request body
export function requireNicheId(body: Record<string, unknown>): string | null {
  const nicheId = body.niche_id;
  if (!nicheId || typeof nicheId !== 'string') {
    return null;
  }
  return nicheId;
}

// D1 query wrapper that enforces niche_id
export async function queryWithRLS<T>(
  db: D1Database,
  sql: string,
  params: unknown[],
  nicheId: string
): Promise<D1Result<T>> {
  // Ensure niche_id is in the query
  const filteredSql = addNicheFilter(sql, nicheId);
  
  // Add niche_id as first param
  const filteredParams = [nicheId, ...params];
  
  return db.prepare(filteredSql).bind(...filteredParams).all<T>();
}
