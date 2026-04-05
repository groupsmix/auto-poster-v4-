// ============================================================
// Conflict Detection Service
// Prevents contradictory statements across niches
// ============================================================

export interface Conflict {
  type: 'contradiction' | 'similarity' | 'timing';
  severity: 'high' | 'medium' | 'low';
  existing_statement: {
    id: string;
    text: string;
    product_id: string;
    platform: string;
    published_at: string;
  };
  new_statement: string;
  explanation: string;
}

export class ConflictDetector {
  constructor(private db: D1Database) {}

  // Check for conflicts in the last 24 hours across all niches
  async checkConflicts(
    nicheId: string,
    newContent: string,
    platform: string
  ): Promise<Conflict[]> {
    const conflicts: Conflict[] = [];
    
    // Get recent statements from ALL niches (not just current)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { results: recentStatements } = await this.db.prepare(`
      SELECT * FROM content_statements 
      WHERE published_at > ? 
      ORDER BY published_at DESC
    `).bind(cutoff).all<{
      id: string;
      niche_id: string;
      product_id: string;
      statement_text: string;
      statement_hash: string;
      platform: string;
      published_at: string;
    }>();
    
    if (!recentStatements || recentStatements.length === 0) {
      return conflicts;
    }
    
    // Extract claims from new content
    const newClaims = this.extractClaims(newContent);
    
    for (const existing of recentStatements) {
      // Skip if same niche (we only check across niches)
      if (existing.niche_id === nicheId) continue;
      
      // Check for direct contradictions
      const contradiction = this.findContradiction(newClaims, existing.statement_text);
      if (contradiction) {
        conflicts.push({
          type: 'contradiction',
          severity: 'high',
          existing_statement: {
            id: existing.id,
            text: existing.statement_text,
            product_id: existing.product_id,
            platform: existing.platform,
            published_at: existing.published_at,
          },
          new_statement: newContent,
          explanation: contradiction,
        });
      }
      
      // Check for high similarity (potential duplicate)
      const similarity = this.calculateSimilarity(newContent, existing.statement_text);
      if (similarity > 0.8) {
        conflicts.push({
          type: 'similarity',
          severity: 'medium',
          existing_statement: {
            id: existing.id,
            text: existing.statement_text,
            product_id: existing.product_id,
            platform: existing.platform,
            published_at: existing.published_at,
          },
          new_statement: newContent,
          explanation: `Content is ${Math.round(similarity * 100)}% similar to existing statement`,
        });
      }
    }
    
    return conflicts;
  }

  // Store statements from published content for future conflict detection
  async storeStatements(
    nicheId: string,
    productId: string,
    content: string,
    platform: string
  ): Promise<void> {
    const claims = this.extractClaims(content);
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days
    
    for (const claim of claims) {
      const hash = await this.hashStatement(claim.text);
      
      await this.db.prepare(`
        INSERT INTO content_statements (
          id, niche_id, product_id, statement_hash, statement_text,
          category, sentiment, published_at, expires_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        nicheId,
        productId,
        hash,
        claim.text,
        claim.category,
        claim.sentiment,
        new Date().toISOString(),
        expiresAt,
        new Date().toISOString()
      ).run();
    }
  }

  // Extract claims/statements from content
  private extractClaims(content: string): Array<{
    text: string;
    category: string;
    sentiment: string;
  }> {
    const claims: Array<{ text: string; category: string; sentiment: string }> = [];
    
    // Split into sentences
    const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    
    for (const sentence of sentences) {
      // Categorize based on keywords
      let category = 'general';
      let sentiment = 'neutral';
      
      // Pricing claims
      if (/\$\d+|price|cost|cheap|expensive|free/i.test(sentence)) {
        category = 'pricing';
      }
      // Feature claims
      else if (/feature|includes|comes with|has|offers/i.test(sentence)) {
        category = 'feature';
      }
      // Opinion claims
      else if (/best|worst|better|worse|amazing|terrible/i.test(sentence)) {
        category = 'opinion';
        sentiment = /best|amazing|great|love/i.test(sentence) ? 'positive' : 'negative';
      }
      
      claims.push({
        text: sentence.slice(0, 500), // Limit length
        category,
        sentiment,
      });
    }
    
    return claims;
  }

  // Find contradictions between new claims and existing statement
  private findContradiction(newClaims: Array<{ text: string; category: string; sentiment: string }>, existingText: string): string | null {
    // Simple contradiction detection based on negation and sentiment flip
    
    // Check for direct negation
    const negationPatterns = [
      { positive: /is the best/i, negative: /is not the best|isn't the best/i },
      { positive: /recommend/i, negative: /don't recommend|do not recommend/i },
      { positive: /worth it/i, negative: /not worth it|isn't worth it/i },
      { positive: /easy to use/i, negative: /hard to use|difficult to use/i },
    ];
    
    for (const pattern of negationPatterns) {
      const existingPositive = pattern.positive.test(existingText);
      const existingNegative = pattern.negative.test(existingText);
      
      for (const claim of newClaims) {
        const newPositive = pattern.positive.test(claim.text);
        const newNegative = pattern.negative.test(claim.text);
        
        if ((existingPositive && newNegative) || (existingNegative && newPositive)) {
          return `Contradictory sentiment detected: "${existingText.slice(0, 100)}..." vs "${claim.text.slice(0, 100)}..."`;
        }
      }
    }
    
    // Check for price contradictions
    const priceRegex = /\$(\d+(?:\.\d{2})?)/g;
    const existingPrices = [...existingText.matchAll(priceRegex)].map(m => parseFloat(m[1]));
    
    for (const claim of newClaims) {
      if (claim.category === 'pricing') {
        const newPrices = [...claim.text.matchAll(priceRegex)].map(m => parseFloat(m[1]));
        
        for (const existingPrice of existingPrices) {
          for (const newPrice of newPrices) {
            // If prices differ by more than 10%, flag as potential contradiction
            if (Math.abs(existingPrice - newPrice) / existingPrice > 0.1) {
              return `Price contradiction: $${existingPrice} vs $${newPrice}`;
            }
          }
        }
      }
    }
    
    return null;
  }

  // Calculate similarity between two texts (Jaccard similarity)
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  // Hash a statement for deduplication
  private async hashStatement(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }

  // Clean up expired statements
  async cleanupExpired(): Promise<number> {
    const result = await this.db.prepare(`
      DELETE FROM content_statements WHERE expires_at < datetime('now')
    `).run();
    
    return result.meta?.changes ?? 0;
  }
}
