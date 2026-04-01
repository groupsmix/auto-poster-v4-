// ============================================================
// Etsy Taxonomy Mapper
// Maps NEXUS domain/category slugs to Etsy taxonomy IDs
// for accurate category placement and better SEO ranking.
//
// Etsy taxonomy IDs sourced from Etsy Open API v3:
// GET /v3/application/seller-taxonomy/nodes
// https://developers.etsy.com/documentation/reference#operation/getSellerTaxonomyNodes
//
// Setting taxonomy_id = 0 forces Etsy to guess the category,
// which hurts search ranking. This mapper eliminates that.
// ============================================================

// ── Etsy Taxonomy ID Constants ──────────────────────────────
// These are real Etsy seller taxonomy node IDs.
// Top-level categories and their most relevant sub-categories
// for the product types NEXUS generates.

/**
 * Mapping from NEXUS category slugs (or partial matches) to Etsy taxonomy IDs.
 * When multiple NEXUS categories map to the same Etsy taxonomy, we pick
 * the most specific (deepest) node for best SEO.
 */
const CATEGORY_TO_TAXONOMY: Record<string, number> = {
  // ── Digital Products domain ──────────────────────────────
  // Etsy: Craft Supplies & Tools > Templates
  "notion-templates": 6648,
  "saas-templates": 6648,
  "spreadsheet-templates": 6648,

  // Etsy: Books, Movies & Music > Books > Blank Books > Journals & Notebooks (digital)
  "planners-calendars": 1227,
  "planners-&-calendars": 1227,
  "checklists-trackers": 1227,
  "checklists-&-trackers": 1227,

  // Etsy: Craft Supplies & Tools > Tutorials & Patterns
  "pdf-guides-ebooks": 7127,
  "pdf-guides-&-ebooks": 7127,
  "courses-e-learning-modules": 7127,
  "courses-&-e-learning-modules": 7127,

  // Etsy: Craft Supplies & Tools > Tools > AI & Digital Tools
  "prompt-libraries": 6648,
  "ai-tool-kits": 6648,

  // Etsy: Books, Movies & Music > Books > Picture Books
  "storybooks-kids-books": 1199,
  "storybooks-&-kids-books": 1199,

  // ── Print on Demand domain ───────────────────────────────
  // Etsy: Clothing > Shirts & Tees
  "t-shirts-apparel": 482,
  "t-shirts-&-apparel": 482,

  // Etsy: Home & Living > Kitchen & Dining > Drinkware > Mugs
  "mugs-drinkware": 1643,
  "mugs-&-drinkware": 1643,

  // Etsy: Art & Collectibles > Prints
  "posters-wall-art": 248,
  "posters-&-wall-art": 248,

  // Etsy: Accessories > Phone Cases
  "phone-cases": 394,

  // Etsy: Bags & Purses > Tote Bags
  "tote-bags": 409,

  // Etsy: Craft Supplies & Tools > Stickers, Labels & Tags > Stickers
  "stickers-decals": 6993,
  "stickers-&-decals": 6993,

  // Etsy: Clothing > Hoodies & Sweatshirts
  "hoodies-sweatshirts": 491,
  "hoodies-&-sweatshirts": 491,

  // Etsy: Home & Living > Home Decor
  "home-decor": 891,

  // Etsy: Books, Movies & Music > Books > Blank Books > Notebooks
  "notebooks-journals": 1217,
  "notebooks-&-journals": 1217,

  // Etsy: Accessories > Hats & Caps
  "hats-accessories": 358,
  "hats-&-accessories": 358,

  // ── Content & Media domain ────────────────────────────────
  "video-making-scripts-shorts-youtube": 7127,
  "video-making-(scripts,-shorts,-youtube)": 7127,
  "music-making-loops-intros-sonic-logos": 7127,
  "music-making-(loops,-intros,-sonic-logos)": 7127,
  "podcast-content-episodes-show-notes": 7127,
  "podcast-content-(episodes,-show-notes)": 7127,
  "animation-scripts": 7127,

  // ── Knowledge & Education domain ──────────────────────────
  "online-course-creation": 7127,
  "workshop-materials": 7127,
  "study-guides": 7127,
  "training-manuals": 7127,
  "coaching-plans-fitness-finance": 7127,
  "coaching-plans-(fitness,-finance)": 7127,
};

/**
 * Fallback mapping from NEXUS domain slugs to Etsy taxonomy IDs.
 * Used when no specific category match is found.
 */
const DOMAIN_TO_TAXONOMY: Record<string, number> = {
  "digital-products": 6648,      // Craft Supplies & Tools > Templates
  "print-on-demand": 482,        // Clothing (most common POD)
  "content-media": 7127,         // Tutorials & Patterns
  "content-&-media": 7127,
  "freelance-services": 6648,    // Templates (closest fit)
  "affiliate-marketing": 7127,   // Tutorials
  "e-commerce-retail": 6648,     // Templates
  "e-commerce-&-retail": 6648,
  "knowledge-education": 7127,   // Tutorials & Patterns
  "knowledge-&-education": 7127,
  "specialized-technology": 6648, // Templates
  "automation-no-code": 6648,    // Templates
  "automation-&-no-code": 6648,
  "space-innovation": 248,       // Art & Collectibles > Prints
  "space-&-innovation": 248,
};

/**
 * Resolve the best Etsy taxonomy ID for a product based on its
 * NEXUS domain and category information.
 *
 * Resolution order:
 * 1. Exact category slug match
 * 2. Fuzzy category name match (normalized to slug)
 * 3. Domain slug fallback
 * 4. Returns 0 only as absolute last resort (lets Etsy guess)
 */
export function resolveEtsyTaxonomyId(
  domainSlug?: string,
  categorySlug?: string,
  categoryName?: string,
  domainName?: string
): number {
  // 1. Try exact category slug match
  if (categorySlug) {
    const normalizedSlug = categorySlug.toLowerCase().trim();
    if (CATEGORY_TO_TAXONOMY[normalizedSlug]) {
      return CATEGORY_TO_TAXONOMY[normalizedSlug];
    }
  }

  // 2. Try normalizing category name to a slug and matching
  if (categoryName) {
    const nameAsSlug = categoryName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (CATEGORY_TO_TAXONOMY[nameAsSlug]) {
      return CATEGORY_TO_TAXONOMY[nameAsSlug];
    }

    // Try partial matching: check if any key is contained in the slug
    for (const [key, id] of Object.entries(CATEGORY_TO_TAXONOMY)) {
      if (nameAsSlug.includes(key) || key.includes(nameAsSlug)) {
        return id;
      }
    }
  }

  // 3. Try domain slug fallback
  if (domainSlug) {
    const normalizedDomain = domainSlug.toLowerCase().trim();
    if (DOMAIN_TO_TAXONOMY[normalizedDomain]) {
      return DOMAIN_TO_TAXONOMY[normalizedDomain];
    }
  }

  // 4. Try normalizing domain name
  if (domainName) {
    const domainAsSlug = domainName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    if (DOMAIN_TO_TAXONOMY[domainAsSlug]) {
      return DOMAIN_TO_TAXONOMY[domainAsSlug];
    }
  }

  // 5. Absolute fallback — Etsy will auto-detect (not ideal but safe)
  return 0;
}
