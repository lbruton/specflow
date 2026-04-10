---
name: wrap
description: >
  End-of-session orchestrator — verifies session work, writes a template-enforced session
  digest to DocVault, and saves a curated summary to mem0. Run after /retro (or
  /pr-cleanup → /retro if a PR was merged). Replaces /goodnight and /digest-session.
  Triggers: "wrap", "wrap up", "close session", "end of session", "done for the night",
  "finish up", "closing time".
---

# Wrap Session

End-of-session orchestrator. Run the entire flow autonomously without asking the user
for permission between steps. The user invoked `/wrap` once — that is the permission.

## Recommended end-of-session flow

```
With PR merged this session:   /pr-cleanup → /retro → /wrap
Without PR:                    /retro → /wrap
Quick re-orient only:          /start  (no wrap needed)
```

`/wrap` focuses on the session digest and mem0 summary. Retro lessons are captured by
`/retro`. If `/retro` was NOT run before `/wrap`, wrap will run retro inline automatically.

## Arguments

- **--handoff**: Pass `--handoff` if work continues in a new terminal. Adds a `Handoff Notes`
  section to the digest with a required Continue Issue ID.

---

## DocVault path convention

All paths in this skill that reference DocVault use `../DocVault/` relative to the current
project root. By spec-workflow convention, **DocVault lives one directory up from every
project folder, as a sibling**. For example, if your project is at
`~/code/MyProject/`, DocVault is at `~/code/DocVault/`. No configuration — the layout is
fixed. If your DocVault lives elsewhere, adjust the paths below for your environment.

---

## Design Principle (read this first — it governs everything below)

Earlier versions of `/wrap` used five gated phases with mandatory approval prompts between
each one. That over-corrected for prompt drift by stopping the agent every few steps to ask
the user "is it OK to continue?" — which shifted the burden from *verification* to
*permission*. The user shouldn't have to babysit a wrap-up.

This version replaces the gates with a **template-enforced digest**. The digest file has
required sections (Summary / Retro Lessons / Git State / Session Health / Next Session); if
any section is empty or missing, the wrap is broken. The agent cannot finish the wrap
without filling every section, and that artifact-shape requirement does the work that the
gates used to do — without ever stopping to ask permission.

**Three rules that follow from this:**

1. **Run the whole flow in one shot.** No "STOP HERE", no "wait for user acknowledgment",
   no phase banners. Just observe → retro → write digest → report.
2. **Take action autonomously where the action is obvious.** If a task was marked `[x]`
   without `log-implementation`, run `log-implementation` *now* — do not ask. If main is
   behind origin and the working tree is clean, pull — do not ask. If a worktree has
   uncommitted changes, *do not* delete it and *do not* ask — just report it as a soft
   warning.
3. **All warnings live in the Session Health block at the end.** Never interrupt the flow
   with a yellow/red issue mid-stream. Report once, at the bottom, in one place.

---

## The Flow

Run these steps in order. Steps 1, 4, and 6 do parallel work internally; otherwise the
order matters because each step uses earlier results.

### Step 1 — Observe (parallel)

Gather all the state in one parallel batch. No analysis yet, just collection.

```bash
git status --short
git branch --show-current
git log --oneline @{u}..HEAD 2>/dev/null    # commits ahead of remote
git log --oneline HEAD..@{u} 2>/dev/null    # commits behind remote (we may need to pull)
git stash list
git worktree list
gh pr list --author "@me" --state all --search "updated:>=$(date -v-1d +%Y-%m-%d)" --json number,title,headRefName,state,mergedAt
```

Plus, if `.specflow/config.json` exists, call the **spec-list** MCP tool (no args) to
check for in-progress specs across the project. Do NOT call `spec-status` without a
`specName` — it requires the spec name as a mandatory argument and crashes without it
(see SWF-93). `spec-list` is the correct tool for "are there any in-progress tasks?".

Hold the results in working memory for later steps. Do not display them yet.

### Step 2 — Implementation log catch-up (autonomous)

If spec-workflow is active and any task was marked `[x]` during this session without a
matching `log-implementation` call, run `log-implementation` now for each missing entry.
Do not ask permission — this is a correctness fix, not a judgment call.

