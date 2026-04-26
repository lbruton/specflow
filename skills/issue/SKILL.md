---
name: issue
description: >
  Issue management — create, read, update, list. Backend is driven by
  `.specflow/config.json` `issue_backend` field: `plane` (Plane MCP, primary
  going forward) or `docvault` (legacy markdown — for projects not yet migrated).
  Triggers on: "create issue", "issue", "new issue", "new bug", "file a bug",
  "track this".
user-invocable: false
---

# Issue Management — Backend-Aware

This skill dispatches based on the project's `.specflow/config.json`. Read it first; everything else follows.

## Step 0 — Read project config

```bash
cat .specflow/config.json
```

Extract:
- `project` — display name
- `issue_prefix` — e.g. `SFLW`, `HOME`, `DEVS`
- `issue_backend` — `"plane"` or `"docvault"` (default if absent: `"docvault"`)
- `plane_workspace` — only when backend is plane (e.g. `"lbruton"`)
- `plane_project_id` — only when backend is plane (uuid)

If `issue_backend` is missing or `"docvault"` → jump to **DocVault legacy path** at the bottom.
If `issue_backend` is `"plane"` → continue here.

---

## Plane backend — primary path

All operations route through `mcp__plane__*` tools. No counter file, no sub-issue letter convention, no `_Index.md` to maintain — Plane handles all of that.

### Create

1. **Resolve state and label IDs once per session:**

   ```
   mcp__plane__list_states   project_id: {plane_project_id}
   mcp__plane__list_labels   project_id: {plane_project_id}
   ```

   Map names → uuids. Cache for the rest of the session.

2. **Pick state and label from user intent:**

   | Intent | State | Label |
   |---|---|---|
   | New backlog item | `Backlog` | based on type |
   | Ready to work | `Todo` | based on type |
   | Active work | `In Progress` | based on type |

   Type → label map (matches conventional commits):

   | Type | Label |
   |---|---|
   | `feature`, `feat` | `Feature` |
   | `bug`, `fix` | `Bug` |
   | `chore` | `Chore` |
   | `docs`, `documentation` | `Documentation` |
   | `patch`, `hotfix` | `Patch` |

3. **Create the issue:**

   ```
   mcp__plane__create_issue
     project_id: {plane_project_id}
     issue_data:
       name: "{title}"
       description_html: "{html-rendered description}"
       state: {state_uuid}
       labels: [{label_uuid}]
       priority: "urgent"|"high"|"medium"|"low"|"none"
   ```

   Plane assigns `sequence_id` automatically — capture from the response. The full issue ID is `{issue_prefix}-{sequence_id}` (e.g. `SFLW-8`).

4. **Confirm:**

   ```
   Created {issue_prefix}-{sequence_id}: {title}
     URL: https://plane.lbruton.cc/lbruton/projects/{plane_project_id}/issues/{issue_uuid}
     State: {state}
     Labels: {labels}
     Priority: {priority}
   ```

### Read

```
mcp__plane__get_issue_using_readable_identifier
  project_identifier: {issue_prefix}
  issue_identifier: {sequence_id}    # e.g. "8" for SFLW-8
```

Returns `name`, `description_html`, `state` (uuid), `labels` (uuid array), `priority`, `created_at`, etc. To turn the state/label UUIDs into names, resolve via the cached `list_states` / `list_labels` from the Create flow. The Plane workspace is baked into the MCP server's startup config — the tool does not accept a `workspace_slug` parameter.

### Update / close

Status change:

```
mcp__plane__update_issue
  project_id: {plane_project_id}
  issue_id: {issue_uuid}
  issue_data:
    state: {new_state_uuid}
```

For closing: set state to `Done` (or `Cancelled` for cancellation). Plane records `completed_at` automatically.

### List

```
mcp__plane__list_project_issues
  project_id: {plane_project_id}
```

Filter client-side on state group (`backlog` / `unstarted` / `started` / `completed` / `cancelled`) as needed.

### Notes for the Plane path

