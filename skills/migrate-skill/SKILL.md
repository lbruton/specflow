---
name: migrate-skill
description: >
  Migrate a user-level skill into the specflow plugin's skills directory.
  Use when porting a proven skill from ~/.claude/skills/ to the plugin for
  distribution. Covers generic vs project-specific classification, MCP prompt
  extraction, deprecation of user-level shims, and verification.
---

# Migrate Skill — User-Level to Plugin

Moves a proven skill from `~/.claude/skills/<name>/` into `specflow/skills/<name>/SKILL.md`
so it ships with the plugin and works across all projects.

## Critical Distinction: MCP Prompts vs Plugin Skills

MCP prompts (`src/prompts/*.ts`) return messages Claude treats as **suggestions** — it may
reorder, skip, or reinterpret steps. Plugin skills (`skills/*/SKILL.md`) are **instructions**
Claude follows literally. This distinction caused the prime P1 incident.

**Rule:** Session commands (`/prime`, `/wrap`, `/audit`) and any workflow with strict step
ordering MUST be plugin skills, not MCP prompts. MCP prompts are appropriate for contextual
templates used within workflows (`create-spec`, `implement-task`, etc.).

---

## Step 1: Pre-check — Generic or Project-Specific?

Ask before migrating:

- **Generic** — the skill works identically across all projects (e.g., `/prime`, `/wrap`,
  `/audit`, `/gsd`). Migrate to `specflow/skills/<name>/SKILL.md` only.
- **Project-specific** — the skill needs per-project customization (e.g., `/ui-mockup` for
  StakTrakr has project-specific design tokens). Create BOTH:
  - A generic version in `specflow/skills/<name>/SKILL.md`
  - A project-level override in `<project>/.claude/skills/<name>/SKILL.md`

If unsure, start generic — project overrides can be added later.

---

## Step 2: Gather Source Material

Run all of these in parallel:

```bash
# 2a. Read the current user-level skill
cat ~/.claude/skills/<name>/SKILL.md

# 2b. Check for deprecated/legacy versions
ls ~/.claude/skills/_deprecated/<name>/ 2>/dev/null

# 2c. Check if an MCP prompt exists for this command
ls /Volumes/DATA/GitHub/specflow/src/prompts/<name>.ts 2>/dev/null
```

If an MCP prompt file exists (2c), read it — the prompt text contains the workflow logic
that needs to be merged into the plugin skill.

If deprecated versions exist (2b), read them for context but prefer the current version.

---

## Step 3: Combine and Write

Build the plugin skill by merging content from all sources:

| Source | What to Extract |
|--------|----------------|
| User-level shim (`~/.claude/skills/<name>/SKILL.md`) | Pre-flight checks, post-flight steps, any wrapper logic |
| MCP prompt (`src/prompts/<name>.ts`) | Core workflow steps — the prompt message content IS the workflow |
| Deprecated skill (`~/.claude/skills/_deprecated/<name>/`) | Historical context, any logic lost in the shim migration |

Write the combined skill to:

```
/Volumes/DATA/GitHub/specflow/skills/<name>/SKILL.md
```

Requirements for the file:
- YAML frontmatter with `name` and `description` (match the style in `skills/prime/SKILL.md`)
- `description` must include trigger words for autocomplete matching
- Self-contained — do NOT reference `specflow:<name>` MCP prompt (it will be removed)
- All workflow steps inline, in the order Claude must execute them

---

## Step 4: Remove MCP Prompt (if applicable)

If the skill was backed by an MCP prompt in `src/prompts/<name>.ts`:

1. Delete `src/prompts/<name>.ts`
2. Remove its import and registration from `src/prompts/index.ts`
3. Run `npm run build` — verify compilation succeeds with zero errors
4. Grep for any remaining references: `grep -r "specflow:<name>" ~/.claude/`

Skip this step if the skill was never an MCP prompt.

---

## Step 5: Deprecate User-Level Skill

Move the old user-level skill to the deprecated directory:

```bash
mkdir -p ~/.claude/skills/_deprecated/<name>
mv ~/.claude/skills/<name>/SKILL.md ~/.claude/skills/_deprecated/<name>/shim-SKILL.md
rmdir ~/.claude/skills/<name>/ 2>/dev/null
```

The `shim-` prefix distinguishes it from any legacy pre-shim versions already in
`_deprecated/`.

---

## Step 6: Build, Commit, Push

```bash
cd /Volumes/DATA/GitHub/specflow
npm run build
git add skills/<name>/SKILL.md
git add src/prompts/ # if MCP prompt was removed
git commit -m "feat(skills): migrate /<name> from user-level to plugin skill"
git push origin main
```

---

## Step 7: Verify

1. Start a **new** Claude Code session (skills are loaded at session start)
2. Type `/<name>` — confirm it autocompletes
3. Run it — confirm the plugin skill executes (not the old shim)
4. Check that no `specflow:<name>` MCP prompt appears in the skill list

If autocomplete shows the old shim instead of the plugin skill, check that Step 5
fully removed the user-level copy.

---

## Checklist Summary

```
[ ] Pre-check: generic vs project-specific classification
[ ] Read user-level skill, deprecated versions, and MCP prompt source
[ ] Write combined skill to specflow/skills/<name>/SKILL.md
[ ] If project-specific: also write <project>/.claude/skills/<name>/SKILL.md
[ ] If MCP prompt existed: delete .ts file, update index.ts
[ ] npm run build — zero errors
[ ] Deprecate user-level skill to _deprecated/<name>/shim-SKILL.md
[ ] Commit and push
[ ] New session: verify autocomplete and execution
```
