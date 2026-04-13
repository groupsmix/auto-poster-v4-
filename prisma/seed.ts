import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.opportunity.deleteMany();

  const rows = [
    {
      title: "AI Workflow Audit Toolkit",
      niche: "solo founders",
      channel: "digital product",
      summary: "Premium checklist, worksheet, and scorecard bundle for founders improving operations.",
      score: 92,
      demandScore: 88,
      authorityScore: 95,
      monetizationScore: 90,
      speedScore: 78,
      suggestedMode: "digital-product"
    },
    {
      title: "Authority Landing Site for Micro-Consulting",
      niche: "operations consultant",
      channel: "site",
      summary: "One-page authority site with lead magnet and offer stack for high-trust positioning.",
      score: 89,
      demandScore: 79,
      authorityScore: 97,
      monetizationScore: 84,
      speedScore: 82,
      suggestedMode: "site"
    },
    {
      title: "Printable Creator Planner Bundle",
      niche: "content creators",
      channel: "digital product",
      summary: "Planner pages, production tracker, and launch checklist bundle for creator operations.",
      score: 87,
      demandScore: 86,
      authorityScore: 83,
      monetizationScore: 88,
      speedScore: 81,
      suggestedMode: "digital-product"
    }
  ];

  for (const row of rows) {
    await prisma.opportunity.create({ data: row });
  }

  console.log("Seeded opportunities");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
