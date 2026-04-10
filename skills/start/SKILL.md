---
name: start
description: >
  Lightweight session reorientation — reads the most recent session digest, checks git
  state, and surfaces 5 most recent open issues. Fast alternative to /prime for continuing
  same-day work or resuming after a short break. No indexing, no MCP tool calls.
  Triggers: "start", "quick start", "resume", "orient me", "where were we".
---

# Start

Lightweight session reorientation. Use this when you're continuing recent work and just
need to know where you left off — not when you need a full environment boot.

**Under 15 seconds.** No code indexing, no semantic search, no MCP server calls.

---

## DocVault path convention

This skill uses `../DocVault/` relative to the current project root — the same convention
as `/wrap` and `/prime`. DocVault is expected to live as a sibling of your project folder.
If your layout differs, adjust the paths below for your environment.

---

## When to use /start vs /prime

| Situation | Use |
|---|---|
| Continuing same-day work in a new terminal | `/start` |
| Coming back after a short break (< 1 day) | `/start` |
| Starting fresh after days away | `/prime` |
| First session on a new project | `/prime` |
| Need full code indexing | `/prime` |
| Need comprehensive mem0 search | `/prime` |
| Just need context from last session | `/start` |

---

## The Flow

Run all three steps in parallel. No sequential dependencies.

### Step 1 — Read the most recent session digest

Find the most recent daily digest for this project:

```bash
# Detect project name from git directory basename
PROJECT=$(basename $(git rev-parse --show-toplevel 2>/dev/null) 2>/dev/null || echo "Root")
DIGEST_DIR="../DocVault/Daily Digests"

# Find most recent digest file for this project folder
ls -t "$DIGEST_DIR/$PROJECT/"*.md 2>/dev/null | head -1
```

Read the file. Extract and display:
- The most recent digest entry (last `## HH:MM` section)
- Focus on: Summary, Next Session, and Handoff Notes (if present)

If no digest exists for this project, note it and continue.

### Step 2 — Git state snapshot

```bash
git status --short
git branch --show-current
git log --oneline -10
git worktree list
```

Surface:
- Current branch
- Last 10 commits (quick orientation on recent work)
- Uncommitted changes (if any)
- Active worktrees (if any beyond main)

### Step 3 — Recent open issues

Find the 5 most recently updated open issues from the vault:

```bash
ISSUES_DIR="../DocVault/Issues"
# Filter open issues first, then sort by modification time, take 5
# (truncating before filtering can return zero results if the top 5 are all closed)
grep -rl 'status:.*\(backlog\|todo\|in-progress\|in-review\)' "$ISSUES_DIR" 2>/dev/null \
  | grep -v '_Index' | xargs ls -t 2>/dev/null | head -5
```

For each file, read the frontmatter to extract: `id`, `title`, `status`, `updated`.
Display as a compact list.

If there is no vault Issues directory or no open issues, note it briefly and move on.
Also check the project-specific Issues path if the global one is empty:
`../DocVault/Projects/{ProjectName}/Issues/`

---

## Output Format

Print a compact orientation report:

```
## Session Start — <ProjectName> (<date>)

### Last Session
<Summary paragraph from the most recent digest — verbatim or lightly compressed>

**Next session note:** <Next Session section from digest, if present>
**Handoff:** <Handoff Notes summary, if present — otherwise omit this line>

---

### Git State
- **Branch:** <current branch>
- **Recent commits:** <last 3-5, one-liners>
- **Uncommitted:** <count or "clean">
- **Worktrees:** <list or "none">

---

### Open Issues (5 most recent)
- [<ID>] <title> — <status>
- [<ID>] <title> — <status>
- ...

---

_Use /prime for full environment boot with code indexing and comprehensive mem0 search._
```

Keep the whole output under 50 lines. If digest or issues are missing, compress those
sections to a single "none found" line rather than expanding on the absence.

---

## Rules

- **No MCP tool calls.** File reads and bash only. This must stay fast.
- **No code indexing.** Do not trigger Milvus, CGC, or any indexing operation.
- **No mem0 search.** The digest already contains the curated session summary.
- **Read-only.** Do not write, commit, or modify anything.
- **If /start would take > 20 seconds, something is wrong.** The three steps are all
  local file reads and git commands — they should complete instantly.

## What this skill does NOT do

- Full environment indexing (use /prime)
- mem0 search (use /prime)
- DocVault page reading beyond the daily digest (use /prime)
- Retro, wrap, or any write operations
- Run any MCP tool calls
