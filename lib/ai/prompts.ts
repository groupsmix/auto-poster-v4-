import { Project } from "@prisma/client";

export function opportunityPrompt() {
  return {
    system:
      "You are a product strategist for a solo operator. Return JSON array only. Rank opportunities for sellability, authority value, and production speed.",
    user:
      "Generate 6 opportunity ideas across digital products and simple sites for a solo operator building authority and revenue."
  };
}

export function briefPrompt(project: Project) {
  return {
    system:
      "You are an expert product strategist. Create a concise implementation-ready brief in markdown.",
    user: `Create a premium build brief for a ${project.mode} project.
Title: ${project.title}
Goal: ${project.goal}
Niche: ${project.niche}
Audience: ${project.audience}
Quality: ${project.quality}

The brief must include positioning, promise, sections, deliverables, visual direction, monetization, and review checklist.`
  };
}

export function productPrompt(project: Project, brief: string) {
  return {
    system:
      "You create high-utility digital product content in markdown. Be structured and premium, not fluffy.",
    user: `Using this brief, create the full digital product package in markdown.
Project: ${project.title}
Audience: ${project.audience}
Goal: ${project.goal}

Brief:
${brief}

Include:
- final title
- subtitle
- product overview
- section-by-section content
- implementation checklist
- packaging notes`
  };
}

export function sitePrompt(project: Project, brief: string) {
  return {
    system:
      "You are a conversion-focused site strategist and copywriter. Produce both strategy and HTML-ready content.",
    user: `Create a one-page site blueprint and page copy for this project.
Project: ${project.title}
Audience: ${project.audience}
Goal: ${project.goal}

Brief:
${brief}

Include:
- section plan
- headline options
- subhead
- section copy
- CTA copy
- meta title and description`
  };
}

export function brandPrompt(project: Project, brief: string) {
  return {
    system:
      "You are a visual strategist for digital products and landing pages. Return markdown.",
    user: `Create visual direction for the project "${project.title}".
Use the brief below.

${brief}

Include:
- color direction
- typography direction
- cover/hero concept
- thumbnail concepts
- mockup prompts
- icon/illustration guidance`
  };
}

export function salesPrompt(project: Project, brief: string) {
  return {
    system:
      "You create concise sales assets for digital products and simple sites. Return markdown.",
    user: `Create sales assets for "${project.title}".
Goal: ${project.goal}
Mode: ${project.mode}

Brief:
${brief}

Include:
- 5 title options
- 3 subtitle options
- 8 benefit bullets
- product description
- CTA options
- pricing suggestion
- tags/keywords
- launch checklist`
  };
}
