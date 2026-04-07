# SpecFlow

MCP server plugin for spec-driven development with a real-time web dashboard. Powers the spec workflow across all projects.

## Quick Reference

| Field | Value |
|-------|-------|
| Package | `@lbruton/specflow` |
| Version | `3.5.11` |
| Upstream | [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp) |
| Origin | [lbruton/specflow](https://github.com/lbruton/specflow) |
| Branch | `main` (direct commits OK) |
| Plugin copy | `~/.claude/plugins/marketplaces/specflow-marketplace/` (skills/commands only) |
| MCP install | User-level `~/.claude/settings.json` → `npx -y @lbruton/specflow@latest .` |
| Dashboard port | 5051 |
| Dashboard service | `com.specflow.dashboard` (launchd) |
| Issue prefix | `SWF` |

## DocVault — Project Documentation

Technical documentation lives in **DocVault** at `/Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/`. mem0 supplements with session context and past decisions. Read both before discussing architecture or planning changes.

Key pages: Start at `/Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/_Index.md` and follow the index.

```
Read /Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/Overview.md
```

When making changes that affect documented behavior, run `/vault-update` before pushing.

## Architecture & Distribution Model

**The npm package (`@lbruton/specflow`) is ONLY the MCP server + dashboard.** It contains compiled TypeScript (tools, prompts, dashboard server, parsers) and nothing else. Skills are NOT in the npm package.

**Skills are simple markdown files (SKILL.md)** that live in the GitHub repo under `plugin/skills/`. They are copied to the plugin directory — they are NOT compiled, bundled, or shipped via npm. Never suggest "porting skills to npm" — that premise is wrong.

```
npm package (@lbruton/specflow):     MCP server + dashboard only
GitHub repo (lbruton/specflow):      Canonical source for everything
  └─ plugin/skills/                  Markdown skill templates (copied to plugin dir)
Plugin directory:                    Copy of plugin/skills/ + commands/
  ~/.claude/plugins/marketplaces/specflow-marketplace/
MCP install:                         User-level settings.json → npx
```

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

**Key modules:** `config-loader.ts` (read/validate config), `migration.ts` (one-time copy from local .specflow/ to DocVault), `index-updater.ts` (_Index.md lifecycle)

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
plugin/
  skills/          # Plugin skills — session commands Claude follows literally
    prime/         # Universal session boot
    wrap/          # End-of-session orchestrator (supports --handoff)
    audit/         # On-demand project health check
    migrate-skill/ # Skill migration checklist
```

## Steering Documents

Project-level guidance lives in `DocVault/specflow/{project}/steering/`:
- `product.md` — vision, target users, principles, success metrics
- `tech.md` — stack decisions, architecture rationale, known limitations
- `structure.md` — directory layout, naming conventions, module boundaries

Reference these when planning new features or making architectural decisions.

## Templates — Source of Truth Hierarchy (post-INC-002 recovery)

```
DocVault/Projects/SpecFlow/Templates/{name}-guide.md   ← EDIT HERE (canonical, human-readable)
            ↓ /publish-templates skill
src/markdown/templates/{name}.md                        ← machine source (compiled into npm)
            ↓ npm run build
dist/markdown/templates/{name}.md                       ← bundled distribution
            ↓ npm publish (passkey — manual)
@lbruton/specflow on npm                                ← consumed via npx
            ↓ MCP server boot — workspace-initializer.copyTemplate()
DocVault/specflow/{project}/templates/{name}.md         ← runtime copies (overwritten on every boot until SWF-95)
```

**Editable layer:** `DocVault/Projects/SpecFlow/Templates/` only. Each guide page embeds the full template content as a fenced markdown codeblock — that codeblock IS the canonical source.

**Read-only layers:** Everything below. Do NOT edit `src/markdown/templates/` directly without also updating the matching guide page in DocVault. Do NOT edit `DocVault/specflow/{project}/templates/` runtime copies — they're overwritten on every MCP boot.

**Project overrides** at `DocVault/specflow/{project}/templates/` should be ADDITIVE only (project-specific content that extends the global, not replaces it). Currently only StakTrakr has legitimate overrides — all other projects inherit clean from global. See `DocVault/Projects/SpecFlow/recovered-templates-2026-04-07/` for the audit history.

| Tier | Path | Behavior |
|------|------|----------|
| **Canonical (editable)** | `DocVault/Projects/SpecFlow/Templates/{name}-guide.md` | Edit here. Run `/publish-templates` to propagate. |
| Machine source | `src/markdown/templates/{name}.md` | Read-only — synced from canonical via `/publish-templates` |
| Bundled distribution | `dist/markdown/templates/{name}.md` | Build artifact — gitignored |
| Project override | `DocVault/specflow/{project}/templates/` | Additive only. NEVER duplicate global content. |
| Runtime mirror | `DocVault/specflow/{project}/templates/` | Auto-overwritten on MCP boot from npm-bundled `dist/` |

**Edit/upgrade procedure:** Use the `/publish-templates` skill. It handles backup-before-edit, codeblock extraction, build/test, version bump, commit, push, and stops before `npm publish` for manual passkey auth.

## Two Parsers - Keep in Sync

- `src/core/parser.ts` -- used by MCP tools (spec-status, spec-list, etc.)
- `src/dashboard/parser.ts` -- used by the dashboard UI server

If you change how specs are parsed, update BOTH parsers.

## Build, Test, and Deploy

```bash
npm run build        # Compiles src/ -> dist/, copies static assets
npm test             # Runs vitest suite (243 tests)
```

After building, the MCP tools pick up changes on next invocation. The dashboard UI runs as a separate launchd service and must be restarted to serve new static assets:

```bash
launchctl stop com.specflow.dashboard && launchctl start com.specflow.dashboard
```

## Post-Change Gate -- MANDATORY

After ANY source edit:

1. `npm run build` -- verify compilation succeeds
2. `git status --short` -- verify your changes
3. `git add src/` and commit
4. `git push origin main`

Never leave uncommitted source changes. `dist/` is gitignored -- if you build without committing, the next `git pull` silently reverts your work.

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

## Gotcha: Plugin Skills vs Production Skills — NEVER Symlink

**Two intentionally separate file sets:**

| Location | Audience | Purpose |
|---|---|---|
| `~/.claude/skills/<name>/SKILL.md` | lbruton only | Daily-driver production skills, may contain personal customization |
| `plugin/skills/<name>/SKILL.md` (this repo) | npm consumers | Sanitized public release copy that ships in the npm package |

**The two are NOT symlinked and must NOT be symlinked.** Production skills may diverge from shipped skills. We do not ship lbruton-customized skills in the public release. After editing one, **explicitly decide** whether the change belongs in the other and manually copy it across — there is no automatic sync, by design.

If you find a symlink between these locations, it's a bug — replace it with a real file copy:

```bash
rm ~/.claude/skills/<name>/SKILL.md
cp plugin/skills/<name>/SKILL.md ~/.claude/skills/<name>/SKILL.md
```

After editing a plugin skill, also copy to the marketplace cache so it picks up immediately:

```bash
cp plugin/skills/<name>/SKILL.md ~/.claude/plugins/marketplaces/specflow-marketplace/plugin/skills/<name>/SKILL.md
```

The compiled MCP server (`dist/`) auto-updates from npm on next Claude Code launch.

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

## Gotcha: Prompt Path References

MCP prompts in `src/prompts/` embed file paths in their text output. These paths MUST use `PathUtils.getWorkflowRoot()` — never hardcode `.specflow/`. If you change path resolution, grep all prompts for stale path strings. Files: create-spec.ts, implement-task.ts, spec-status.ts, create-steering-doc.ts, inject-steering-guide.ts.

## Consumers

This plugin is loaded by every project: StakTrakr, HexTrackr, Forge, MyMelo, WhoseOnFirst, Playground, claude-context, HomeNetwork, Portfolio (lbruton.github.io), obsidian-mcp, TechRefreshMacCompare. Changes here affect all of them. Test carefully.
