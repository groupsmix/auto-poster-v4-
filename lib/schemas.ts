import { z } from "zod";

export const projectCreateSchema = z.object({
  title: z.string().min(2).max(140).optional(),
  mode: z.enum(["digital-product", "site", "auto"]),
  goal: z.enum(["sell", "authority", "freelance", "experiment"]),
  niche: z.string().min(2).max(120),
  audience: z.string().min(2).max(160),
  quality: z.enum(["balanced", "premium"]).default("premium"),
  sourceIdea: z.string().max(280).optional()
});

export const runSchema = z.object({
  rerun: z.boolean().optional().default(false)
});
