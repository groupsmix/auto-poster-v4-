// ============================================================
// D1 Query Helpers — Base utilities + generic update builder
// ============================================================

export interface FieldSpec {
  column: string;
  transform?: (value: unknown) => unknown;
}

/**
 * Build a parameterized UPDATE statement from a data object.
 * Only includes fields present in `allowedFields` and defined in `data`.
 * Automatically appends `updated_at` if the table has that column.
 */
export function buildUpdate(
  table: string,
  id: string,
  data: Record<string, unknown>,
  allowedFields: FieldSpec[],
  options?: { autoUpdatedAt?: boolean }
): { sql: string; values: unknown[] } | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const spec of allowedFields) {
    const value = data[spec.column];
    if (value !== undefined) {
      fields.push(`${spec.column} = ?`);
      values.push(spec.transform ? spec.transform(value) : value);
    }
  }

  if (options?.autoUpdatedAt) {
    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
  }

  if (fields.length === 0) return null;

  values.push(id);
  return {
    sql: `UPDATE ${table} SET ${fields.join(", ")} WHERE id = ?`,
    values,
  };
}

/**
 * Execute a parameterized UPDATE using the buildUpdate helper.
 */
export async function executeUpdate(
  db: D1Database,
  table: string,
  id: string,
  data: Record<string, unknown>,
  allowedFields: FieldSpec[],
  options?: { autoUpdatedAt?: boolean }
): Promise<void> {
  const update = buildUpdate(table, id, data, allowedFields, options);
  if (!update) return;
  await db.prepare(update.sql).bind(...update.values).run();
}
