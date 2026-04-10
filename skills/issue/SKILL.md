---
name: issue
description: >
  Vault-based issue management — create, read, update, and list issues stored as
  markdown files in DocVault. Handles counter increment, sub-issue creation, and
  GitHub issue sync for user-facing scope. Triggers on: "create issue", "issue",
  "new issue", "new bug", "file a bug", "track this"
user-invocable: true
---

# Issue Management — Vault-Based

Issues are markdown files with YAML frontmatter stored in DocVault. No external service dependency.

## Setup

**DocVault path:** Set `{DOCVAULT_ROOT}` to your DocVault root (e.g. `/path/to/DocVault`).
Each project reads its issue prefix from `.claude/project.json`:

```json
{ "issuePrefix": "MYPRJ", "issueTag": "myproject" }
```

Issues are stored at `{DOCVAULT_ROOT}/Projects/{ProjectName}/Issues/`.

## Schema Reference

Full schema, field definitions, and valid values: `{DOCVAULT_ROOT}/Templates/issue-schema.md`

## Prefix Registry

Each project has its own prefix. Add yours to `.claude/project.json` and your DocVault:

| Prefix | Project | Path | Tag |
|--------|---------|------|-----|
| `SWF` | SpecFlow | `Projects/SpecFlow/Issues/` | `specflow` |
| `MYPRJ` | _(your project)_ | `Projects/{ProjectName}/Issues/` | `{tag}` |

Also available in each project's `.claude/project.json` as `issuePrefix` and `issueTag`.

---

## Creating an Issue

### Step 1: Determine project

Read `.claude/project.json` in the current working directory:

```bash
cat .claude/project.json 2>/dev/null
```

Extract `issuePrefix` and `issueTag`. If not present, infer from context (mentioned project name, current directory, or description content).

### Step 2: Read and increment counter

```bash
cat {DOCVAULT_ROOT}/Projects/{project}/Issues/_counter.md
```

Read the `next` value from frontmatter. This is the issue number to use.

### Step 3: Write issue file

Write the issue markdown file to:

```
{DOCVAULT_ROOT}/Projects/{project}/Issues/{PREFIX}-{NUM}.md
```

**CRITICAL: Use this exact frontmatter structure.** Obsidian Bases filters depend on every field being present, correctly typed, and properly quoted. Missing or misformatted fields will silently exclude the issue from Bases views.

```yaml
---
id: "{PREFIX}-{NUM}"
title: "Issue title here"
description: "One-sentence summary of the issue"
type: feature
scope: internal
status: backlog
priority: 3
github_issue:
assignee: {your-username}
created: "{YYYY-MM-DD}"
updated: "{YYYY-MM-DD}"
completed:
due:
tags:
  - issue
  - "{project_tag}"
---
```

**Field rules:**
- `id`: **MUST be quoted** — `"SWF-63"` not `SWF-63` (Obsidian Bases requires consistent string type for filtering; unquoted values with mixed alphanumeric content are valid YAML strings but Bases may mishandle them)
- `title`: **MUST be quoted** — contains special characters
- `created` / `updated`: **MUST be quoted** — `"2026-04-04"` not `2026-04-04` (YAML parses unquoted as date object)
- `type`: `feature` | `bug` | `chore` | `spike`
- `scope`: `user-facing` | `internal`
- `status`: `backlog` (default) or `todo`
- `priority`: numeric 1-4 (1=critical/blocking, 2=high, 3=medium, 4=low/nice-to-have). Default 3 if not obvious.
- `github_issue`: leave empty (set only for inbound GH bugs)
- `completed` / `due`: leave empty (set when status changes)
- `tags`: **MUST include `issue`** — Bases filters on this tag. Add `{project_tag}` second.

### Step 3.5: Link related documentation

After writing the issue file, identify vault documentation pages related to this issue and add them to the `## Related Documentation` section as wikilinks.

**How to find related pages:**

1. List all non-issue `.md` files in the project's vault directory:
   ```bash
   find {DOCVAULT_ROOT}/Projects/{project}/ -name "*.md" -not -path "*/Issues/*" -not -name "_*"
   ```

