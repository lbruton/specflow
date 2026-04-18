# SpecFlow

MCP server plugin for spec-driven development with a real-time web dashboard. Powers the spec workflow across all projects.

## Quick Reference

| Field             | Value                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package           | `@lbruton/specflow`                                                                                                                                                 |
| Version           | `3.6.3`                                                                                                                                                             |
| Upstream          | [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp)                                                                                           |
| Origin            | [lbruton/specflow](https://github.com/lbruton/specflow)                                                                                                             |
| Branch            | `main` (PR required, signed commits, status checks)                                                                                                                 |
| Skills source     | `specflow/skills/` in the repo (users copy → `~/.claude/skills/`)                                                                                                   |
| Commands source   | `specflow/commands/` in the repo (users copy → `~/.claude/commands/`)                                                                                               |
| MCP install       | User-level `~/.claude/settings.json` → `npx -y @lbruton/specflow@latest .`                                                                                          |
| Dashboard port    | `5000` (default; override with `specflow --dashboard --port <n>`)                                                                                                   |
| Dashboard service | Single Node process (`specflow --dashboard`; singleton instance registered in `~/.specflow-mcp/activeSession.json`); all MCP servers share the one running instance |
| Issue prefix      | `SWF`                                                                                                                                                               |

## DocVault — Project Documentation

Technical documentation lives in **DocVault** at `/Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/`. mem0 supplements with session context and past decisions. Read both before discussing architecture or planning changes.

Key pages: Start at `/Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/_Index.md` and follow the index.

```
Read /Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/Overview.md
```

When making changes that affect documented behavior, run `/vault-update` before pushing.

## Architecture & Distribution Model

**Two completely separate distribution channels — do not confuse them:**

| Channel                             | What ships                                   | How users get it                                                     | Where it lives in the repo                              |
| ----------------------------------- | -------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------- |
| **npm package** `@lbruton/specflow` | MCP server + dashboard (compiled TypeScript) | `npx -y @lbruton/specflow@latest .` in user-level settings.json      | `src/` → built into `dist/` → published to npm          |
| **GitHub repo direct download**     | Skills + slash commands (markdown files)     | Clone/zip the repo, copy `skills/` and `commands/` into `~/.claude/` | `specflow/skills/` and `specflow/commands/` (top-level) |

**Skills and commands are NEVER in the npm package.** They are plain markdown that users install by copying. The MCP server and the skills are independent — installing one does not install the other. The README must instruct users to do both.

### Skill Distribution Pipeline

```mermaid
flowchart LR
    A[User-level skill<br/>~/.claude/skills/&lt;name&gt;/SKILL.md] -->|battle test in real sessions| B{Proven?}
    B -->|no, iterate| A
    B -->|yes, ready to share| C[Make project-agnostic<br/>strip personal customization]
    C --> D[cp → specflow/skills/&lt;name&gt;/SKILL.md]
    D --> E[git commit + push to specflow repo]
    E --> F[Users clone or download ZIP from GitHub]
    F --> G[cp specflow/skills/* → ~/.claude/skills/]
```

**Canonical locations (single source of truth — no duplicates):**

| Location                           | Purpose                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `~/.claude/skills/<name>/SKILL.md` | lbruton's daily-driver, where new skills are battle-tested first                       |
| `specflow/skills/<name>/SKILL.md`  | **The shipped copy.** This is what users download from GitHub.                         |
| `specflow/commands/<name>.md`      | Shipped slash-command definitions (same model — users copy into `~/.claude/commands/`) |

**Hard rules:**

- There is NO `plugin/` directory. If you see one, it's an orphan from before the 2026-04-07 reconciliation — delete it, do not edit it.
- There is NO `.claude-plugin/` directory. Removed in v3.6.0 (PR #12) — `marketplace.json` referenced the dead `plugin/` source. If it reappears, delete it.
- There is NO marketplace directory under `~/.claude/plugins/marketplaces/`. If one exists, it's stale — delete it.
- **Never symlink** the user-level skill to the repo copy. They are intentionally separate so user-level can iterate without dirtying the shipped version.
- Promotion is a manual `cp` after the user-level version has been tested. Long-term we may automate this, but today it's a deliberate human step.

### DocVault Consolidation (SWF-2 — shipped v3.5.0)

All specflow artifacts live in DocVault. Each project has only `.specflow/config.json` locally.

```
DocVault/specflow/
  templates/                         # Global templates (bundled, always overwritten)
  {ProjectName}/
    steering/                        # product.md, tech.md, structure.md
    templates/                       # Project-level overrides ONLY (not copies of globals)
    specs/                           # All spec artifacts (requirements, design, tasks, logs)
    approvals/                       # Approval records
    archive/specs/                   # Archived specs
```

**Config:** `.specflow/config.json` in each project root points to DocVault:

```json
{ "project": "StakTrakr", "docvault": "../DocVault", "issue_prefix": "STAK" }
```

**Path resolution:** `PathUtils.getWorkflowRoot()` reads config.json and returns DocVault path. All callers resolve automatically.

**Key modules:** `config-loader.ts` (read/validate config), `migration.ts` (one-time copy from local .specflow/ to DocVault), `index-updater.ts` (\_Index.md lifecycle)

## Source Structure

```
src/
  tools/           # MCP tool definitions (spec-status, spec-list, approvals, etc.)
    index.ts       # Tool registry - registerTools() + handleToolCall()
  prompts/         # MCP prompt definitions (create-spec, implement-task, etc.)
    index.ts       # Prompt registry
  core/            # Shared logic (parser, task-parser, path-utils)
                   # config-loader.ts — read/validate .specflow/config.json
                   # migration.ts — one-time .specflow/ → DocVault copy
                   # index-updater.ts — _Index.md lifecycle management
  dashboard/       # Dashboard UI server (parser.ts + server.ts)
  types.ts         # Shared TypeScript types
  index.ts         # Server entry point
skills/            # Shipped skills — users copy to ~/.claude/skills/
  audit/           # On-demand project health check
  chat/            # Casual discovery mode (Phase 0)
  codacy-resolve/  # Triage + resolve Codacy findings
  discover/        # Structured brainstorm/research (Phase 1)
  issue/           # Vault-based issue CRUD
  migrate-skill/   # Skill migration checklist
  pr-cleanup/      # Post-merge branch/worktree cleanup
  prime/           # Universal session boot
  publish-templates/  # Template publish pipeline (canonical src/markdown/templates/)
  retro/           # End-of-session retrospective → mem0
  spec/            # Spec-driven development orchestrator
  start/           # Lightweight session reorientation
  wrap/            # End-of-session orchestrator (supports --handoff)
commands/          # Shipped slash-command definitions — users copy to ~/.claude/commands/
  audit.md, create-spec.md, create-steering-doc.md, implement-task.md,
  inject-spec-workflow-guide.md, inject-steering-guide.md, prime.md,
  refresh-tasks.md, spec.md, spec-status.md, wrap.md
```

## Steering Documents

Project-level guidance lives in `DocVault/specflow/{project}/steering/`:

- `product.md` — vision, target users, principles, success metrics
- `tech.md` — stack decisions, architecture rationale, known limitations
- `structure.md` — directory layout, naming conventions, module boundaries

Reference these when planning new features or making architectural decisions.

## Templates — Source of Truth Hierarchy

**`src/markdown/templates/{name}.md` is the ONE editable source.** Everything downstream is a derived artifact or runtime cache.

```text
src/markdown/templates/{name}.md           ← CANONICAL (edit here, or via /publish-templates)
   ├─→ dist/markdown/templates/            ← npm build output
   │     └─→ @lbruton/specflow on npm
   │           └─→ DocVault/specflow/{project}/templates/  ← runtime cache for bundled/global files
   └─→ DocVault/Projects/SpecFlow/Templates/{name}-guide.md  ← KB snapshot, regenerated by /publish-templates
```

| Directory                                              | Role                                           | Editable?                                                                                                                                                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/markdown/templates/`                              | Canonical source in git                        | **YES** — direct edit or `/publish-templates`                                                                                                                                                                                           |
| `DocVault/Projects/SpecFlow/Templates/{name}-guide.md` | Human-readable KB mirror (Obsidian)            | **NO** — regenerated; hand-edits clobbered                                                                                                                                                                                              |
| `DocVault/specflow/{project}/templates/`               | Per-project runtime cache + additive overrides | **Global/bundled filenames: NO** — MCP boot re-copies them from the npm package (until SWF-95 version-gates this). **New override-only filenames: YES** — not clobbered; StakTrakr is the only project with legitimate overrides today. |

**Ship a change:** use `/publish-templates` — writes canonical, regenerates the DocVault guide snapshot, builds/tests, bumps version, commits, pushes, and stops before `npm publish` for manual passkey.

**Inspect a template:** read `src/markdown/templates/{name}.md` directly; the DocVault guide is the human-readable explanation.

## Two Parsers - Keep in Sync

- `src/core/parser.ts` -- used by MCP tools (spec-status, spec-list, etc.)
- `src/dashboard/parser.ts` -- used by the dashboard UI server

If you change how specs are parsed, update BOTH parsers.

## Build, Test, and Deploy

```bash
npm run build            # validate:i18n → clean → tsc → build:dashboard (Vite)
npm test                 # vitest unit suite (src/**/__tests__)
npm run test:e2e         # Playwright E2E (e2e/*.spec.ts) — batch-approvals, worktree isolation
npm run test:e2e:worktree # worktree-scoped E2E (separate config)
npm run validate:mdx     # MDX template validator (SWF-101/116)
npm run format           # prettier --write .
```

After building, MCP tools pick up the rebuilt `dist/` on next invocation (an `/mcp` reconnect is enough for MCP-side assets). The dashboard is a **long-running Node process** (started via `specflow --dashboard`) — to serve rebuilt dashboard assets, stop it (kill the PID recorded in `~/.specflow-mcp/activeSession.json`) and relaunch with `specflow --dashboard`.

## Post-Change Gate -- MANDATORY

After ANY source edit:

1. `npm run build` -- verify compilation succeeds
2. `git status --short` -- verify your changes
3. Create a worktree branch, commit your changes there, and open a PR
4. Merge the PR once all status checks pass

Never leave uncommitted source changes. `dist/` is gitignored -- if you build without committing, the next `git pull` silently reverts your work.

**Branch protection:** `main` enforces signed commits, required pull requests, and required status checks. Direct pushes are rejected. All changes (including skills, templates, docs) go through a PR. See the security note in the user-level `CLAUDE.md` § Repo Boundaries for the post-INC-001 rationale.

## Publishing

**For template-only changes:** Use the `/publish-templates` skill. It automates the full pipeline including backup-before-edit and stops at the manual `npm publish` step.

**For code/MCP/dashboard changes:**

```bash
# 1. Edit package.json version
# 2. npm run build
# 3. npm test
# 4. git add package.json package-lock.json && git commit && git push
# 5. npm publish --access public   (PASSKEY AUTH — manual user step, Claude cannot run this)
# 6. Clear npx cache: find ~/.npm/_npx -path "*/specflow/package.json" -exec dirname {} \; | xargs rm -rf
# 7. Verify: npm view @lbruton/specflow version
```

**npm publish constraint:** lbruton uses passkey authentication for npm. Claude CANNOT run `npm login` or `npm publish` directly — both fail with 401 at the auth step. Always hand off step 5 to the user and wait for confirmation before running step 6 verification. See mem0 `feedback_npm_publish_passkey.md` for the rationale.

## Promoting a Skill — User-Level → Shipped

The promotion flow is intentionally manual. After a skill has been battle-tested at `~/.claude/skills/<name>/SKILL.md`:

1. **Sanitize** — strip any lbruton-specific paths, personal preferences, or workspace assumptions. The shipped copy must work for any user on any project.
2. **Copy** — `cp ~/.claude/skills/<name>/SKILL.md /Volumes/DATA/GitHub/specflow/skills/<name>/SKILL.md` (create the subdirectory if it's a brand-new skill)
3. **Verify** — `diff ~/.claude/skills/<name>/SKILL.md specflow/skills/<name>/SKILL.md` — only the sanitization changes should appear; if anything else differs, you copied the wrong version
4. **Commit + push on a worktree branch, open a PR** — signed commits and required status checks are enforced on `main`, so there is no direct-push path even for docs/skills. Skills and commands ship through the same PR flow as source changes.
5. **Update README** if the skill is new — add it to the skills inventory section in the same PR

The same flow applies to slash commands in `commands/`. There is no build step, no compile, no npm involvement. Skills and commands ship as raw markdown.

**Anti-patterns to avoid:**

- Editing `specflow/skills/<name>/SKILL.md` directly without testing at user level first — you'll ship something that broke in the first session.
- Symlinking user-level → repo copy. They must be separate files so user-level can iterate freely.
- Looking for a `plugin/` directory. There isn't one. If your search returns one, it's an orphan and should be deleted, not edited.

## Gotcha: mem0 Reader Pattern (SWF-90)

mem0 cloud v1 API does NOT persist top-level `agent_id` — it's `null` on every record. Project tag lives in `metadata.project`. **Never** filter mem0 reads with `filters: {AND: [{agent_id: <tag>}]}` — fetch unfiltered, then post-filter on `metadata.project` case-insensitively (legacy records have inconsistent casing like `SpecFlow` vs `specflow`). Canonical pattern: `~/.claude/hooks/mem0-session-start.py:83-140`. Full reference: `DocVault/Architecture/mem0-configuration.md` § Schema Reality.

## Adding a New Tool

1. Create `src/tools/my-tool.ts` -- export a `Tool` object + handler function
2. Register in `src/tools/index.ts` -- add to `registerTools()` array + `handleToolCall()` switch
3. `npm run build`

## Adding a New Prompt

1. Create `src/prompts/my-prompt.ts` -- export a `PromptDefinition`
2. Register in `src/prompts/index.ts`
3. `npm run build`

## DocVault Index Rule

Every DocVault folder must have `_Index.md`. When creating, deleting, or moving files in DocVault, update the folder's `_Index.md` and parent indexes in the same commit. Run `/vault-reconcile` to detect drift.

## Post-Publish Verification -- MANDATORY

After `npm publish`, before telling the user it's done:

1. Verify npm has the new version: `npm view @lbruton/specflow version`
2. Clear npx cache if stale (see Publishing section)
3. `/mcp` reconnect to load new version
4. Verify config loads: check `DocVault/specflow/{project}/` dirs exist
5. Verify migration ran: local `.specflow/` should contain only `config.json`
6. Verify templates: project templates dir should have overrides only, not globals
7. Run a test spec or `spec-status` to confirm MCP tools work with DocVault paths

## Gotcha: Version Bump Checklist

When bumping `package.json` version, also update:

1. `CLAUDE.md` Quick Reference table (Version field)
2. Run `npm run build` to propagate to `dist/`

Both files were out of sync prior to v3.6.0 — the CLAUDE.md version field is not auto-synced.

## Gotcha: Squash Merge Branch Cleanup

GitHub squash-merges PRs by default. After merge, `git branch -d <branch>` fails with "not fully merged" because the squash commit has a different SHA than the branch commits. The branch IS merged — the `[gone]` tracking status confirms it. Use `git branch -D <branch>` for branches confirmed `[gone]` after a squash merge.

## Gotcha: Prompt Path References

MCP prompts in `src/prompts/` embed file paths in their text output. These paths MUST use `PathUtils.getWorkflowRoot()` — never hardcode `.specflow/`. If you change path resolution, grep all prompts for stale path strings. Files: create-spec.ts, implement-task.ts, spec-status.ts, create-steering-doc.ts, inject-steering-guide.ts.

## Quality Gates (OPS-143)

Pre-commit + build-time gates run automatically. Expect side effects on Edit/Write/commit.

- **prettier + lint-staged + husky**: staged `.{ts,tsx,js,cjs,mjs,json,css,html}` files get `prettier --write` on every commit. Claude should expect formatting changes on top of its own edits. Config: `.prettierrc.json`, `.prettierignore`.
- **i18n validation**: `npm run validate:i18n` runs as the first step of every `npm run build`. Missing/extra/misformatted translation keys fail the build. Script: `scripts/validate-i18n.js`.
- **MDX validation**: `npm run validate:mdx` (`scripts/validate-mdx.ts` → `src/core/mdx-validator.ts`) validates spec/template MDX. Keep callers using `PathUtils.getWorkflowRoot()` — hardcoded `.specflow/` paths break the validator.

## Hooks

- **gitleaks**: Pre-commit hook scans for accidental secret commits (`github-pat`, `aws`, `stripe`, etc.). Runs via `pre-commit` framework. Installed 2026-04-14 (OPS-116).

## Consumers

This plugin is loaded by every project: StakTrakr, HexTrackr, Forge, MyMelo, WhoseOnFirst, Playground, claude-context, HomeNetwork, Portfolio (lbruton.github.io), obsidian-mcp, TechRefreshMacCompare. Changes here affect all of them. Test carefully.
