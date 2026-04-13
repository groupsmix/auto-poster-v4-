import OpenAI from "openai";

export type ProviderPrompt = {
  system: string;
  user: string;
  temperature?: number;
};

export type ProviderResponse = {
  text: string;
  provider: "openai" | "fallback";
};

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  });
}

export async function complete(prompt: ProviderPrompt): Promise<ProviderResponse> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!client) {
    return {
      provider: "fallback",
      text: buildFallback(prompt)
    };
  }

  const response = await client.responses.create({
    model,
    temperature: prompt.temperature ?? 0.8,
    input: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user }
    ]
  });

  const text = response.output_text?.trim() || buildFallback(prompt);

  return {
    provider: "openai",
    text
  };
}

function buildFallback(prompt: ProviderPrompt): string {
  const seed = `${prompt.system}\n${prompt.user}`.toLowerCase();

  if (seed.includes("opportunity")) {
    return JSON.stringify(
      [
        {
          title: "Operational Playbook Starter Kit",
          niche: "consultants",
          summary: "Template bundle for selling premium process clarity with fast delivery.",
          score: 91,
          suggestedMode: "digital-product"
        },
        {
          title: "Authority Funnel Site",
          niche: "niche service founders",
          summary: "Single-offer site with lead magnet and trust-building sections.",
          score: 88,
          suggestedMode: "site"
        }
      ],
      null,
      2
    );
  }

  if (seed.includes("brief")) {
    return [
      "# Product Brief",
      "",
      "## Positioning",
      "Premium practical asset focused on reducing effort and creating a ready-to-sell result.",
      "",
      "## Promise",
      "Give the audience a structured outcome they can implement quickly.",
      "",
      "## Core Sections",
      "- Fast start",
      "- Main framework",
      "- Execution worksheets",
      "- Delivery checklist",
      "",
      "## Monetization",
      "Sell as a focused premium starter product with authority-building upside."
    ].join("\n");
  }

  if (seed.includes("site plan")) {
    return [
      "# Site Blueprint",
      "",
      "## Sections",
      "1. Hero",
      "2. Problem",
      "3. Offer",
      "4. Proof / differentiators",
      "5. CTA",
      "",
      "## Copy Direction",
      "Direct, premium, trustworthy, outcome-focused.",
      "",
      "## CTA",
      "Get the asset / book the service / start now."
    ].join("\n");
  }

  if (seed.includes("sales assets")) {
    return [
      "# Sales Assets",
      "",
      "## Title Options",
      "- The Premium Starter Pack",
      "- Fast-Track Operator Bundle",
      "",
      "## Bullets",
      "- Ready-to-use",
      "- Structured for speed",
      "- Built to look premium",
      "",
      "## Pricing",
      "$29-$79 depending on depth and visual quality."
    ].join("\n");
  }

  return [
    "# Generated Output",
    "",
    "This artifact was created by the fallback generator. Add an OpenAI-compatible key to upgrade generation quality."
  ].join("\n");
}
