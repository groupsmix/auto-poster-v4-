#!/usr/bin/env npx tsx
// ============================================================
// Prompt Template Validation Script
//
// Validates all prompt template files in the prompts/ directory:
//  - File exists and is readable
//  - Content is non-empty after trimming
//  - No obvious placeholder text left behind
//  - Minimum content length (avoids stub files)
//  - No duplicate prompt IDs
//  - All expected layers have at least one prompt
//  - Template variables ({{var}}) are well-formed
//
// Usage:
//   npx tsx scripts/validate-prompts.ts
//   npx tsx scripts/validate-prompts.ts --strict   # fail on warnings too
//
// Exit codes:
//   0 = all valid
//   1 = validation errors found
// ============================================================

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PROMPTS_DIR = path.resolve(__dirname, "../prompts");

const LAYER_DIRS: Record<string, string> = {
  roles: "role",
  domains: "domain",
  categories: "category",
  platforms: "platform",
  social: "social",
};

const STANDALONE_FILES: Record<string, string> = {
  "master.txt": "master",
  "review.txt": "review",
  "context.txt": "context",
};

/** Minimum prompt content length (chars) to avoid stubs */
const MIN_PROMPT_LENGTH = 50;

/** Maximum prompt content length (chars) — very large prompts waste tokens */
const MAX_PROMPT_LENGTH = 50000;

/** Patterns that suggest placeholder/incomplete content */
const PLACEHOLDER_PATTERNS = [
  /TODO/i,
  /FIXME/i,
  /PLACEHOLDER/i,
  /INSERT .* HERE/i,
  /\[YOUR .* HERE\]/i,
  /XXX/,
  /CHANGEME/i,
];

