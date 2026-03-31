// ============================================================
// Project Builder — Prompt builders for each agent role
// ============================================================

import type {
  ProjectBuildInput,
  ProjectSpec,
  ArchitectureBlueprint,
  BuildAgentRole,
  ValidationReport,
} from "@nexus/shared";

export function buildCEOPrompt(input: ProjectBuildInput): string {
  return `You are an AI CEO / Project Lead. Your job is to deeply analyze the following project idea and produce a complete Project Specification Document (PSD).

PROJECT IDEA: "${input.idea}"
${input.tech_stack ? `PREFERRED TECH STACK: ${input.tech_stack}` : ""}
${input.features ? `REQUESTED FEATURES: ${input.features.join(", ")}` : ""}
${input.target_user ? `TARGET USER: ${input.target_user}` : ""}
${input.design_style ? `DESIGN STYLE: ${input.design_style}` : ""}

Ask yourself these questions and answer them in your analysis:
1. What problem does this solve?
2. Who is the target user?
3. What are the 5+ core features?
4. What are the must-have pages?
5. What data needs to be stored?
6. What are the user flows? (signup → login → dashboard → action)
7. What integrations are needed?
8. What's the best tech stack?

Respond with a JSON object matching this EXACT structure:
{
  "project_name": "string",
  "problem_statement": "string",
  "target_users": "string",
  "core_features": ["feature1", "feature2", ...],
  "pages": ["page1", "page2", ...],
  "data_entities": ["entity1", "entity2", ...],
  "user_flows": ["flow1", "flow2", ...],
  "tech_stack": {
    "frontend": "string",
    "backend": "string",
    "database": "string",
    "styling": "string"
  },
  "integrations": ["integration1", ...],
  "auth_flow": "string"
}`;
}

export function buildArchitectPrompt(spec: ProjectSpec): string {
  return `You are an AI Software Architect. Given the following Project Specification, design a complete system architecture.

PROJECT SPEC:
${JSON.stringify(spec, null, 2)}

Design the FULL architecture including:
1. Database schema with ALL tables, columns, types, relationships
2. API endpoint list with request/response shapes
3. Frontend page list with component hierarchy
4. Complete file/folder structure
5. Authentication flow
6. State management approach

Respond with a JSON object matching this EXACT structure:
{
  "database_schema": {
    "tables": [
      {
        "name": "table_name",
        "columns": [
          { "name": "id", "type": "TEXT", "primary_key": true },
          { "name": "created_at", "type": "TEXT" },
          { "name": "updated_at", "type": "TEXT" },
          ...more columns
        ]
      }
    ]
  },
  "api_endpoints": [
    {
      "method": "GET|POST|PUT|DELETE",
      "path": "/api/...",
      "description": "...",
      "request_body": { ... } or null,
      "response_shape": { ... },
      "auth_required": true/false
    }
  ],
  "pages": [
    {
      "route": "/path",
      "name": "PageName",
      "layout": "main|auth|dashboard",
      "components": ["Component1", "Component2"],
      "data_requirements": ["endpoint1", "endpoint2"]
    }
  ],
  "components": [
    {
      "name": "ComponentName",
      "props": { "propName": "type" },
      "state": { "stateName": "type" },
      "events": ["onClick", "onSubmit"]
    }
  ],
  "file_structure": [
    "src/app/layout.tsx",
    "src/app/page.tsx",
    ...
  ],
  "auth_flow": "description of auth flow",
  "state_management": "description of state management approach"
}`;
}

export function buildContractPrompt(spec: ProjectSpec, blueprint: ArchitectureBlueprint): string {
  return `You are a Contract Generator. Given the project specification and architecture blueprint, generate precise contracts that ALL build agents must follow.

PROJECT SPEC:
${JSON.stringify(spec, null, 2)}

ARCHITECTURE BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}

Generate contracts for each layer. Respond with a JSON object:
{
  "database_schema": { ... exact table definitions ... },
  "api_contracts": [ ... endpoint contracts ... ],
  "component_contracts": [ ... component contracts ... ],
  "page_contracts": [ ... page contracts ... ],
  "design_tokens": {
    "colors": { "primary": "#...", "secondary": "#...", ... },
    "fonts": { "heading": "...", "body": "..." },
    "spacing": { "xs": "...", "sm": "...", "md": "...", "lg": "...", "xl": "..." },
    "shadows": { "sm": "...", "md": "...", "lg": "..." },
    "borderRadius": { "sm": "...", "md": "...", "lg": "...", "full": "..." }
  }
}

IMPORTANT: Every API endpoint must have a matching frontend call. Every database table must have matching API CRUD routes. Every frontend page must have matching API data sources. All types must be consistent.`;
}