- **No counter file.** Plane assigns `sequence_id` atomically; nothing to increment locally.
- **No sub-issue letter suffix.** Plane has first-class parent-child issues — pass `parent: {parent_uuid}` to `create_issue` and the child gets its own normal sequence_id (e.g. `SFLW-9` with parent `SFLW-3`), not a letter suffix.
- **No GitHub triage step.** Plane's GitHub integration is configured at the workspace level. If the project has it wired up, syncing is automatic. Inbound GH bugs that need ingestion can be created directly in Plane via the same `create_issue` call.
- **Related documentation wikilinks** are no longer maintained by this skill — they were a DocVault construct. If you want to cross-reference vault docs, paste the wikilink into the Plane issue's description (Plane preserves markdown).

---

## Prefix Registry (Plane backend)

| Prefix | Project | Plane project_id |
|---|---|---|
| `HOME` | HomeNetwork | `6d660454-a709-49d5-8b6c-a580f90170ee` |
| `DEVS` | Devops | `84abb46d-4032-40a4-aeee-e20cab6cb828` |
| `SFLW` | SpecFlow | `72fd0b33-6719-47fa-92a5-97e9ba511f32` |
| _(others)_ | _migrating per `~/.claude/CLAUDE.md` §12_ | _TBD_ |

Authoritative source: each project's `.specflow/config.json`. The table above is a convenience.

---

## DocVault legacy path

For projects with `issue_backend: "docvault"` or no `issue_backend` field. **This path is being retired.** New work should target Plane; only use this when the project hasn't been migrated yet (see `~/.claude/CLAUDE.md` §12 for migration status).

### Create

1. Read `${DOCVAULT_PATH}/Projects/{project}/Issues/_counter.md`, take `next` value.
2. Write `${DOCVAULT_PATH}/Projects/{project}/Issues/{PREFIX}-{NUM}.md` using the schema at `${DOCVAULT_PATH}/Templates/issue-schema.md` (full field list and quoting rules live there).
3. Increment counter: set `next: {NUM + 1}` in `_counter.md`.
4. Update `_Index.md` atomically (per CLAUDE.md §11 rule).

Critical frontmatter rules (most-broken):
- `id`, `title`, `created`, `updated` MUST be quoted strings.
- `doc_type: issue` (required for Bases visibility — never put `issue` in tags).
- `priority`: numeric `1`–`4`.

### Read / update / list / close

- **Read:** `cat ${DOCVAULT_PATH}/Projects/{project}/Issues/{ID}.md` (check root, then `Closed/`).
- **Status update:** edit the file's frontmatter; update `updated` and (if done) `completed`.
- **Close-move:** `git mv` the file from `Issues/` into `Issues/Closed/`; update both `_Index.md` files atomically in the same commit.
- **List:** `grep -rl 'status:.*\(backlog\|todo\|in-progress\|in-review\)' ${DOCVAULT_PATH}/Projects/{project}/Issues/ 2>/dev/null`.

Sub-issues use letter suffixes (`SWF-12-A`, `SWF-12-B`) and don't increment the counter. Add `parent: "[[SWF-12]]"` to frontmatter; update parent's `## Sub-Issues` section.

### Legacy notes

- GitHub Issues are inbound-only — never create from vault issues. Triage inbound GH bugs into vault issues with `scope: user-facing` and `github_issue: {gh-number}`.
- Issues prior to 2026-03-13 lived in Linear; old prefixes (STAK-, HEX-, DEV-, HKF-, API-, WHO-) reference valid Linear issues. The vault numbered onward from there.

---

## Issue Creation Rules

Every code change needs an issue (regardless of backend). Exceptions: instruction-file-only edits (CLAUDE.md, skills) and `/gsd` sessions for trivial fixes.

The issue ID format `{PREFIX}-{NUM}` is identical between backends — commit messages, PR bodies, and version lock claims work the same way for both.

---

## Migration

Status of each project's migration: `~/.claude/CLAUDE.md` §12. If a project's `.specflow/config.json` doesn't have `issue_backend` yet but §12 lists it as ✅ migrated, that's a config-drift bug — flag it and add the missing fields rather than silently routing to DocVault.
