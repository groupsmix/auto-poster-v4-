// ============================================================
// Unit Tests — parseAIResponse (JSON extraction from AI output)
// ============================================================

import { describe, it, expect } from "vitest";

// parseAIResponse is not exported, so we replicate its logic here for testing.
// This tests the same algorithm used in apps/workers/nexus-workflow/src/engine.ts
function parseAIResponse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      return JSON.parse(jsonMatch[1].trim()) as Record<string, unknown>;
    }
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]) as Record<string, unknown>;
    }
    throw new Error("Failed to parse AI response as JSON");
  }
}

describe("parseAIResponse", () => {
  it("parses clean JSON directly", () => {
    const input = '{"title": "Test Product", "score": 85}';
    const result = parseAIResponse(input);
    expect(result).toEqual({ title: "Test Product", score: 85 });
  });

  it("extracts JSON from markdown code block with json tag", () => {
    const input = `Here is the result:
\`\`\`json
{"market_trends": ["trend1", "trend2"], "target_audience": "creators"}
\`\`\`
Hope this helps!`;
    const result = parseAIResponse(input);
    expect(result).toEqual({
      market_trends: ["trend1", "trend2"],
      target_audience: "creators",
    });
  });

  it("extracts JSON from markdown code block without json tag", () => {
    const input = `\`\`\`
{"name": "Widget", "price": 9.99}
\`\`\``;
    const result = parseAIResponse(input);
    expect(result).toEqual({ name: "Widget", price: 9.99 });
  });

  it("extracts JSON object embedded in prose", () => {
    const input = `Sure! Here is the output: {"description": "A great product", "keywords": ["seo", "marketing"]} — let me know if you need changes.`;
    const result = parseAIResponse(input);
    expect(result).toEqual({
      description: "A great product",
      keywords: ["seo", "marketing"],
    });
  });

  it("handles nested JSON objects", () => {
    const input = '{"product": {"name": "Test"}, "scores": {"seo": 90, "title": 85}}';
    const result = parseAIResponse(input);
    expect(result).toEqual({
      product: { name: "Test" },
      scores: { seo: 90, title: 85 },
    });
  });

  it("throws on completely non-JSON input", () => {
    expect(() => parseAIResponse("This is just plain text with no JSON")).toThrow(
      "Failed to parse AI response as JSON"
    );
  });

  it("throws on empty string", () => {
    expect(() => parseAIResponse("")).toThrow();
  });

  it("handles JSON with whitespace and newlines", () => {
    const input = `{
      "title": "My Product",
      "tags": [
        "handmade",
        "organic"
      ]
    }`;
    const result = parseAIResponse(input);
    expect(result.title).toBe("My Product");
    expect(result.tags).toEqual(["handmade", "organic"]);
  });

  it("prefers code block JSON over embedded JSON", () => {
    const input = `Here is {"wrong": true}
\`\`\`json
{"correct": true}
\`\`\``;
    const result = parseAIResponse(input);
    // Direct parse fails (not pure JSON), then code block match is tried first
    expect(result).toEqual({ correct: true });
  });
});