export function buildContractValidationPrompt(
  contracts: Record<string, unknown>,
  spec: ProjectSpec,
  blueprint: ArchitectureBlueprint
): string {
  return `You are a Contract Validator. Check the following contracts for completeness and consistency.

CONTRACTS:
${JSON.stringify(contracts, null, 2)}

PROJECT SPEC:
${JSON.stringify(spec, null, 2)}

ARCHITECTURE BLUEPRINT:
${JSON.stringify(blueprint, null, 2)}

Validate:
1. Every API endpoint has a matching frontend call
2. Every database table has matching API CRUD routes
3. Every frontend page has matching API data sources
4. All types are consistent across frontend and backend
5. Auth flow is complete

Respond with JSON:
{
  "valid": true/false,
  "score": 1-10,
  "issues": [
    { "file": "contracts", "severity": "error|warning|info", "message": "...", "suggested_fix": "..." }
  ],
  "suggestions": ["suggestion1", ...]
}`;
}

export function buildAgentPrompt(
  role: BuildAgentRole,
  spec: ProjectSpec,
  blueprint: ArchitectureBlueprint,
  contracts: Record<string, unknown>,
  existingFiles: Array<{ file_path: string; content: string; agent_role: string }>,
  feedback?: string
): string {
  const contextFiles = existingFiles
    .slice(0, 20)
    .map((f) => `--- ${f.file_path} (by ${f.agent_role}) ---\n${f.content.slice(0, 500)}`)
    .join("\n\n");

  const feedbackNote = feedback ? `\nPREVIOUS REVIEWER FEEDBACK:\n${feedback}\n` : "";

  const rolePrompts: Record<string, string> = {
    designer: `You are an AI Designer. Generate the design system files.

Generate these files:
- tailwind.config.ts with custom theme
- src/styles/globals.css with CSS variables
- src/styles/design-tokens.ts with exported constants

Use the design tokens contract. All colors must have sufficient contrast (WCAG AA).`,

    db_architect: `You are an AI Database Architect. Generate the database layer.

Generate these files:
- migrations/001_initial.sql with all CREATE TABLE statements
- src/db/seed.sql with sample data
- src/types/database.ts with TypeScript types matching the DB schema
- src/lib/db.ts with database connection and query helpers

Every table must have: id (primary key), created_at, updated_at. Use parameterized queries.`,

    backend_dev: `You are an AI Backend Developer. Generate the API backend.

For EACH endpoint in the API contracts, generate:
- Route handler with request validation, business logic, response
- Service function with database queries
- Input validation schemas
- Error handling with proper HTTP status codes

Generate files like:
- src/api/routes/[resource].ts
- src/api/services/[resource].ts
- src/api/middleware/auth.ts
- src/api/index.ts (main entry)

Rules: validate all input, handle all errors, return exact contract response shapes, use parameterized queries, require auth on protected routes.`,

    frontend_dev: `You are an AI Frontend Developer. Generate the frontend pages and components.

For EACH page in the page contracts, generate:
- Page component with layout
- Child components
- API integration (data fetching, mutations)
- Loading, error, empty, and success states
- Form validation
- Responsive design

Generate files like:
- src/app/[page]/page.tsx
- src/components/[Component].tsx
- src/hooks/use[Resource].ts

Rules: handle loading/error/empty/success states, validate forms before submit, handle API errors, be responsive, use design tokens (no hardcoded colors/strings).`,

    integrator: `You are an AI Integrator. Connect the frontend to the backend.

Generate:
- src/lib/api-client.ts — typed fetch wrappers for every backend endpoint
- src/hooks/use[Resource].ts — React hooks for data fetching
- src/context/AuthContext.tsx — auth context/provider
- src/middleware.ts — route guards for protected pages
- src/lib/utils.ts — shared utility functions

Verify: for every frontend API call, a matching backend route exists with matching request/response types.`,
  };

  const roleInstructions = rolePrompts[role] ?? `You are an AI ${role}. Generate the required files for your role.`;

  return `${roleInstructions}

PROJECT SPEC:
${JSON.stringify(spec, null, 2)}

ARCHITECTURE BLUEPRINT (relevant parts):
Database Schema: ${JSON.stringify(blueprint.database_schema, null, 2)}
API Endpoints: ${JSON.stringify(blueprint.api_endpoints, null, 2)}
File Structure: ${JSON.stringify(blueprint.file_structure, null, 2)}

CONTRACTS:
${JSON.stringify(contracts, null, 2)}

EXISTING CODE (from other agents):
${contextFiles || "(none yet)"}
${feedbackNote}

Respond with a JSON object containing a "files" array:
{
  "files": [
    {
      "path": "src/path/to/file.ts",
      "content": "// full file content here...",
      "language": "typescript"
    },
    ...
  ]
}

Generate COMPLETE, RUNNABLE files. Include all imports, types, and exports. Follow the contracts exactly.`;
}

