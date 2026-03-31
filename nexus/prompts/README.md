# NEXUS Prompt Template Guide

How prompt layers are assembled, how to write new templates, and best practices.

---

## Directory Structure

```
prompts/
  master.txt          # Core NEXUS system prompt (10 rules, persona, anti-patterns)
  context.txt         # Chain-of-thought context assembly (research, strategy, feedback)
  review.txt          # CEO Review scoring rubric (7 criteria, approval logic)
  domains/            # Domain-specific knowledge (digital-products, pod, ecommerce, ...)
  roles/              # Role personas (copywriter, designer, seo, researcher, coder, reviewer)
  categories/         # Category-specific rules (notion-templates, pdf-guides, t-shirts, ...)
  platforms/          # Platform adaptation (etsy, gumroad, shopify, amazon-kdp, redbubble)
  social/             # Social channel content (instagram, linkedin, pinterest, tiktok, x-twitter)
```

---

## How Prompt Layers Are Assembled

Every AI call builds a final prompt by stacking layers. The order matters:

```
1. master.txt         — Always included. Sets persona, core rules, anti-patterns.
2. context.txt        — Injects prior step outputs (research, strategy, revision feedback).
3. roles/{role}.txt   — Sets the expert persona for this step (copywriter, seo, etc.).
4. domains/{dom}.txt  — Adds domain-specific knowledge (digital-products, pod, etc.).
5. categories/{cat}.txt — Adds category-specific rules (notion-templates, mugs, etc.).
6. platforms/{plat}.txt — Adapts output for the target platform (etsy, gumroad, etc.).
7. social/{channel}.txt — Adapts output for social promotion (instagram, tiktok, etc.).
```

Not every layer is used every time. The workflow step determines which layers apply:

| Workflow Step     | Layers Used                                        |
|-------------------|----------------------------------------------------|
| Research          | master + context + role(researcher) + domain        |
| Content Writing   | master + context + role(copywriter) + domain + category |
| SEO Optimization  | master + context + role(seo) + domain + platform    |
| Platform Variants | master + context + role(copywriter) + platform      |
| Social Content    | master + context + role(copywriter) + social        |
| CEO Review        | review.txt (standalone, includes its own rubric)    |
| Design Brief      | master + context + role(designer) + domain          |

---

## How to Write a New Prompt Template

### 1. Pick the right directory

- **Domain** — broad business vertical (e.g., `freelance-services.txt`)
- **Category** — specific product type within a domain (e.g., `resume-cv-templates.txt`)
- **Platform** — marketplace where products are sold (e.g., `etsy.txt`)
- **Social** — social channel for promotion (e.g., `tiktok.txt`)
- **Role** — expert persona for a workflow step (e.g., `seo.txt`)

### 2. Follow the existing pattern

Every template follows this structure:

```
[Identity / context line]
   "You are a top-selling Etsy shop owner who has..."
   "Category: Notion Templates"
   "Your role: Elite Direct Response Copywriter who has..."

[Key facts / rules]
   Bullet list of domain-specific knowledge, limits, and constraints.

[Think-before-you-write section]
   "=== BEFORE YOU WRITE, THINK THROUGH THIS ==="
   Numbered questions the AI must consider before generating output.

[Anti-patterns]
   "=== ANTI-PATTERNS (NEVER DO) ==="
   Explicit list of what NOT to do.

[Good vs Bad examples]
   "=== EXAMPLE OF GOOD VS BAD ==="
   Concrete examples showing the quality bar.

[Template variables]
   {base_product_json}, {output_schema}, {product_json}, etc.
   These are replaced at runtime with actual data.
```

### 3. Template variables

Variables use `{curly_brace}` syntax and are injected at runtime:

| Variable                  | Where Used      | Contains                              |
|---------------------------|-----------------|---------------------------------------|
| `{base_product_json}`     | platforms/      | The base product data to adapt        |
| `{output_schema}`         | platforms/      | JSON schema the output must match     |
| `{product_json}`          | social/         | Product data for social content       |
| `{product_output_json}`   | review.txt      | Full product package to review        |
| `{step_1_research_output}`| context.txt     | Research step output                  |
| `{step_2_strategy_output}`| context.txt     | Strategy step output                  |
| `{cached_similar_products}`| context.txt    | Similar products from cache           |
| `{ceo_feedback}`          | context.txt     | Revision feedback from CEO review     |

### 4. Naming convention

- Use lowercase kebab-case: `notion-templates.txt`, `x-twitter.txt`
- Match the slug used in the domain/category/platform database records
- Always use `.txt` extension

---

## Best Practices

1. **Be specific, not generic.** Include real numbers, price ranges, character limits, and concrete examples. Vague instructions produce vague output.

2. **Include anti-patterns.** Explicitly list what the AI should NOT do. This is more effective than only describing what it should do.

3. **Show, don't tell.** Always include Good vs Bad examples. The AI learns more from one concrete example than from five paragraphs of instructions.

4. **Front-load the identity line.** The first sentence sets the persona and expertise level. Make it specific: "$500K+ revenue" not "experienced seller."

5. **Include platform-specific hard limits.** Character counts, tag limits, and formatting rules must be exact numbers, not approximations.

6. **Keep templates focused.** Each file should cover ONE domain/category/platform/role. Don't combine multiple concerns in a single template.

7. **Use the chain-of-thought pattern.** The "BEFORE YOU WRITE, THINK THROUGH THIS" section forces the AI to reason before generating, which dramatically improves output quality.

8. **Never put secrets or API keys in templates.** Templates are committed to the repo. Use environment variables for any sensitive values.

---

## Testing a Prompt Change

1. **Find the workflow step** that uses your template layer (see table above).

2. **Run the integration tests** to verify the router still serves the endpoint:
   ```bash
   cd nexus && npx vitest run tests/integration/
   ```

3. **Test end-to-end** by triggering a product workflow through the dashboard:
   - Create a test product in a test domain
   - Start the workflow and let it run through the step that uses your template
   - Review the AI output in the CEO Review screen
   - Check that the output follows your template's rules and avoids its anti-patterns

4. **Compare before/after** by running the same product through the workflow with the old and new template. Look for:
   - Did the quality score improve in CEO Review?
   - Does the output avoid the anti-patterns you listed?
   - Are platform-specific limits respected (character counts, tag counts)?
   - Does the output sound human, not AI-generated?

---

## Adding a New Domain, Category, or Platform

1. Create the `.txt` file in the correct directory
2. Follow the template structure described above
3. Add the corresponding record in the dashboard (Domains, Categories, or Platforms screen)
4. The system automatically picks up new templates by matching the slug in the filename to the database record
5. Run integration tests to verify nothing broke