/** Valid template variable pattern: {{variable_name}} */
const TEMPLATE_VAR_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/** Malformed template variable patterns */
const MALFORMED_VAR_PATTERNS = [
  /\{\{[^}]*\n/,           // Unclosed {{ spanning lines
  /\{[a-zA-Z_]\w*\}(?!\})/,  // Single-brace variable {var}
  /\{\{\s*\}\}/,            // Empty {{}}
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationResult {
  file: string;
  layer: string;
  errors: string[];
  warnings: string[];
  stats: {
    length: number;
    lines: number;
    templateVars: string[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(layer: string, name: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${layer}:${name}`)
    .digest("hex")
    .slice(0, 12);
  return `prompt_${layer}_${hash}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validatePromptFile(filePath: string, layer: string): ValidationResult {
  const relativePath = path.relative(PROMPTS_DIR, filePath);
  const result: ValidationResult = {
    file: relativePath,
    layer,
    errors: [],
    warnings: [],
    stats: { length: 0, lines: 0, templateVars: [] },
  };

  // Check file exists
  if (!fs.existsSync(filePath)) {
    result.errors.push("File does not exist");
    return result;
  }

  // Check file is readable
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    result.errors.push(`Cannot read file: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const trimmed = content.trim();
  result.stats.length = trimmed.length;
  result.stats.lines = trimmed.split("\n").length;

  // Check non-empty
  if (trimmed.length === 0) {
    result.errors.push("Prompt file is empty");
    return result;
  }

  // Check minimum length
  if (trimmed.length < MIN_PROMPT_LENGTH) {
    result.warnings.push(
      `Prompt is very short (${trimmed.length} chars, min recommended: ${MIN_PROMPT_LENGTH})`
    );
  }

  // Check maximum length
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    result.warnings.push(
      `Prompt is very long (${trimmed.length} chars, max recommended: ${MAX_PROMPT_LENGTH}). Consider splitting.`
    );
  }

  // Check for placeholder patterns
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      result.warnings.push(
        `Contains placeholder text: "${match[0]}" — may be incomplete`
      );
    }
  }

  // Validate template variables
  const validVars: string[] = [];
  let varMatch: RegExpExecArray | null;
  const varPattern = new RegExp(TEMPLATE_VAR_PATTERN.source, "g");
  while ((varMatch = varPattern.exec(trimmed)) !== null) {
    validVars.push(varMatch[1]);
  }
  result.stats.templateVars = validVars;

  // Check for malformed template variables
  for (const pattern of MALFORMED_VAR_PATTERNS) {
    if (pattern.test(trimmed)) {
      result.warnings.push(
        `Possible malformed template variable detected (pattern: ${pattern.source})`
      );
    }
  }

  // Check for unbalanced braces (simple heuristic)
  const openCount = (trimmed.match(/\{\{/g) || []).length;
  const closeCount = (trimmed.match(/\}\}/g) || []).length;
  if (openCount !== closeCount) {
    result.errors.push(
      `Unbalanced template braces: ${openCount} opening '{{' vs ${closeCount} closing '}}'`
    );
  }

  return result;
}

function validateAllPrompts(): {
  results: ValidationResult[];
  idSet: Map<string, string>;
} {
  const results: ValidationResult[] = [];
  const idSet = new Map<string, string>(); // id -> file path

  // Validate standalone files
  for (const [fileName, layer] of Object.entries(STANDALONE_FILES)) {
    const filePath = path.join(PROMPTS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      const result = validatePromptFile(filePath, layer);
      results.push(result);

      const id = generateId(layer, layer);
      if (idSet.has(id)) {
        result.errors.push(`Duplicate ID "${id}" — also used by ${idSet.get(id)}`);
      } else {
        idSet.set(id, result.file);
      }
    } else {
      results.push({
        file: fileName,
        layer,
        errors: [],
        warnings: [`Expected file "${fileName}" not found — layer "${layer}" has no prompt`],
        stats: { length: 0, lines: 0, templateVars: [] },
      });
    }
  }

  // Validate directory-based prompts
  for (const [dir, layer] of Object.entries(LAYER_DIRS)) {
    const dirPath = path.join(PROMPTS_DIR, dir);
    if (!fs.existsSync(dirPath)) {
      results.push({
        file: `${dir}/`,
        layer,
        errors: [],
        warnings: [`Directory "${dir}/" not found — no "${layer}" layer prompts`],
        stats: { length: 0, lines: 0, templateVars: [] },
      });
      continue;
    }

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".txt"));
    if (files.length === 0) {
      results.push({
        file: `${dir}/`,
        layer,
        errors: [],
        warnings: [`Directory "${dir}/" is empty — no "${layer}" layer prompts`],
        stats: { length: 0, lines: 0, templateVars: [] },
      });
      continue;
    }

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const result = validatePromptFile(filePath, layer);
      results.push(result);

      const targetId = file.replace(/\.txt$/, "");
      const id = generateId(layer, targetId);
      if (idSet.has(id)) {
        result.errors.push(`Duplicate ID "${id}" — also used by ${idSet.get(id)}`);
      } else {
        idSet.set(id, result.file);
      }
    }
  }

  return { results, idSet };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printResults(results: ValidationResult[], strict: boolean): boolean {
  let hasErrors = false;
  let totalErrors = 0;
  let totalWarnings = 0;

  console.log("\n=== NEXUS Prompt Template Validation ===\n");

  for (const result of results) {
    const hasIssues = result.errors.length > 0 || result.warnings.length > 0;
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;

    if (result.errors.length > 0) {
      hasErrors = true;
    }

    if (!hasIssues) {
      console.log(`  PASS  ${result.file} (${result.layer}) — ${result.stats.length} chars, ${result.stats.lines} lines`);
      if (result.stats.templateVars.length > 0) {
        console.log(`        Template vars: {{${result.stats.templateVars.join("}}, {{")}}}`)
      }
    } else {
      if (result.errors.length > 0) {
        console.log(`  FAIL  ${result.file} (${result.layer})`);
        for (const err of result.errors) {
          console.log(`        ERROR: ${err}`);
        }
      }
      if (result.warnings.length > 0) {
        if (result.errors.length === 0) {
          console.log(`  WARN  ${result.file} (${result.layer})`);
        }
        for (const warn of result.warnings) {
          console.log(`        WARN:  ${warn}`);
        }
      }
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  Files checked: ${results.length}`);
  console.log(`  Errors:        ${totalErrors}`);
  console.log(`  Warnings:      ${totalWarnings}`);

  if (strict && totalWarnings > 0) {
    console.log(`\n  STRICT MODE: Treating ${totalWarnings} warning(s) as errors.\n`);
    hasErrors = true;
  }

  if (hasErrors) {
    console.log(`\n  RESULT: FAIL — fix the errors above and re-run.\n`);
  } else {
    console.log(`\n  RESULT: PASS — all prompt templates are valid.\n`);
  }

  return hasErrors;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const strict = process.argv.includes("--strict");

  if (!fs.existsSync(PROMPTS_DIR)) {
    console.error(`[ERROR] Prompts directory not found: ${PROMPTS_DIR}`);
    process.exit(1);
  }

  const { results } = validateAllPrompts();
  const hasErrors = printResults(results, strict);

  process.exit(hasErrors ? 1 : 0);
}

main();