export function buildStructuralValidatorPrompt(
  files: Array<{ path: string; content: string }>,
  blueprint: ArchitectureBlueprint
): string {
  const fileList = files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");

  return `You are a Structural Validator. Check the following generated project files for structural correctness.

FILES:
${fileList}

EXPECTED FILE STRUCTURE:
${JSON.stringify(blueprint.file_structure, null, 2)}

Check the following (no AI judgment needed — just parsing and pattern matching):
1. Every import references an existing file
2. Every component referenced in pages exists as a file
3. All used packages are listed in package.json
4. Every API endpoint in frontend has a matching backend route
5. Every database table referenced in code exists in the migration
6. No TODO/FIXME/HACK comments
7. No console.log in production code
8. All files use consistent formatting

Respond with JSON:
{
  "score": 1-10,
  "issues": [
    { "file": "path/to/file", "line": 42, "severity": "error|warning|info", "message": "...", "suggested_fix": "..." }
  ],
  "issues_count": 5
}`;
}

export function buildCodeReviewPrompt(
  files: Array<{ path: string; content: string }>,
  spec: ProjectSpec
): string {
  const fileList = files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");

  return `You are an AI Code Reviewer. Review ALL generated code for quality, security, and correctness.

FILES:
${fileList}

PROJECT SPEC:
${JSON.stringify(spec, null, 2)}

Review checklist (enforce per file):

SECURITY:
- No hardcoded secrets or API keys
- Input validation on all user inputs
- SQL injection prevention (parameterized queries)
- XSS prevention (output encoding)
- Auth checks on protected routes

LOGIC:
- Error handling covers edge cases
- Null/undefined checks where needed
- Loop termination conditions correct
- State mutations correct

CONSISTENCY:
- Naming conventions followed
- Code style matches project conventions
- Types correct and complete (no 'any')
- Imports clean (no unused imports)

COMPLETENESS:
- All CRUD operations per contract
- All pages have loading/error/empty states
- All forms have validation

Respond with JSON:
{
  "score": 1-10,
  "issues": [
    { "file": "path/to/file", "line": 42, "severity": "error|warning|info", "message": "...", "suggested_fix": "..." }
  ],
  "issues_count": 5
}`;
}

export function buildQAValidatorPrompt(
  files: Array<{ path: string; content: string }>,
  blueprint: ArchitectureBlueprint,
  spec: ProjectSpec
): string {
  const fileList = files.map((f) => `--- ${f.path} ---\n${f.content}`).join("\n\n");

  return `You are an AI QA Cross-Validator. Check that everything works together — don't look at code quality, check integration correctness.

FILES:
${fileList}

ARCHITECTURE:
${JSON.stringify(blueprint, null, 2)}

SPEC:
${JSON.stringify(spec, null, 2)}

Validate:
1. Frontend page X calls API endpoint Y with correct parameters
2. API endpoint Y queries database table Z with correct columns
3. Database table Z has the columns that the API expects
4. Response shapes from API match what frontend expects
5. Auth flow: signup creates user → login returns token → token works on protected routes
6. Navigation: every link points to an existing page
7. Forms: every form field maps to a database column

Respond with JSON:
{
  "score": 1-10,
  "issues": [
    { "file": "path/to/file", "severity": "error|warning|info", "message": "..." }
  ],
  "issues_count": 5,
  "suggestions": ["suggestion1", ...]
}`;
}

export function buildFixerPrompt(
  files: Array<{ path: string; content: string }>,
  issues: Array<{ file: string; line?: number; severity: string; message: string; suggested_fix?: string }>
): string {
  const issueList = issues
    .map((i) => `- [${i.severity}] ${i.file}${i.line ? `:${i.line}` : ""}: ${i.message}${i.suggested_fix ? ` (Fix: ${i.suggested_fix})` : ""}`)
    .join("\n");

  const relevantFiles = new Set(issues.map((i) => i.file));
  const fileContents = files
    .filter((f) => relevantFiles.has(f.path))
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join("\n\n");

  return `You are an AI Fixer. Make SURGICAL, TARGETED fixes to resolve the following issues. Do NOT regenerate everything — only fix what's broken.

ISSUES TO FIX:
${issueList}

FILES WITH ISSUES:
${fileContents}

Rules:
1. Only modify files that have issues
2. Preserve all working code
3. Make the minimum change needed to fix each issue
4. Do not introduce new bugs

Respond with JSON:
{
  "fixes": [
    {
      "path": "path/to/file.ts",
      "content": "// complete fixed file content",
      "language": "typescript"
    }
  ]
}`;
}
