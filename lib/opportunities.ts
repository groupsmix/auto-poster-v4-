import { prisma } from "@/lib/prisma";
import { opportunityPrompt } from "@/lib/ai/prompts";
import { complete } from "@/lib/ai/provider";
import { clamp } from "@/lib/utils";

type OpportunitySeed = {
  title: string;
  niche: string;
  summary: string;
  score: number;
  suggestedMode: "digital-product" | "site";
};

export async function getOpportunities() {
  const existing = await prisma.opportunity.findMany({
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 12
  });

  if (existing.length > 0) return existing;

  const completion = await complete(opportunityPrompt());
  const parsed = safeParseOpportunities(completion.text);

  for (const item of parsed) {
    await prisma.opportunity.create({
      data: {
        title: item.title,
        niche: item.niche,
        channel: item.suggestedMode,
        summary: item.summary,
        score: clamp(item.score, 1, 100),
        demandScore: clamp(item.score - 3, 1, 100),
        authorityScore: clamp(item.score + 2, 1, 100),
        monetizationScore: clamp(item.score - 1, 1, 100),
        speedScore: clamp(item.score - 5, 1, 100),
        suggestedMode: item.suggestedMode
      }
    });
  }

  return prisma.opportunity.findMany({
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 12
  });
}

function safeParseOpportunities(value: string): OpportunitySeed[] {
  try {
    const parsed = JSON.parse(value) as OpportunitySeed[];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.title === "string" &&
        typeof item.niche === "string" &&
        typeof item.summary === "string" &&
        typeof item.score === "number" &&
        (item.suggestedMode === "digital-product" || item.suggestedMode === "site")
    );
  } catch {
    return [
      {
        title: "Premium Authority Toolkit",
        niche: "solo consultants",
        summary: "Focused digital pack that builds credibility and can be sold quickly.",
        score: 90,
        suggestedMode: "digital-product"
      },
      {
        title: "Offer-Driven Authority Site",
        niche: "micro agencies",
        summary: "Simple authority site with lead generation and trust-building sections.",
        score: 87,
        suggestedMode: "site"
      }
    ];
  }
}
