// ============================================================
// D1 Queries — SETTINGS
// ============================================================

import type { Setting } from "@nexus/shared";
import { now } from "@nexus/shared";

export async function getSettingByKey(db: D1Database, key: string): Promise<Setting | null> {
  return db
    .prepare("SELECT * FROM settings WHERE key = ?")
    .bind(key)
    .first<Setting>();
}

/** Helper: get all settings as key-value object */
export async function getSettings(db: D1Database): Promise<Record<string, string>> {
  const result = await db
    .prepare("SELECT key, value, updated_at FROM settings")
    .all<Setting>();

  const settings: Record<string, string> = {};
  for (const row of result.results) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?"
    )
    .bind(key, value, now(), value, now())
    .run();
}

export async function deleteSetting(db: D1Database, key: string): Promise<void> {
  await db.prepare("DELETE FROM settings WHERE key = ?").bind(key).run();
}
