---
name: publish-templates
description: Publish specflow template changes from DocVault → src/markdown/templates → npm. The DocVault Templates folder is the editable source of truth; this skill propagates changes through the build/test/commit/publish pipeline. Mandatory backup-before-edit. Stops before `npm publish` for manual auth. Triggers on "publish templates", "ship template changes", "promote template", "sync templates to npm".
---

# /publish-templates — DocVault → npm template publish pipeline

## Why this skill exists

After INC-002 and the 2026-04-07 recovery sprint, specflow templates have a clear source-of-truth hierarchy:

```
DocVault/Projects/SpecFlow/Templates/{name}-guide.md   ← editable (here)
            ↓
specflow/src/markdown/templates/{name}.md              ← machine source
            ↓ (npm build)
specflow/dist/markdown/templates/{name}.md             ← bundled
            ↓ (npm publish)
@lbruton/specflow on npm                               ← consumed via npx
            ↓ (MCP server boot)
DocVault/specflow/{project}/templates/{name}.md        ← runtime copies
```

This skill is the automation that walks the top half of that pipeline. It reads the canonical codeblocks from the DocVault guide pages, writes them to `src/markdown/templates/`, runs build/test/commit/push, and stops before `npm publish` for manual auth.

## Source of truth rule (HARD)

**ALWAYS edit `DocVault/Projects/SpecFlow/Templates/{name}-guide.md` first, then run this skill.**

Never edit `src/markdown/templates/*.md` directly. Never edit `DocVault/specflow/{project}/templates/*.md` (those are runtime copies overwritten on every MCP boot until SWF-95 lands).

If you find drift between a guide page and `src/`, the guide page is canonical.

## Steps

### Step 1 — Backup current src/ state (MANDATORY)

```bash
DATE=$(date +%Y-%m-%d_%H%M%S)
BACKUP_DIR=~/Nextcloud/Backups/specflow-templates
mkdir -p "$BACKUP_DIR"
cd "$(git rev-parse --show-toplevel)"  # the specflow repo
zip -r "$BACKUP_DIR/specflow-templates-$DATE.zip" src/markdown/templates/
```

If the zip fails or the file isn't created, **STOP**.

### Step 2 — Extract codeblocks from each guide page

For each of the 9 guide pages, extract the content between ` ```markdown ` and ` ``` ` fences in the `## Canonical Content` section. Write to `src/markdown/templates/{name}.md` (strip `-guide` suffix).

### Step 3 — Diff check

```bash
cd "$(git rev-parse --show-toplevel)"  # the specflow repo
git diff --stat src/markdown/templates/
```

If no changes: STOP and report "DocVault is already in sync with src/". Otherwise, show the diff to the user and wait for approval.

### Step 4 — Build and test

```bash
npm run build 2>&1 | tail -20
npm test 2>&1 | tail -10
```

Both must succeed.

### Step 5 — Bump version

Read `package.json`, increment patch version, refresh `package-lock.json`:

```bash
npm install --package-lock-only 2>&1 | tail -5
```

### Step 6 — Commit

```bash
git add src/markdown/templates/ package.json package-lock.json
git commit -m "feat(templates): sync from DocVault Templates folder to src/"
```

### Step 7 — Push

```bash
git push origin main
```

### Step 8 — STOP for manual `npm publish`

This system uses passkey authentication for npm. The skill CANNOT run `npm publish` directly. Tell the user to run it manually and wait for confirmation.

### Step 9 — Verify and clear cache

```bash
npm view @lbruton/specflow version
find ~/.npm/_npx -path "*/specflow/package.json" -exec dirname {} \; 2>/dev/null | xargs -I{} rm -rf {}
```

### Step 10 — Update DocVault guide pages

Update `last_synced` and `specflow_version` frontmatter in each changed guide page. Add a Change Log entry. Commit DocVault changes directly to main.

### Step 11 — Report

Backup zip path, templates changed, new version, npx cache cleared, DocVault guide pages updated.

## Failure modes

See the user-level skill for the full failure mode table. Key ones:
- Backup zip not created → STOP, fix mount/space/perms
- `npm publish` 401/404 → expected, hand off to user
- `npm view` shows old version → wait 30s, retry once

## Related

- `DocVault/Projects/SpecFlow/Templates/README.md` — source-of-truth hierarchy
- mem0 `feedback_npm_publish_passkey.md` — passkey constraint
- specflow CLAUDE.md "Plugin Skills vs Production Skills — NEVER Symlink" — this file is a manual copy of the user skill, not a symlink