If no spec-workflow tasks were touched this session, skip.

### Step 3 — Retro check (autonomous)

Check whether `/retro` was already run this session by querying mem0 for recent
`retro-learning` entries:

First detect the current project tag:

```bash
cat .claude/project.json 2>/dev/null | grep -o '"issueTag"[^,}]*' | cut -d'"' -f4 \
  || basename $(git rev-parse --show-toplevel 2>/dev/null) | tr '[:upper:]' '[:lower:]'
```

Then search mem0, scoped to this project:

```
mcp__mem0__search_memories(
  query: "retro-learning",
  user_id: "<your-mem0-user-id>",
  filters: { "metadata.type": "retro-learning", "metadata.project": "<project-tag>" },
  limit: 5
)
```

Inspect the `created_at` timestamps. If any `retro-learning` entries for **this project**
were added within the last 60 minutes, retro was already run — **skip this step** and note
`_(completed via /retro)_` in the digest's Retro Lessons section.

If no recent retro entries are found, run retro inline now:

Scan the conversation for high-signal lessons and save them to mem0. Target 3-8 entries.

Look for:
- **Mistakes** that cost time or caused rework
- **Wrong assumptions** that led you astray
- **Successful approaches** worth repeating
- **User preferences** expressed during the session
- **Codebase gotchas** discovered (tricky code, hidden dependencies, surprising behavior)
- **Process improvements** — things that should be done differently next time

For each lesson, save to mem0:

```
mcp__mem0__add_memory(
  text: "<single prescriptive sentence — action verb or 'When X, do Y' format>",
  user_id: "<your-mem0-user-id>",
  agent_id: "<project-tag from .claude/project.json>",
  metadata: {
    "type": "retro-learning",
    "category": "<error|pattern|preference|improvement|warning|win>",
    "source": "retro",
    "project": "<project-name>"
  }
)
```

**Critical (SWF-90):** Always set `metadata.project: "<tag>"` — this is the only
project-scoping field mem0 v1 API actually persists as queryable. The top-level `agent_id`
parameter is silently dropped. Setting both is fine but `metadata.project` is what makes
the record findable.

