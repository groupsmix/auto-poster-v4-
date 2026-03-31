# NEXUS Prompt Template Guide

How prompts are structured, assembled, and used throughout the NEXUS workflow engine.

## Prompt Layer Architecture

NEXUS uses a **layered prompt assembly** system. Each AI call combines multiple prompt layers into a single final prompt. The layers are assembled in this order:

```
1. Master Prompt        (prompts/master.txt)
   ↓ Sets core identity, rules, and quality standards
2. Role Prompt          (prompts/roles/{role}.txt)
   ↓ Specializes the AI for a specific task type
3. Domain Prompt        (prompts/domains/{domain-slug}.txt)
   ↓ Adds domain-specific knowledge and context
4. Category Prompt      (prompts/categories/{category-slug}.txt)
   ↓ Narrows to the specific product category
5. Platform Prompt      (prompts/platforms/{platform-slug}.txt)
   ↓ Adapts output for the target marketplace
6. Social Prompt        (prompts/social/{channel-slug}.txt)
   ↓ Adapts output for social media channels
7. Context Prompt       (prompts/context.txt)
   ↓ Injects data from prior workflow steps
8. Step-Specific Prompt (built dynamically by each workflow step)
   ↓ The actual task instructions + JSON schema
```

Not every layer is used in every call. The workflow engine selects layers based on the current step and product configuration.

## Directory Structure

```
nexus/prompts/
├── master.txt              # Core identity and rules (always included)
├── context.txt             # Chain-of-thought template for prior step data
├── review.txt              # Quality review criteria
├── roles/                  # Task-type specializations
│   ├── researcher.txt      # Market research tasks
│   ├── copywriter.txt      # Content generation tasks
│   ├── seo.txt             # SEO optimization tasks
│   ├── designer.txt        # Image/design prompt tasks
│   ├── reviewer.txt        # Quality review tasks
│   └── coder.txt           # Code generation tasks
├── domains/                # Domain-specific knowledge
│   ├── digital-products.txt
│   ├── pod.txt
│   ├── ecommerce.txt
│   ├── freelance-services.txt
│   ├── content-media.txt
│   ├── affiliate-marketing.txt
│   ├── knowledge-education.txt
│   ├── specialized-tech.txt
│   ├── automation-nocode.txt
│   └── space-innovation.txt
├── categories/             # Category-specific prompts
│   ├── notion-templates.txt
│   ├── pdf-guides.txt
│   ├── t-shirts.txt
│   ├── wall-art-posters.txt
│   └── ... (17 category files)
├── platforms/              # Marketplace-specific rules
│   ├── etsy.txt
│   ├── gumroad.txt
│   ├── shopify.txt
│   ├── amazon-kdp.txt
│   └── redbubble.txt
└── social/                 # Social media channel rules
    ├── instagram.txt
    ├── pinterest.txt
    ├── tiktok.txt
    ├── x-twitter.txt
    └── linkedin.txt
```

## How to Write a New Prompt Template

### 1. Identify the Layer

Decide which layer your new prompt belongs to:
- **Role**: New type of AI task (e.g., `translator.txt`)
- **Domain**: New business domain (e.g., `health-wellness.txt`)
- **Category**: New product category (e.g., `ebook-covers.txt`)
- **Platform**: New marketplace (e.g., `creative-market.txt`)
- **Social**: New social channel (e.g., `youtube.txt`)

### 2. Follow the Existing Pattern

Each layer type has a consistent structure. Look at an existing file in the same directory for the pattern:

**Role prompts** (`roles/*.txt`):
- Start with the expert persona definition
- List specific skills and knowledge areas
- Define output quality standards
- Include do's and don'ts

**Domain prompts** (`domains/*.txt`):
- Describe the business domain
- List typical products and niches
- Include market-specific vocabulary
- Note common buyer personas

**Category prompts** (`categories/*.txt`):
- Define the product type precisely
- List key attributes buyers care about
- Include category-specific keywords
- Note competitive landscape

**Platform prompts** (`platforms/*.txt`):
- Platform algorithm rules and best practices
- Character limits and formatting rules
- SEO requirements specific to the platform
- Buyer behavior patterns on that platform

**Social prompts** (`social/*.txt`):
- Platform content rules and limits
- Hashtag strategies
- Engagement patterns
- Audience expectations

### 3. Use Template Variables

The workflow engine substitutes these variables at runtime:

| Variable | Description | Available In |
|----------|-------------|--------------|
| `{niche}` | The product niche/topic | All layers |
| `{domain_name}` | Business domain name | Domain, category |
| `{category_name}` | Product category name | Category |
| `{platform_name}` | Target marketplace | Platform |
| `{language}` | Target language code | All layers |
| `{step_1_research_output}` | Research step results | Context layer |
| `{step_2_strategy_output}` | Strategy step results | Context layer |
| `{cached_similar_products}` | Similar product data | Context layer |
| `{ceo_feedback}` | Revision feedback | Context layer |

### 4. Quality Checklist

Before adding a new prompt:

- [ ] Read `master.txt` to understand the core rules your prompt must respect
- [ ] Check that your prompt doesn't contradict any master rules
- [ ] Include specific, actionable instructions (not vague guidance)
- [ ] Test with a real product workflow to verify output quality
- [ ] Keep the prompt focused — one layer = one concern
- [ ] Avoid duplicating instructions already in `master.txt`
- [ ] Use concrete examples where possible

## How Prompt Layers Are Assembled

The workflow engine (`nexus-workflow`) builds the final prompt for each AI call:

```
finalPrompt = [
  masterPrompt,              // Always included
  rolePrompt,                // Based on step's task type
  domainPrompt,              // Based on product's domain
  categoryPrompt,            // Based on product's category (if exists)
  platformPrompt,            // Based on target platform (if applicable)
  socialPrompt,              // Based on social channel (if applicable)
  contextPrompt,             // Filled with prior step outputs
  stepSpecificInstructions,  // The actual task + JSON schema
].filter(Boolean).join("\n\n---\n\n");
```

The assembled prompt is then hashed (SHA-256) for AI response caching. Identical prompts return cached results from KV, saving AI costs.

## Testing a Prompt Change

1. **Edit the prompt file** in `nexus/prompts/`
2. **Run the validation script**: `npx tsx scripts/validate-prompts.ts`
   - Checks for missing template variables
   - Validates prompt length limits
   - Ensures required sections exist
3. **Deploy** the updated prompts (they are loaded from the filesystem at build time)
4. **Run a test workflow** through the dashboard to verify output quality
5. **Compare outputs** before and after the change

## Best Practices

- **Be specific, not generic.** "Write a title under 140 characters that includes the primary keyword" beats "Write a good title."
- **Include anti-patterns.** Tell the AI what NOT to do. See `master.txt` rule #7 for an example.
- **Use chain-of-thought.** The `context.txt` template forces step-by-step reasoning before output generation.
- **Platform rules are law.** Each platform has hard limits (character counts, tag limits). These must be exact — the AI can't "kind of" follow a 140-char limit.
- **Test with edge cases.** Try prompts with unusual niches, long inputs, and minimal context to find failure modes.
- **Keep prompts DRY.** If something applies to ALL tasks, put it in `master.txt`. Don't repeat it in every role file.
