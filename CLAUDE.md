# SpecFlow

MCP server plugin for spec-driven development with a real-time web dashboard. Powers the spec workflow across all projects.

## Quick Reference

| Field | Value |
|-------|-------|
| Package | `@lbruton/specflow` |
| Version | `2.2.4-lbruton.2` |
| Upstream | [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp) |
| Origin | [lbruton/specflow](https://github.com/lbruton/specflow) |
| Branch | `main` (direct commits OK) |
| Symlinked from | `~/.claude/plugins/marketplaces/specflow-marketplace/` |
| MCP cache entry | `~/.claude/plugins/cache/specflow-marketplace/specflow-with-dashboard/.../.mcp.json` |
| Dashboard port | 5051 |
| Dashboard service | `com.spec-workflow.dashboard` (launchd) |
| Issue prefix | `SWF` |

## DocVault — Project Documentation

Technical documentation lives in **DocVault** at `/Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/`. mem0 supplements with session context and past decisions. Read both before discussing architecture or planning changes.

Key pages: `Overview.md`, `Architecture.md`, `Tools & Prompts.md`, `Dashboard.md`, `Fork Divergence.md`, `Lifecycle Compliance.md`, `Spec Flow Lifecycle.canvas`.

```
Read /Volumes/DATA/GitHub/DocVault/Projects/SpecFlow/Overview.md
```

When making changes that affect documented behavior, run `/vault-update` before pushing.

## Architecture

This repo is symlinked into the Claude Code plugin directory. Building here updates the MCP server directly — no sync step needed.

```
/Volumes/DATA/GitHub/specflow/              <-- you are here (canonical source)
    symlinked as:
~/.claude/plugins/marketplaces/specflow-marketplace/
    loaded by MCP via:
~/.claude/plugins/cache/.../dist/index.js
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
```

## Two Parsers - Keep in Sync

- `src/core/parser.ts` -- used by MCP tools (spec-status, spec-list, etc.)
- `src/dashboard/parser.ts` -- used by the dashboard UI server

If you change how specs are parsed, update BOTH parsers.

## Build and Deploy

```bash
npm run build        # Compiles src/ -> dist/, copies static assets
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

## Adding a New Tool

1. Create `src/tools/my-tool.ts` -- export a `Tool` object + handler function
2. Register in `src/tools/index.ts` -- add to `registerTools()` array + `handleToolCall()` switch
3. `npm run build`

## Adding a New Prompt

1. Create `src/prompts/my-prompt.ts` -- export a `PromptDefinition`
2. Register in `src/prompts/index.ts`
3. `npm run build`

## Consumers

This plugin is loaded by every project: StakTrakr, HexTrackr, StakTrakrApi, MyMelo, WhoseOnFirst, Playground. Changes here affect all of them. Test carefully.
