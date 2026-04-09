---
description: "Fast session boot (~15 seconds). Gathers git status, open issues/PRs, active specs, today's digest, and a targeted mem0 search. Use \"prime full\" for a deep scan including code health, security, and indexing."
argument-hint: "[quick|full]"
---

$ARGUMENTS

Quick session start. Gather project status fast — no agents, no indexing. Target: 15 seconds.

If arguments contain "full", run the full prime with deep scans (Step 2 below). Otherwise, run quick prime only (Phases 0-3).

---

## Phase 0: Project Identity (instant)

```bash
cat .claude/project.json 2>/dev/null
```

Extract: `name`, `tag`, `issuePrefix`. If no project.json, infer from:
```bash
basename "$(git remote get-url origin 2>/dev/null)" .git
```

---

## Phase 1: Ground Truth (parallel, main context — no agents)

Run ALL of these in parallel using Bash:

```bash
# Branch and working tree state
git branch --show-current && git status --short

# Recent commits (last 15)
git log --oneline -15 --no-merges

# Open worktrees
git worktree list

# Version lock (if exists)
cat devops/version.lock 2>/dev/null || echo "no-version-lock"
```

```bash
# Open PRs
gh pr list --state open --json number,title,headRefName,isDraft --jq '.[] | "PR #\(.number): \(.title) [\(.headRefName)]\(if .isDraft then " (draft)" else "" end)"' 2>/dev/null || echo "gh-unavailable"
```

Also gather these (parallel with above):

**Vault Issues** — if `issuePrefix` exists, scan the vault issues folder:
```bash
# List open issues (scan frontmatter for status != done)
grep -rl "status: backlog\|status: todo\|status: in-progress" ../DocVault/Projects/<name>/Issues/*.md 2>/dev/null | head -20
```
For each file found, extract just the title and status from frontmatter (read first 10 lines).

**Active Specs** — if specs exist under the resolved workflow root:
- Use the **spec-list** MCP tool (returns all specs across the resolved workflow root) or **spec-status** for a single spec.
For each spec, check if tasks.md has any `[-]` (in-progress) or `[ ]` (pending) markers.

**Today's Digest** — check if a session digest was written today or yesterday:
```bash
# Find most recent digest for this project
ls -t "../DocVault/Daily Digests/<ProjectFolder>/"*.md 2>/dev/null | head -1
```
If found and from today/yesterday, read it for context on where we left off.

---

## Phase 2: Context (1-2 mem0 searches)

Extract **keywords** from Phase 1 results:
- Significant nouns from commit messages (skip generic: fix, update, add, remove, chore)
- PR titles
- Issue titles
- Spec names

Build 1-2 targeted mem0 searches:

```
mcp__mem0__search_memories(
  query: "<top 5-8 distinctive keywords from Phase 1>",
  filters: {"AND": [{"agent_id": "<project-tag>"}]},
  limit: 5
)
```

If the project tag yields <2 results, also try without the agent_id filter for cross-project context.

From the results, extract only what adds context BEYOND what git/issues show:
- Verbal decisions and rationale
- Planned next steps from last session
- Known blockers or dependencies
- Gotchas or warnings for areas being worked on

---

## Phase 3: Present

Display a concise terminal summary. **Must stay under 25 lines.**

```
# <ProjectName> — <date>
Branch: `<branch>` | Version: `<version>` | Status: <clean/dirty>

## Where We Left Off
<2-3 sentences from today's digest + mem0 context. If no digest: use mem0 alone. If neither: "No recent session history.">

## Open Work
<Compact list: open PRs, active specs with task counts, in-progress issues — one line each, max 8 items>
<If nothing open: "No open work items.">

## Suggested Next Steps
1. <highest priority — based on in-progress items, open PRs, or recent commits>
2. <next priority>
3. <next priority>
```

---

## Step 2: Deep Scans (only if "full" mode)

After presenting the quick summary, dispatch these in parallel:

### 2.1: Code Health (Agent: code-oracle, background)
Dispatch a `code-oracle` agent:
- query: "dead code, complexity hotspots, convention violations"
- Focus on: dead code (CGC), top 5 complex functions (CGC), convention issues in files changed last 7 days
- Keep report compact — tables only, max 15 findings

### 2.2: Security Scan (main context, parallel with 2.1)
Query Codacy for open findings:
```
mcp__codacy__codacy_search_repository_srm_items(
  provider="gh", organization="<owner>", repository="<repo>",
  options={"statuses": ["OnTrack", "DueSoon", "Overdue"], "priorities": ["Critical", "High"]},
  limit=25
)
```

### 2.3: Index Health (main context, parallel)
```
mcp__claude-context__get_indexing_status(path="<projectPath>")
```

If stale (>24h), trigger a re-index.

### Deep Report
When agents return, present extended results and archive to DocVault:
```
../DocVault/Projects/<name>/prime/<YYYY-MM-DD>-<HHMMSS>.md
```

---

## Rules

- **No agents dispatched** in quick mode. Everything runs in main context.
- **No indexing** in quick mode. CGC and claude-context are not touched.
- **Target 15 seconds** for quick mode.
- **Present, don't prescribe.** Show what's there, suggest next steps, then stop.
- **After presenting the summary, the session is ready for work.** Do not prompt to run prime again.
