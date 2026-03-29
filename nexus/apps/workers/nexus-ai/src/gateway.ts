// V4: AI Gateway Integration
// Routes all external AI calls through Cloudflare AI Gateway
// Full implementation in Task 3

export async function callAIviaGateway(
  _model: unknown,
  _apiKey: string,
  _prompt: string,
  _env: unknown
): Promise<{ text: string; tokens?: number }> {
  // Placeholder
  return { text: "", tokens: 0 };
}