**Actor attribution (strict):**
- Things the user did: "the user prefers/uses/instructs..." (or use the user's real name/handle if known)
- Things Claude did: "Claude should..."
- Codebase facts: passive voice or component name
- Never use generic placeholder names ("User", "Alice", "Bob") — use a real identifier or "the user" / "this user"

Hold the list of lessons in working memory — they go into the digest in Step 5.

### Step 4 — DocVault sync check (autonomous, conditional)

If code was changed this session AND the change affects documented behavior, update the
relevant DocVault page now. Identify which pages are affected (architecture, API,
features, etc.), read them, update them, commit directly to main.

DocVault commits use direct commits to main, no PR needed. Do not push the project repo
yet — that's the user's call, after they review the wrap.

If no documentation impact, skip.

### Step 5 — Compute Session Health (autonomous)

Using the Step 1 data, derive the four Session Health checks:

| Check | Question | Pass criteria |
|---|---|---|
| **Commits committed** | Are all this session's changes committed? | `git status --short` is empty |
| **Local in sync** | Is local main ahead/behind origin? | `git log @{u}..HEAD` empty AND `git log HEAD..@{u}` empty |
| **Session PR status** | Did this session merge a PR? If yes, did we pull main? | If session-merged PR exists, local main matches origin AFTER pull |
| **Worktrees clean** | Any worktrees with uncommitted changes or stale merged branches? | `git worktree list` shows only main + worktrees with clean state |

**Action allowed in this step:** If local main is *behind* origin and the working tree is
clean and the current branch is main, run `git pull --ff-only` autonomously. This is the
"if the PR has been merged, pull the changes back down" rule from the redesign discussion.

**Action NOT allowed:** Anything that touches uncommitted user work — no auto-commit, no
auto-stash, no auto-discard, no `git checkout --`, no worktree deletion. Those become
warnings, not actions.

Compute the traffic-light color:
- **🟢 Green** — all four checks pass
- **🟡 Yellow** — one or more soft warnings (uncommitted files, stale worktrees, PR open
  with passing checks, etc.) but nothing broken
- **🔴 Red** — something is genuinely wrong (PR with failing checks, log-implementation
  catch-up failed, mem0 write failed, etc.)

### Step 6 — Write the digest (TEMPLATE-ENFORCED — this is the gate)

This is the artifact that replaces the old phase gates. The digest MUST contain every
section listed in the template below. Missing sections = broken wrap. Empty sections =
broken wrap. Do not abbreviate, do not omit, do not "skip if N/A" — write `_(none)_` if a
section legitimately has nothing to report, but the heading must exist.

**Path:** `../DocVault/Daily Digests/<ProjectFolder>/<YYYY-MM-DD>.md`

`<ProjectFolder>` maps to the project name (the basename of the current project
directory, preserving its original casing). If the session was launched from a parent or
root workspace that contains multiple projects, use `Root` as the project folder name.

If the file doesn't exist, create it with frontmatter:

```markdown
---
date: <YYYY-MM-DD>
project: <ProjectName>
tags: [daily-digest, <project-tag>]
---

# Daily Digest — <ProjectName> (<YYYY-MM-DD>)
```

Then append a new digest entry. If the file already exists, just append the entry.

#### Digest entry template (REQUIRED structure)

```markdown
## <HH:MM AM/PM> — <Agent name, e.g., Claude (Opus 4.6)>

### Summary
<200-300 words of flowing prose. Cover: goal of the session, what was accomplished
(commits, PRs, issues closed, features shipped), problems encountered and how resolved,
decisions made and why, current state, what should happen next. Include concrete anchors:
commit hashes, issue IDs, version numbers, file paths.>

### Retro Lessons
<bullet list of the lessons saved to mem0 in Step 3, with category tag>
- [<category>] <one-sentence prescriptive lesson>
- [<category>] <one-sentence prescriptive lesson>
- ...
_(write `_(none — chat-only session)_` if no lessons were saved)_
_(write `_(completed via /retro)_` if /retro was run before /wrap)_

### Git State
- **Branch:** <current branch>
- **Session commits:** <count> (<short SHA list>)
- **Session PRs:** <#N status mergeState — or "none">
- **Worktrees:** <count, with brief status>
- **Uncommitted at wrap:** <count or "clean">

### Session Health <emoji>
<the soft warnings block — see "Session Health Block" section below for the format>

### Next Session
<1-3 sentences suggesting what to work on next, based on what's still open. NOT a binding
commitment — just a hint for /prime to surface.>
```

**If `--handoff` was passed**, append a `### Handoff Notes` section AFTER `Next Session`
with these required fields:

```markdown
### Handoff Notes
- **Continue issue:** <ISSUE-ID — REQUIRED. If no issue exists for the active work,
  create one before writing handoff notes>
- **Resume with:** <exact command or first action — e.g., `/prime`, a file to open>
- **Immediate next:** <task being actively worked on, with enough detail to resume
  without re-reading code>
- **Then:** <2-3 follow-up tasks in priority order>
- **Watch out for:** <gotchas, non-obvious state, things the next session needs to know>
```

`/prime` reads this section as "where we left off" — make it actionable and specific.

#### Commit the digest

```bash
cd ../DocVault && git add "Daily Digests/" && git commit -m "digest: <project> session <date>" && git push origin main
```

### Step 7 — Save curated mem0 session summary

Write ONE concise mem0 entry for the startup hook and `/prime` to retrieve next session.

```
mcp__mem0__add_memory(
  text: "[<ProjectName> | <branch> | <date>] <2-3 sentence summary of what was
         accomplished, key decisions, and current state. Include commit hashes,
         issue IDs, and version numbers as anchors.>",
  user_id: "<your-mem0-user-id>",
  agent_id: "<project-tag>",
  metadata: {
    "category": "session-summary",
    "type": "session-digest",
    "source": "wrap",
    "date": "<YYYY-MM-DD>",
    "project": "<ProjectName>"
  }
)
```

**Quality bar:**
- Would this be useful in 5 search results next session? If not, more specific.
- Contains at least one concrete anchor (commit, issue ID, version)?
- Says what CHANGED, not just what was "worked on"?
- Different enough from the retro lessons to avoid redundancy?

### Step 8 — Print the recap to the user

The recap is the *last* thing the user sees. It's a compact mirror of the digest's Session
Health block plus a one-line pointer to the digest path.

```
## Session Wrapped 🟢 / 🟡 / 🔴

**Digest:** ../DocVault/Daily Digests/<path>.md
**Lessons saved:** <count> retro entries to mem0
**Session summary:** Saved to mem0 as session-digest

<Session Health block — same content as the digest section, see format below>

<If --handoff: "Handoff ready — /prime in your new terminal will load the notes.">
```

That's it. No "press enter to continue", no "is everything OK?". The user invoked `/wrap`
and the wrap is done.

---

## Session Health Block — Format

The Session Health block appears in TWO places: inside the digest (as a section) and at
the end of the user-facing recap (as the final report). Both use the same format.

### 🟢 Green — all checks pass

```
### Session Health 🟢

✅ All session changes committed (<N> commits on <branch>)
✅ Local in sync with origin/<branch>
✅ Session PRs: <N merged | none open | none touched this session>
✅ No worktree warnings
✅ DocVault synced
```

When green, the recap is silent beyond that block. No suggestions, no follow-up questions.

### 🟡 Yellow — soft warnings, nothing broken

```
### Session Health 🟡

⚠ <warning 1 — short, specific, actionable>
⚠ <warning 2>
⚠ <warning 3>

_These are warnings, not blockers. The session is wrapped — address these in your next
session if needed._
```

Warning examples:
- `⚠ 2 uncommitted files in src/tools/ (not staged) — review and decide next session`
- `⚠ Local main is behind origin/main by 3 commits — auto-pull skipped because working tree was dirty`
- `⚠ PR #47 open with passing checks — not merged this session`
- `⚠ Worktree .worktrees/swf-92 has uncommitted changes — left intact`
- `⚠ Stale worktree .worktrees/swf-88 (branch merged) — manual cleanup recommended`
- `⚠ Runtime code changed but no version bump detected — run /release patch before next PR`

### 🔴 Red — something is genuinely broken

```
### Session Health 🔴

❌ <broken thing 1 — what failed and why>
❌ <broken thing 2>

⚠ <any soft warnings as well>

_Red items need attention before the next session can proceed cleanly._
```

Red examples:
- `❌ log-implementation catch-up failed for SWF-92 task 3.1 — manual fix required`
- `❌ PR #47 has failing checks — investigate before next session`
- `❌ DocVault push rejected — check credentials`
- `❌ mem0 write failed for retro lessons — saved to fallback file at <path>`

Even when red, the wrap still completes — the digest still gets written, mem0 still gets
the session summary. Red is a *report*, not a halt.

---

## Rules (the short version)

- **One flow, no gates.** No "STOP HERE", no phase banners, no mid-flow approval prompts.
- **Run actions autonomously where the action is obvious.** Implementation logging, fast-
  forward pull when clean, DocVault sync. Anything that touches dirty user work becomes a
  warning, not an action.
- **Template-enforced digest.** Every section in the template MUST exist with content (or
  `_(none)_`). Missing section = broken wrap.
- **Session Health is the only place warnings appear.** Never interrupt the flow to flag
  something — collect it for the Health block.
- **The recap is the last thing the user sees.** No follow-up questions after it.
- **No Haiku agents.** All summaries and digests are written by YOU (the in-context model).
  Never dispatch a subagent for summarization.
- **mem0 writes require `metadata.project: "<tag>"`** (SWF-90).
- **DocVault commits go direct to main** (no PR).
- **Idempotent.** Running `/wrap` twice should be safe — check if a digest entry for this
  session already exists before duplicating.
- **Never auto-delete uncommitted work, ever.** Worktrees, branches, files, stashes — all
  off-limits to autonomous deletion.

## What this skill does NOT do

- Ask the user to commit/stash/discard uncommitted changes (those become warnings)
- Ask the user to merge or close PRs (those become warnings)
- Auto-delete worktrees or branches (warnings)
- Print phase banners or gate tables
- Stop and wait for user acknowledgment between steps
- Push the project repo (the user does that themselves after reviewing the wrap)
