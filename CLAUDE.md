# SpecFlow

MCP server plugin for spec-driven development with a real-time web dashboard. Powers the spec workflow across all projects.

## Quick Reference

| Field | Value |
|-------|-------|
| Package | `@lbruton/specflow` |
| Version | `3.4.0` |
| Upstream | [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp) |
| Origin | [lbruton/specflow](https://github.com/lbruton/specflow) |
| Branch | `main` (direct commits OK) |
| Plugin copy | `~/.claude/plugins/marketplaces/specflow-marketplace/` (skills/commands only) |
| MCP install | User-level `~/.claude/settings.json` → `npx -y @lbruton/specflow@latest .` |
| Dashboard port | 5051 |
| Dashboard service | `com.spec-workflow.dashboard` (launchd) |
| Issue prefix | `SWF` |

## DocVault — Project Documentation

Technical documentation lives in **DocVault** at `/Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/`. mem0 supplements with session context and past decisions. Read both before discussing architecture or planning changes.

Key pages: Start at `/Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/_Index.md` and follow the index.

```
Read /Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/Overview.md
```

When making changes that affect documented behavior, run `/vault-update` before pushing.

## Architecture

This repo is the canonical source. The plugin directory at `~/.claude/plugins/marketplaces/specflow-marketplace/` is a **copy**, not a symlink — plugin skill files must be manually copied after edits (see gotcha below).

The MCP server is **not bundled with the plugin**. It is installed separately in the user's `~/.claude/settings.json` and runs via `npx`. This avoids self-referencing conflicts when working inside the specflow repo itself.

```
/Volumes/DATA/GitHub/specflow/              <-- you are here (canonical source)
    plugin (skills/commands) copied to:
~/.claude/plugins/marketplaces/specflow-marketplace/
    MCP server installed separately via:
~/.claude/settings.json → npx -y @lbruton/specflow@latest .
```

## Source Structure

```
src/
  tools/           # MCP tool definitions (spec-status, spec-list, approvals, etc.)
    index.ts       # Tool registry - registerTools() + handleToolCall()
  prompts/         # MCP prompt definitions (create-spec, implement-task, etc.)
    index.ts       # Prompt registry
  core/            # Shared logic (parser, task-parser, path-utils)
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

Project-level guidance lives in `.spec-workflow/steering/`:
- `product.md` — vision, target users, principles, success metrics
- `tech.md` — stack decisions, architecture rationale, known limitations
- `structure.md` — directory layout, naming conventions, module boundaries

Reference these when planning new features or making architectural decisions.

## Templates — Three-Tier System

| Tier | Path | Behavior |
|------|------|----------|
| Bundled | `src/markdown/templates/` → `dist/markdown/templates/` | Shipped in npm, copied to projects on startup (always overwrites) |
| Project | `.spec-workflow/templates/` | Copied from bundled on every MCP startup — always fresh |
| User | `.spec-workflow/user-templates/` | Generated once from conventions, never auto-overwritten |

**Warning:** The bundled `tasks-template.md` body contains upstream Pimzino's TypeScript/React/Express sample (SWF-70 tracks rewrite). The closing tasks section is correctly genericized by `template-generator.ts` convention detection.

`writeUserTemplates()` in `src/core/template-generator.ts` has a guard clause (line 239) that returns early if user-templates exist — template fixes in new versions never propagate to existing projects.

## Two Parsers - Keep in Sync

- `src/core/parser.ts` -- used by MCP tools (spec-status, spec-list, etc.)
- `src/dashboard/parser.ts` -- used by the dashboard UI server

If you change how specs are parsed, update BOTH parsers.

## Build, Test, and Deploy

```bash
npm run build        # Compiles src/ -> dist/, copies static assets
npm test             # Runs vitest suite (196 tests)
```

After building, the MCP tools pick up changes on next invocation. The dashboard UI runs as a separate launchd service and must be restarted to serve new static assets:

```bash
launchctl stop com.spec-workflow.dashboard && launchctl start com.spec-workflow.dashboard
```

## Post-Change Gate -- MANDATORY

After ANY source edit:

1. `npm run build` -- verify compilation succeeds
2. `git status --short` -- verify your changes
3. `git add src/` and commit
4. `git push origin main`

Never leave uncommitted source changes. `dist/` is gitignored -- if you build without committing, the next `git pull` silently reverts your work.

## Publishing

```bash
# 1. Edit package.json version
# 2. npm run build
# 3. npm test
# 4. git add package.json package-lock.json && git commit && git push
# 5. npm publish --access public   (requires npm OTP/web auth)
```

## Gotcha: Plugin Skill Files

Plugin skill files (`plugin/skills/*/SKILL.md`) are NOT symlinked — they are copied to the plugin directory. After editing a skill in this repo, you must manually copy it:

```bash
cp plugin/skills/<name>/SKILL.md ~/.claude/plugins/marketplaces/specflow-marketplace/plugin/skills/<name>/SKILL.md
```

The compiled MCP server (`dist/`) auto-updates from npm on next Claude Code launch.

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

## Consumers

This plugin is loaded by every project: StakTrakr, HexTrackr, StakTrakrApi, MyMelo, WhoseOnFirst, Playground. Changes here affect all of them. Test carefully.
