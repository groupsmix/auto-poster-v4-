// ============================================================
// D1 Queries — SOCIAL CHANNELS
// ============================================================

import type { SocialChannel } from "@nexus/shared";
import { executeUpdate } from "./base";

export async function getSocialChannels(db: D1Database): Promise<SocialChannel[]> {
  const result = await db
    .prepare("SELECT id, name, slug, caption_max_chars, hashtag_count, tone, format, content_types, is_active FROM social_channels ORDER BY name ASC")
    .all<SocialChannel>();
  return result.results;
}

export async function getSocialChannelById(db: D1Database, id: string): Promise<SocialChannel | null> {
  return db
    .prepare("SELECT * FROM social_channels WHERE id = ?")
    .bind(id)
    .first<SocialChannel>();
}

export async function createSocialChannel(db: D1Database, channel: SocialChannel): Promise<SocialChannel> {
  await db
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

export async function updateSocialChannel(
  db: D1Database,
  id: string,
  data: Partial<Omit<SocialChannel, "id">>
): Promise<void> {
  await executeUpdate(db, "social_channels", id, data as Record<string, unknown>, [
    { column: "name" },
    { column: "slug" },
    { column: "caption_max_chars" },
    { column: "hashtag_count" },
    { column: "tone" },
    { column: "format" },
    { column: "content_types", transform: (v) => JSON.stringify(v) },
    { column: "is_active", transform: (v) => (v ? 1 : 0) },
  ]);
}

export async function deleteSocialChannel(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("DELETE FROM social_channels WHERE id = ?")
    .bind(id)
    .run();
}