2. Match pages to the issue by:
   - **Title/keyword overlap** — issue title mentions "Cloud Sync" → link `[[Cloud Sync]]`
   - **Scope match** — issue touches frontend → link `[[Frontend Overview]]`
   - **Architecture impact** — issue changes data flow → link `[[Architecture]]`

3. Add 1-5 relevant links (don't over-link). Each link should include a brief reason:
   ```markdown
   ## Related Documentation

   - [[Cloud Sync]] — retry logic lives here
   - [[Architecture]] — sync flow may change
   ```

4. If no documentation pages are clearly related, leave the section with the template comment. Not every issue needs doc links.

### Step 4: Increment counter

Update `_counter.md` — set `next` to `{NUM + 1}`.

### Step 5: GitHub issue (inbound only)

**GitHub Issues are an inbound-only public bug inbox.** Never create GitHub issues from
vault issues. All tracking lives in DocVault — users see fixes via the changelog.

- Do NOT create a GitHub issue when creating a vault issue (regardless of scope or type)
- The `github_issue` field is only set when triaging an inbound GH issue filed by a user

**Inbound GitHub issues (public bug reports):**
When a user files a bug on GitHub, triage it into a vault issue:
1. Create the vault issue with `scope: user-facing`, `type: bug`
2. Set `github_issue` to the GH issue number
3. Reply on the GH issue acknowledging receipt
4. Close the GH issue when the vault issue reaches `done`

### Step 5.5: Validate frontmatter (HARD GATE)

After writing the issue file, **read it back** and verify against the template. This is the #1 source of Bases visibility bugs — silently broken issues that don't appear in views.

**Read the file back and check ALL of these:**

1. **All required fields present:** `id`, `title`, `type`, `scope`, `status`, `priority`, `github_issue`, `assignee`, `created`, `updated`, `completed`, `due`, `tags`
2. **Quoting correct:**
   - `id` value is quoted: `id: "SWF-63"` (NOT `id: SWF-63`)
   - `created` value is quoted: `created: "2026-04-04"` (NOT `created: 2026-04-04`)
   - `updated` value is quoted: `updated: "2026-04-04"` (NOT `updated: 2026-04-04`)
   - `title` value is quoted
3. **Tags include `issue`:** The first tag MUST be `issue` — Bases filters on this
4. **Priority is numeric:** `1`, `2`, `3`, or `4` (NOT `P1`, `P2`, etc.)
5. **Empty fields present:** `github_issue:`, `completed:`, `due:` must exist even if empty

**Valid values:**
- `status`: `backlog`, `todo`, `in-progress`, `in-review`, `done`, `canceled`
- `type`: `feature`, `bug`, `chore`, `spike`
- `scope`: `user-facing`, `internal`

If ANY field is missing, unquoted when it should be quoted, or has an invalid value, **fix it before proceeding**. Do NOT skip this check. An issue that doesn't appear in Bases is effectively invisible.

### Step 6: Confirm

```
Created {PREFIX}-{NUM}: {title}
  Type:     {type}
  Scope:    {scope}
  Priority: {priority}
  Path:     {DOCVAULT_ROOT}/Projects/{project}/Issues/{PREFIX}-{NUM}.md
  GitHub:   #{github_issue} (if user-facing)
```

---

## Creating Sub-Issues

Sub-issues use letter suffixes: `{PREFIX}-{NUM}-A`, `{PREFIX}-{NUM}-B`, etc.

### Step 1: Find parent issue

Read the parent issue file to get context and determine the next available letter.

```bash
ls {DOCVAULT_ROOT}/Projects/{project}/Issues/{PREFIX}-{NUM}-*.md 2>/dev/null
```

### Step 2: Write sub-issue file

Use the template from `{DOCVAULT_ROOT}/Templates/issue-sub.md`:

```
{DOCVAULT_ROOT}/Projects/{project}/Issues/{PREFIX}-{NUM}-{LETTER}.md
```

Include `parent: "[[{PREFIX}-{NUM}]]"` in frontmatter and add `issue/sub` to tags.

### Step 3: Update parent

Add the sub-issue wikilink to the parent's `## Sub-Issues` section.

**Sub-issues do NOT increment the counter.**

---

## Reading an Issue

Given an issue ID (e.g., `SWF-42`):

1. Parse the prefix to determine the project (use prefix registry)
2. Read the file (check root first, then Closed/):
   ```bash
   cat {DOCVAULT_ROOT}/Projects/{project}/Issues/{ISSUE-ID}.md 2>/dev/null || \
   cat {DOCVAULT_ROOT}/Projects/{project}/Issues/Closed/{ISSUE-ID}.md
   ```

---

## Updating an Issue

### Status changes

**Preferred: Obsidian CLI property:set** (if Obsidian is running):

> **macOS only** — the path below is the standard macOS install location. On other
> platforms locate your Obsidian binary manually (e.g. `which obsidian` or check your
> applications directory). If Obsidian is not installed, use the Fallback below.

```bash
OBS='/Applications/Obsidian.app/Contents/MacOS/obsidian'
$OBS vault="DocVault" property:set name="status" value="done" path="Projects/{project}/Issues/{ISSUE-ID}.md"
$OBS vault="DocVault" property:set name="updated" value="$(date +%Y-%m-%d)" path="Projects/{project}/Issues/{ISSUE-ID}.md"
$OBS vault="DocVault" property:set name="completed" value="$(date +%Y-%m-%d)" path="Projects/{project}/Issues/{ISSUE-ID}.md"
```

**Fallback:** Edit the issue file's frontmatter directly:
- Update `status` field
- Update `updated` date
- If status → `done`: set `completed` date

**Close-move rule:** When status changes to `done`, `canceled`, or `superseded`, move the file to `Closed/`:

```bash
ISSUE_FILE="{DOCVAULT_ROOT}/Projects/{project}/Issues/{ISSUE-ID}.md"
CLOSED_DIR="$(dirname "$ISSUE_FILE")/Closed"
mkdir -p "$CLOSED_DIR"
git mv "$ISSUE_FILE" "$CLOSED_DIR/$(basename "$ISSUE_FILE")"
```

If the file is untracked (not yet committed), use `mv` instead of `git mv`.

### Bulk status update

```bash
# Find all in-progress issues for a project
# Note: status values may be quoted ("in-progress") or unquoted — use .* to handle both
grep -rl 'status:.*in-progress' {DOCVAULT_ROOT}/Projects/{project}/Issues/
```

---

## Listing Issues

### Preferred: Obsidian CLI base:query (structured JSON)

If Obsidian is running, use the CLI for structured issue queries — much richer than grep:

> **macOS only** — adjust `OBS` path for your platform if needed.

```bash
OBS='/Applications/Obsidian.app/Contents/MacOS/obsidian'

# All issues for a project (returns JSON with status, priority, type, days open, tags)
$OBS vault="DocVault" base:query path="Projects/{project}/Issues/Issues.base" format=json

# Cross-project view (all issues)
$OBS vault="DocVault" base:query path="Issues.base" format=json
```

This returns structured data per issue: `path`, `Issue`, `title`, `type`, `Priority`, `status`, `Days Open`, `due`, `tags`.

### Fallback: grep (when Obsidian isn't running)

```bash
# Note: status values may be quoted or unquoted in YAML frontmatter — use .* to handle both
grep -rl 'status:.*\(backlog\|todo\|in-progress\|in-review\)' {DOCVAULT_ROOT}/Projects/{project}/Issues/ 2>/dev/null
```

---

## Issue Creation Rules

Every code change needs an issue. Exceptions: instruction-file-only changes
(CLAUDE.md, AGENTS.md, skills) and `/gsd` sessions (casual fixes below spec threshold).

Issue ID goes in commit message, PR body, and version lock claim.

---

## GitHub Issues Policy

**GitHub Issues are an inbound-only public bug inbox — not a planning tool.**

- New GitHub issues from users are triaged into vault issues on receipt
- NEVER create GitHub issues from vault issues — all tracking is vault-only
- Users see fixes via the changelog, not via GitHub issue updates
- When an inbound GH issue's vault counterpart reaches `done`, close the GH issue with a comment referencing the fix commit
