// ============================================================
// D1 Queries — REVIEWS & REVISION HISTORY
// ============================================================

import type { Review, RevisionHistory } from "@nexus/shared";
import { now } from "@nexus/shared";
import { executeUpdate } from "./base";

// --- REVIEWS ---

export async function getReviews(db: D1Database, productId?: string): Promise<Review[]> {
  if (productId) {
    const result = await db
      .prepare("SELECT * FROM reviews WHERE product_id = ? ORDER BY reviewed_at DESC")
      .bind(productId)
      .all<Review>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT * FROM reviews ORDER BY reviewed_at DESC")
    .all<Review>();
  return result.results;
}

export async function getReviewById(db: D1Database, id: string): Promise<Review | null> {
  return db
    .prepare("SELECT * FROM reviews WHERE id = ?")
    .bind(id)
    .first<Review>();
}

export async function createReview(db: D1Database, review: Omit<Review, "reviewed_at">): Promise<Review> {
  const reviewed_at = now();
  await db
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

export async function updateReview(
  db: D1Database,
  id: string,
  data: Partial<Omit<Review, "id">>
): Promise<void> {
  await executeUpdate(db, "reviews", id, data as Record<string, unknown>, [
    { column: "product_id" },
    { column: "run_id" },
    { column: "version" },
    { column: "ai_score" },
    { column: "ai_model" },
    { column: "decision" },
    { column: "feedback" },
  ]);
}

export async function deleteReview(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM reviews WHERE id = ?").bind(id).run();
}

// --- REVISION HISTORY ---

export async function getRevisionHistory(db: D1Database, productId: string): Promise<RevisionHistory[]> {
  const result = await db
    .prepare(
      "SELECT * FROM revision_history WHERE product_id = ? ORDER BY version ASC"
    )
    .bind(productId)
    .all<RevisionHistory>();
  return result.results;
}

export async function getRevisionById(db: D1Database, id: string): Promise<RevisionHistory | null> {
  return db
    .prepare("SELECT * FROM revision_history WHERE id = ?")
    .bind(id)
    .first<RevisionHistory>();
}

export async function createRevision(db: D1Database, revision: RevisionHistory): Promise<RevisionHistory> {
  await db
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

export async function deleteRevision(db: D1Database, id: string): Promise<void> {
  await db
    .prepare("DELETE FROM revision_history WHERE id = ?")
    .bind(id)
    .run();
}
