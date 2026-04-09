---
name: prime
description: >
  Universal session boot — indexes code, digests past sessions, checks code health, gathers
  project status, and presents a unified startup report. Works on any project with a
  .claude/project.json. Run at the start of every session.
  Triggers: "prime", "boot", "get me up to speed", "session status", "where are we",
  "what's the status", "catch me up", "project overview", "what's open".
  Also use proactively at session start if the user hasn't run it yet.
---

# Prime v2 — Universal Session Boot

Orchestrates four parallel agents + indexing to produce a comprehensive startup report.
Works on any project — discovers context from `.claude/project.json`.

## Pre-flight: Local/Remote Sync Check

Before anything else, check if local is behind remote:

```bash
git fetch --quiet 2>/dev/null
BRANCH=$(git branch --show-current)
UPSTREAM=$(git rev-parse --abbrev-ref "@{u}" 2>/dev/null)
if [ -n "$UPSTREAM" ]; then
  BEHIND=$(git rev-list --count HEAD.."$UPSTREAM" 2>/dev/null)
  AHEAD=$(git rev-list --count "$UPSTREAM"..HEAD 2>/dev/null)
  if [ "$BEHIND" -gt 0 ]; then
    echo "WARNING: LOCAL IS $BEHIND COMMITS BEHIND $UPSTREAM — run 'git pull' before resuming work"
  fi
  echo "sync: local=$BRANCH upstream=$UPSTREAM ahead=$AHEAD behind=$BEHIND"
else
  echo "sync: local=$BRANCH upstream=none (no tracking branch)"
fi
```

If local is **behind** remote, display a prominent warning and recommend `git pull` before continuing.

Two modes: **Full Prime** runs the complete agent pipeline. **Incremental Prime** activates
when a full prime report exists within 24 hours — it skips agents and produces a lightweight
delta of what changed since the last run. Use `/prime full` to force a complete refresh.

## Phase 0: Project Discovery (main context, instant)

### Step 0.1: Read project identity

```bash
cat .claude/project.json 2>/dev/null
```

Extract: `name`, `tag`, `issuePrefix` (may be absent — e.g., Playground has no tracked issues).

If no `project.json` exists, infer from git:

```bash
basename "$(git remote get-url origin 2>/dev/null)" .git
```

Set `tag` to lowercase repo name, `issuePrefix` to empty.

### Step 0.2: Local context snapshot

```bash
git branch --show-current
git status --short
```

### Step 0.2.5: Worktree awareness (CRITICAL — prevents stale assumptions)

Detect whether prime is running inside a git worktree. **Worktrees are by definition
side-branch in-progress work** — they do NOT represent the main pulse of the project,
and using their state alone produces stale or wrong "where we left off" results.

```bash
# Detect worktree mode
PWD_NOW=$(pwd)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)
CURRENT_BRANCH=$(git branch --show-current)
MAIN_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")

# A worktree has GIT_DIR != GIT_COMMON_DIR
if [ "$GIT_DIR" != "$GIT_COMMON_DIR" ] || echo "$PWD_NOW" | grep -q "\.worktrees/"; then
  echo "inWorktree=true"
  echo "worktreeBranch=$CURRENT_BRANCH"
  echo "mainBranch=$MAIN_BRANCH"
  # Find the main checkout path (parent repo)
  MAIN_CHECKOUT=$(git worktree list | head -1 | awk '{print $1}')
  echo "mainCheckout=$MAIN_CHECKOUT"
else
  echo "inWorktree=false"
  echo "mainBranch=$MAIN_BRANCH"
fi
```

**If `inWorktree=true`:**
- Set a banner in the report header: `⚠️ Worktree mode — branch: <worktreeBranch>, main: <mainBranch>`
- Agent D's git history queries MUST also pull main branch history from `$MAIN_CHECKOUT`
  (e.g., `cd $MAIN_CHECKOUT && git log --oneline -15 $MAIN_BRANCH`) so the report shows
  the actual project pulse, not just the worktree's WIP commits
- "Where We Left Off" must NOT infer from worktree branch state alone — the worktree is
  by definition mid-task, so its current commits are the in-progress work, not the recap
- The session digest and mem0 are the authoritative "where we left off" sources in
  worktree mode, not git

**If `inWorktree=false`:** Standard mode — git is the ground truth for recent activity.

### Step 0.3: Detect capabilities

Run these checks (all instant, run in parallel):

```bash
# Has wiki?
[ -d "wiki/" ] && echo "hasWiki=true" || echo "hasWiki=false"

# Has spec-workflow? (config.json is the thin pointer to DocVault)
[ -f ".specflow/config.json" ] && echo "hasSpecs=true" || echo "hasSpecs=false"

# Has version lock?
[ -f "devops/version.lock" ] && echo "hasVersionLock=true" || echo "hasVersionLock=false"

# CGC running?
docker ps --filter "name=cgc" --format "{{.Names}}" 2>/dev/null | grep -q cgc && echo "hasCGC=true" || echo "hasCGC=false"

# Has security reviews?
[ -d "../DocVault/Projects/<name>/Security Reviews" ] && echo "hasSecurityReviews=true" || echo "hasSecurityReviews=false"

# Codacy configured? (check if MCP server responds)
# hasCodacy is true if the codacy MCP tools are available in this session
echo "hasCodacy=true"  # Always true — codacy MCP is globally configured
```

Also extract the git remote to derive `owner` and `repo` for Codacy API calls:

```bash
git remote get-url origin 2>/dev/null
# Parse: git@github.com:<owner>/<repo>.git → owner=<owner>, repo=<repo>
```

Store all values for agent dispatch.

### Step 0.4: Find and read latest session digest

The session digest is the **primary** "where we left off" source — NOT mem0. Digests live
in DocVault and contain structured session summaries with goals, decisions, and next steps.

```bash
# Find the most recent digest for this project
DIGEST_DIR="../DocVault/Daily Digests/<tag>"
LATEST_DIGEST=$(ls "$DIGEST_DIR"/*.md 2>/dev/null | grep -v _Index | sort -r | head -1)
if [ -n "$LATEST_DIGEST" ]; then
  echo "latest_digest=$LATEST_DIGEST"
  echo "latest_digest_date=$(basename "$LATEST_DIGEST" .md)"
fi
```

If a digest exists, **read it in full** immediately — it's a small file and provides the
richest context. Extract:
- **Goals and accomplishments** from each session block
- **Decisions made** and their rationale
- **Next steps** / follow-up items listed at the end
- **Key learnings** and pain points

Store the full digest content. This is the authoritative session history that feeds the
"Where We Left Off" section. If no digest exists, set `hasDigest=false`.

**Handoff detection:** If the digest contains a `## Handoff Notes` section, extract the
**Continue issue** ID (e.g., `SWF-48`). Set `handoffIssue=<ID>`. This issue becomes the
top suggested action in the session plan — the previous session explicitly handed off to it.
Read the issue file from DocVault to get its title and acceptance criteria for context.

### Step 0.5: Find undigested session logs

```bash
# Count logs not yet processed
LOGDIR="$HOME/.claude/iterm2"
PROCESSED="$LOGDIR/.processed"
touch "$PROCESSED"
find "$LOGDIR" -maxdepth 1 -name "*.log" -newer "$PROCESSED" -type f 2>/dev/null | head -20
```

Store the list of undigested log files.

### Step 0.6: Check for recent prime run

```bash
# Find most recent prime report for this project
PRIME_DIR="../DocVault/Projects/<name>/prime"
LATEST_PRIME=$(ls "$PRIME_DIR"/*.md 2>/dev/null | grep -v _Index | sort -r | head -1)
if [ -n "$LATEST_PRIME" ]; then
  echo "latest_prime=$LATEST_PRIME"
  echo "latest_prime_ts=$(basename "$LATEST_PRIME" .md)"
fi
```

Compare the filename timestamp to current time. If the most recent prime report is
**less than 24 hours old**, set `recentPrimeExists=true` and store the file path and timestamp.

### Step 0.7: Pre-load mem0 project memories (REQUIRED — runs early, no agent dispatch)

mem0 is a **first-class data source**, not supplemental. Pre-load project memories now,
in main context, before any agent dispatch. This ensures mem0 context is available
even if agents fail, time out, or get skipped.

**This step is mandatory.** A prime that does not query mem0 is not a valid prime.

**SWF-90 — schema reality:** mem0 cloud v1 API does NOT persist top-level `agent_id`
as a queryable field — it is `null` on every record. Project tag lives in
`metadata.project`. **Do NOT** use `filters: {AND: [{agent_id: "<tag>"}]}` — that
returns zero results. Run an unfiltered search and post-filter by `metadata.project`
matching `<tag>` case-insensitively (legacy records have inconsistent casing like
`SpecFlow` vs `specflow`). The canonical pattern is in
`~/.claude/hooks/mem0-session-start.py:83-140` — fetch 4× the limit, then post-filter.

```
mcp__mem0__search_memories(
  query="recent work decisions handoffs",
  limit=30
)
# Then keep only memories where metadata.project.lower() == "<tag>".lower()
# (or is in the variant set for <tag> from PROJECT_NAMES in mem0-session-start.py)
```

Also run a second query for active state:

```
mcp__mem0__search_memories(
  query="active project state current focus blockers",
  limit=30
)
# Same post-filter pattern.
```

Store ALL post-filtered results in `mem0_preload`. These will be merged with Phase 1.5's
keyword-targeted searches to produce the final "Where We Left Off" section.

**If post-filtered results are empty for both queries:**
- Note `mem0_preload_empty=true` in the report
- This is a RED FLAG — either mem0 is broken, the project tag is wrong/missing from
  `~/.claude/mem0-projects.json`, the casing variants don't cover legacy records, or no
  memories have actually been saved for this project. Surface this prominently in the
  report header so the user knows context is incomplete.

**If mem0 MCP is unavailable:**
- Note `mem0_unavailable=true` in the report header
- This is a STOP-AND-FIX condition — prime should still complete, but the user must
  be told the report is operating without long-term memory

### Step 0.8: Read DocVault Expiration Tracker (deterministic, instant)

Read the central expiration tracker page to surface anything expiring soon:

```bash
TRACKER="../DocVault/Infrastructure/Expiration Tracker.md"
if [ -f "$TRACKER" ]; then
  cat "$TRACKER"
fi
```

Parse all markdown tables in the file. For each row that has an `Expires` column with
a date, compute `days_left = (expires_date - today)`. Filter to only rows where
`days_left <= 60`. Assign status icon:

| Days Left | Icon | Bucket |
|---|---|---|
| `< 0` (expired) or `< 7` | 🔴 | URGENT — render at top of report with banner |
| `7 <= days < 30` | 🟡 | Rotate soon |
| `30 <= days <= 60` | 🟢 | Reminder |
| `> 60` | (skip) | Not shown |

Store filtered rows in `expiring_soon`. If empty, the section will be omitted from the
report entirely (no "nothing expiring" noise).

## Incremental vs Full Prime

After Phase 0, check `recentPrimeExists`:

- **`recentPrimeExists=true`** → jump to **Incremental Prime** (next section)
- **`recentPrimeExists=false`** → skip ahead to **Phase 1** (full prime)

## Incremental Prime (delta since last run)

When a full prime report exists within the last 24 hours, skip the heavyweight agent
dispatch and produce a lightweight delta showing only what changed. This avoids burning
time and context on data we already have.

### Step I.1: Read previous prime report

Read the most recent prime report to establish the baseline state. Note the commit hashes,
open PRs, issue counts, and security review date from that report.

### Step I.2: Gather delta data (parallel, main context)

Run ALL of these in parallel — no agents needed:

```bash
# New commits since last prime (use the date from the filename)
cd <workingDir> && git log --oneline --since="<last_prime_date> <last_prime_time>" --no-merges

# Current git status
cd <workingDir> && git status --short

# Open PRs (may have changed)
gh pr list --repo <owner>/<repo> --state open --json number,title,headRefName,isDraft

# New/changed vault issues since last prime (if issuePrefix exists)
find ../DocVault/Projects/<name>/Issues/ -name "*.md" -newer "<latest_prime_file>" 2>/dev/null

# New security reviews since last prime (if hasSecurityReviews)
find "../DocVault/Projects/<name>/Security Reviews/" -name "*.md" -newer "<latest_prime_file>" 2>/dev/null
```

### Step I.3: Summarize new security reviews

If new security review files were found in Step I.2, read each one and extract:
- Finding counts by severity (High / Medium / Low)
- The summary/posture line
- Any high-severity findings (one-line each)

### Step I.3.5: Codacy SRM check (parallel with I.3)

Run the same Codacy queries as Step 2.3 in full prime — these are lightweight MCP calls
that run in parallel with the security review file reads:

```
mcp__codacy__codacy_search_repository_srm_items(
  provider="gh", organization="<owner>", repository="<repo>",
  options={"statuses": ["OnTrack", "DueSoon", "Overdue"], "priorities": ["Critical", "High"]},
  limit=25
)
```

Compare results against the previous prime report's Codacy section to identify **new**
findings since last prime. Highlight net-new items in the delta report.

### Step I.4: Read latest session digest

Read the latest digest found in Step 0.4 (if not already read). This is the primary
"where we left off" source — even in incremental mode.

### Step I.4.5: Supplemental mem0 check

Run 1-2 targeted mem0 searches using keywords from the digest and new commits. mem0
supplements the digest with retro learnings, workarounds, and cross-session decisions:

```
mcp__mem0__search_memories(query="<keywords from digest next-steps + new commit topics>", limit=20)
# Post-filter on metadata.project matching <tag> case-insensitively (SWF-90).
```

If the post-filtered results are sparse, run a second unfiltered search and merge for cross-project context.

### Step I.5: Produce delta report

Write the delta report to DocVault at the same path as full reports:

```
../DocVault/Projects/<name>/prime/<YYYY-MM-DD>-<HHMMSS>.md
```

Use the **Delta Report Template** below. Display the **Delta Terminal Summary** to the user.

---

### Delta Report Template (written to DocVault)

```markdown
---
tags: [prime-report, prime-delta, <tag>]
project: <name>
date: <YYYY-MM-DD>
branch: <branch>
version: <from version.lock or "n/a">
delta_from: <previous prime filename>
---

# Prime Delta — <name> (<date>)
Branch: <branch> | Status: <clean/dirty> | Version: <version>
Delta from: <previous prime date/time>

## New Commits Since Last Prime
| Date | Commit | Message |
|------|--------|---------|
<Commits since last prime. If none: "No new commits.">

## Changes
- **New commits**: N since last prime
- **Open PRs**: N (list any new/closed since last prime)
- **New/changed issues**: N (list titles)
- **Git status**: clean/dirty (list dirty files if any)

## Security Reviews
<If new review found: summarize with severity table and high-severity findings>
<If no new review: "No new security reviews since last prime.">
<If hasSecurityReviews=false: "No security reviews on file.">

## Codacy Findings (live)
<From Step I.3.5 — compare against previous prime's Codacy section>
- **N** open SRM findings (Critical: N, High: N) | **N** Overdue
- **Net new since last prime:** N findings (list titles if any)
<If no new findings: "No change in Codacy findings since last prime.">
<If Codacy unavailable: "Codacy MCP unavailable — skipped.">

## Where We Left Off (from session digest)
<3-5 sentence recap from the latest session digest — goals, decisions, next steps>
<Supplement with any relevant mem0 findings: retro learnings, workarounds, known issues>
<If no digest: fall back to mem0 context. If neither: "No recent session context found.">

## Suggested Next Steps
1. <based on new commits and open work>
2. <based on issues/PRs>
3. <based on security findings if any>
```

---

### Delta Terminal Summary (displayed to user)

```markdown
# <name> — <date> (delta)
Branch: `<branch>` | Version: `<version>` | Since: <last prime time>

## What Changed
- **N** new commits since last prime
- **N** open PRs (<list titles if ≤3>)
- **N** new/changed issues
<If new security review: "**New security review** — N High, N Medium, N Low">
<If Codacy has open findings: "**Codacy:** N Critical, N High SRM findings (N overdue) — see full report">
<If Codacy clean: "**Codacy:** Clean">

## Where We Left Off
<3-5 sentence recap from session digest, supplemented by mem0>

## Suggested Next Steps
1. <highest priority>
2. <next>
3. <next>

---
Delta report saved to: `DocVault/Projects/<name>/prime/<filename>.md`
Full prime last ran: <previous prime date/time> — run `/prime full` to force a complete refresh
```

---

> **Forcing a full prime:** If the user explicitly says `/prime full` or `prime full`, ignore
> `recentPrimeExists` and run the full Phase 1-3 flow regardless. This lets users force a
> refresh when they know the delta won't be sufficient.

## Phase 1: Indexes + Parallel Agent Dispatch

### Step 1.0: Start indexes FIRST (background, instant)

Kick off CGC and claude-context indexing checks immediately — these run while everything
else gathers data. By the time we reach the report, index results are ready.

Run Phase 2 Steps 2.1, 2.2, and 2.3 (claude-context, CGC, Codacy) in parallel NOW.

### Agent A: Session Digest (if undigested logs exist, background)

Skip if no undigested logs found in Step 0.5.

Dispatch `session-digest` agent for the most recent undigested log:

```
Process this iTerm2 session log into mem0 memories:
- logFile: <most recent undigested .log path>
- project: <name from project.json>
- tag: <tag from project.json>
```

If there are multiple undigested logs (>1), dispatch one agent per log (up to 3 max —
oldest logs can wait for /digest-session).

### Agent C: Code Oracle (health check, background)

Dispatch `code-oracle` agent:

```
Run a startup health check on the codebase:
- query: "dead code, complexity hotspots, convention violations, stale patterns"
- mode: analyze
- workingDir: <absolute path to project root>
- project: <name>

Focus on:
1. Dead code detection (CGC if available)
2. Top 5 most complex functions (CGC if available)
3. Any convention violations visible in recently changed files (last 7 days of git log)

Keep the report compact — tables only, max 15 findings.
```

### Agent D: Prime Status (Issues + GitHub + Git + Specs, foreground)

Dispatch `prime-status` agent and WAIT for its results — Phase 1.5 depends on them:

```
Gather a full project status report for:
- repo: <name>
- tag: <tag from project.json>
- issuePrefix: <issuePrefix from project.json, or "none">
- workingDir: <absolute path>
- hasSpecs: <true/false>
- hasVersionLock: <true/false>
- hasSecurityReviews: <true/false>

Return only the synthesized report.
```

## Phase 1.5: Keyword-Informed Context Enrichment

This phase runs AFTER Agent D returns. The session digest (read in Step 0.4) is the
**primary** "where we left off" source. This phase extracts keywords from ALL deterministic
sources (git + digest + issues) and uses them for **targeted mem0 queries** that supplement
the digest with retro learnings, workarounds, and cross-session decisions.

**Data flow:** GitHub → Session Digest → Issues → Compile Keywords → mem0 (supplemental)

### Step 1.5.1: Extract keywords from Agent D results + digest

Parse BOTH the prime-status report AND the session digest to extract:
- **Digest keywords**: Goals, decisions, next steps, pain points from the latest digest
- **Commit keywords**: Significant nouns and verbs from the last 15 commit messages
  (strip prefixes like "fix:", "feat:", "update:", "add:" — keep the substance)
- **PR keywords**: Titles of open PRs
- **Issue keywords**: Titles of active/todo vault issues
- **Spec keywords**: Names of active specs

Deduplicate and select the **top 10-15 most distinctive terms** — skip generic words
(update, fix, change, add, remove) and focus on domain terms (feature names, component
names, bug descriptions, technology references).

Example: If the digest mentions "three-tier architecture", "plugin skills", "template
inversion" and commits mention "migrate-skill", "marketplace.json" — those are the keywords.

### Step 1.5.2: Targeted mem0 search (REQUIRED — keyword-driven deep search)

mem0 is **a first-class data source**. Step 0.7 already pre-loaded recent project
memories. This step does deeper, keyword-targeted searches based on what Agent D and
the digest revealed. Both layers are mandatory.

**Why two layers:** Step 0.7 catches "what did we work on recently" without needing
keywords. This step catches "what does mem0 know about the specific things showing up
in the current commits/PRs/issues" — much more targeted, finds workarounds and prior
decisions that Step 0.7's broad query would miss.

Run 2-3 mem0 searches using the extracted keywords. Group related keywords into queries:

```
mcp__mem0__search_memories(query="<keyword group 1 — e.g., feature/component names>", limit=20)
mcp__mem0__search_memories(query="<keyword group 2 — e.g., bug/issue terms>", limit=20)
# Post-filter on metadata.project matching <tag> case-insensitively (SWF-90).
# The project tag's casing variants are listed in
# ~/.claude/hooks/mem0-session-start.py PROJECT_NAMES — use the same set.
```

If post-filtered results are sparse, also run an unfiltered search for cross-project
context (some decisions span repos).

Deduplicate results and keep only memories that **add context beyond what the digest shows**
(e.g., retro learnings from earlier sessions, known workarounds, blocked-on-external-dependency).
Discard mem0 results that merely repeat what the digest already says.

### Step 1.5.3: Session-oracle (optional, background only)

Session-oracle is **optional** — only dispatch if `hasDigest=false` (no digest exists for
this project). When a digest exists, the oracle adds little value and burns time/context.

If dispatched:

```
Search for the most recent session context for this project:
- query: "last session for <name>: <top 5-8 keywords from step 1.5.1>"
- project: <name>
- dateRange: "last 7 days"

Focus on: decisions made, rationale for choices, next steps discussed,
blockers identified, and any handoff notes.

Return a 3-5 sentence recap of where we left off.
```

## Phase 2: Indexing (started in Phase 1, Step 1.0)

These operations were kicked off at the start of Phase 1 and run in parallel with agent
dispatch. By the time Phase 1.5 completes, results should be ready. The steps below
describe WHAT to run — they are initiated in Step 1.0, not sequentially here.

### Step 2.1: claude-context index

```
mcp__claude-context__get_indexing_status(path="<workingDir>")
```

If the index is stale (older than 24h) or doesn't exist:

```
mcp__claude-context__index_codebase(path="<workingDir>")
```

If the project has a wiki, also check:

```
mcp__claude-context__get_indexing_status(path="<workingDir>/wiki")
```

### Step 2.2: CGC index (if hasCGC=true)

CGC MCP runs via `docker exec -i cgc-server cgc mcp start`. Restarting the container
kills the MCP connection — never restart CGC containers during a session.

The CGC workspace path is `/workspace/<name>` (not the host path), because the Docker
volume mounts the projects parent directory as `/workspace`.

First, check if the project is indexed:

```
mcp__code-graph-context__list_indexed_repositories()
```

If the project (`/workspace/<name>`) is **not listed**, it needs to be indexed:

```
mcp__code-graph-context__add_code_to_graph(path="/workspace/<name>")
```

If the project **is listed**, check its health:

```
mcp__code-graph-context__get_repository_stats(repo_path="/workspace/<name>")
```

If the function count seems low (< 50 for StakTrakr-sized projects), re-index:

```
mcp__code-graph-context__delete_repository(repo_path="/workspace/<name>")
mcp__code-graph-context__add_code_to_graph(path="/workspace/<name>")
```

Then poll with `check_job_status` until complete. If it fails with a Neo4j connection
error, note it in the report as "CGC index failed — Neo4j may need heap increase" and
move on. Do NOT restart containers.

Record stats for the report (file count, function count).

### Step 2.3: Codacy SRM + Critical Issues (main context, fast)

Query Codacy for open security findings and critical code quality issues. This runs in
main context alongside indexing — it's a single MCP call per query, no agent needed.

**Security findings (SRM):**

```
mcp__codacy__codacy_search_repository_srm_items(
  provider="gh",
  organization="<owner>",
  repository="<repo>",
  options={
    "statuses": ["OnTrack", "DueSoon", "Overdue"],
    "priorities": ["Critical", "High"]
  },
  limit=25
)
```

**Critical code quality issues:**

```
mcp__codacy__codacy_list_repository_issues(
  provider="gh",
  organization="<owner>",
  repository="<repo>",
  options={
    "levels": ["Error"],
    "categories": ["security", "errorprone"]
  },
  limit=25
)
```

Run both queries in parallel. Extract from results:

- **SRM findings**: Count by priority (Critical / High), list each with title, category,
  scan type (SAST/SCA/Secrets/IaC), and status (OnTrack/DueSoon/Overdue)
- **Critical issues**: Count, list each with file path, pattern name, and severity
- **Overdue count**: How many SRM items are Overdue (needs immediate attention)

If Codacy MCP is unavailable or returns an error, note "Codacy unavailable — skipping
security scan" and continue. Never block the prime report on Codacy failures.

Store results for Phase 3 report assembly.

## Phase 3: Synthesis & DocVault Archive

Wait for ALL agents (Phase 1 + Phase 1.5) to return. Combine their reports into the full
report below and write it to the Obsidian DocVault for historical tracking. Then display a
concise terminal summary. The data flow is:

- Step 0.4 session digest → **primary** "where we left off" (read directly from DocVault)
- Agent D (prime-status) → ground truth: git, PRs, issues, specs
- Phase 1.5 mem0 → **supplemental** context: retro learnings, workarounds, cross-session decisions
- Agent C (code-oracle) → code health: dead code, complexity, conventions
- Step 2.3 Codacy → security: SRM findings, critical issues, overdue items
- Agent A (session-digest) → housekeeping: undigested logs processed

### Step 3.1: Assemble full report

Build the complete report using the **Full Report Template** below, populated with data from
all agents.

### Step 3.2: Write to DocVault

Write the full report to:

```
../DocVault/Projects/<name>/prime/<YYYY-MM-DD>-<HHMMSS>.md
```

Where `<name>` is the project name from `project.json` and the timestamp uses local time.
Create the `prime/` subdirectory if it doesn't exist (`mkdir -p`).

The file MUST include Obsidian-compatible YAML frontmatter (see template below).

### Step 3.3: Terminal summary

Display ONLY the **Terminal Summary Template** to the user. This is the concise, actionable
output — everything else lives in the DocVault file.

---

### Full Report Template (written to DocVault)

```markdown
---
tags: [prime-report, <tag>]
project: <name>
date: <YYYY-MM-DD>
branch: <branch>
version: <from version.lock or "n/a">
---

# Prime Report — <name> (<date>)
Branch: <branch> | Status: <clean/dirty> | Version: <from version.lock or "n/a">
<If inWorktree=true: append "⚠️ Worktree mode — branch: <worktreeBranch>, main: <mainBranch>">
<If mem0_preload_empty=true: append "⚠️ mem0 returned no project memories — context may be incomplete">
<If mem0_unavailable=true: append "🔴 mem0 MCP unavailable — operating without long-term memory">

## ⚠️ Expiring Soon
<Only render this section if expiring_soon (from Step 0.8) is non-empty. If empty, OMIT entirely — no "nothing expiring" placeholder text.>
<If any 🔴 items exist, lead with: "**🔴 URGENT:** N item(s) expire in less than 7 days — rotate immediately">

| Item | Expires | Days Left | Status |
|------|---------|-----------|--------|
<Render each row from expiring_soon, sorted ascending by days_left. Format days_left as integer. Status column = the icon (🔴 / 🟡 / 🟢).>

Source: [[Expiration Tracker]] (DocVault/Infrastructure/)

## Recent Activity (ground truth from git + GitHub)
<From Agent D — this section is MANDATORY and comes first because it shows what actually happened>

### Recent Commits
| Date | Commit | Message |
|------|--------|---------|
<Last 15 commits from Agent D>

### Open PRs
| PR | Title | Branch | Status |
|----|-------|--------|--------|
<From Agent D. If none: "No open PRs.">

### Hot Files (most-changed in 7 days)
| Changes | File |
|---------|------|
<Top 10 from Agent D>

### This Week by the Numbers
| Metric                  | Count                              |
|-------------------------|------------------------------------|
| Issues completed        | **N**                              |
| GitHub issues closed    | **N**                              |
| Commits (7d)            | **N**                              |
| Version range           | vX.Y.Z1 -> vX.Y.Z2 (N patches)   |

## Where We Left Off (from session digest + mem0 supplemental)
<3-5 sentence recap from the latest session digest — goals, decisions, next steps, pain points>
<Weave in relevant mem0 findings: retro learnings, workarounds, known issues from earlier sessions>
<If no digest exists: fall back to mem0 + session-oracle results>
<If neither: "No recent session history found.">

## Session Logs Digested
<Results from Agent A — how many logs processed, key topics>
<If skipped: "All logs already processed.">

## Index Health
| Tool            | Status         | Details              |
|-----------------|----------------|----------------------|
| claude-context  | Fresh/Stale    | Indexed N files      |
| CGC (Neo4j)     | Running/Down   | N nodes, N rels      |

## Code Health (code-oracle)

### Dead Code
| Symbol | File:Line | Notes |
|--------|-----------|-------|
<If none: "No dead code detected.">

### Complexity Hotspots
| Function | File:Line | CCN | Rating |
|----------|-----------|-----|--------|
<Top 5 only>

### Convention Issues
| File:Line | Issue | Convention |
|-----------|-------|------------|
<If none: "All conventions followed.">

## Security Reviews
<From Agent D — summarize the most recent security review>

### Latest Review: <date>
| Severity | Count | Key Findings |
|----------|-------|--------------|
| High     | **N** | <one-line per finding, or "None"> |
| Medium   | **N** | <one-line per finding, or "None"> |
| Low      | **N** | <one-line per finding, or "None"> |

Overall: <summary/posture line from the review>

<If no Security Reviews folder exists: "No security reviews on file.">
<If review is older than 30 days: "⚠ Review is stale — consider scheduling a new scan.">

## Codacy Findings (live scan)
<From Step 2.3 — real-time Codacy analysis, complementing the point-in-time Security Reviews above>

### Security (SRM)
| Priority | Status | Category | Scan Type | Finding |
|----------|--------|----------|-----------|---------|
<List each open SRM finding. If none: "No open security findings.">

**Summary:** **N** Critical, **N** High | **N** Overdue
<If any Overdue items exist: "⚠ Overdue items need immediate attention — consider creating issues.">

### Critical Code Quality Issues
| File | Pattern | Severity |
|------|---------|----------|
<List each Error-level issue in security/errorprone categories. If none: "No critical code quality issues.">

<If Codacy unavailable: "Codacy MCP unavailable — skipping live security scan.">

## Project Status

### Active Specs
| Spec | Phase | Tasks | Status |
|------|-------|-------|--------|
<From Agent D. If hasSpecs=false: omit this section>

### Pending Approvals
<From Agent D. If none: "No pending approvals.">

### Open Bugs (by priority)
| Priority | Issue | Summary |
|----------|-------|---------|

### Open Features / Todo
| Priority | Issue | Summary |
|----------|-------|---------|

### Backlog
| Issue | Summary |
|-------|---------|
<If issuePrefix is "none": omit vault issue sections, show GitHub issues only>

## Suggested Session Plan
<If handoffIssue exists: "**Handoff from last session:** <issue ID> — <issue title>">
1. <If handoffIssue: that issue is #1 | otherwise: highest priority actionable item>
2. <next priority>
3. <next priority>
<3-5 items based on: handoff issue > digest next-steps > open PRs > unfinished specs > open bugs > mem0 retro learnings > recent git activity > quick wins>
```

---

### Terminal Summary Template (displayed to user)

```markdown
# <name> — <date>
Branch: `<branch>` | Version: `<version>` | Status: <clean/dirty>

## Where We Left Off
<3-5 sentence recap from session digest, supplemented by mem0 retro learnings/workarounds>

## This Week
| Metric | Count |
|--------|-------|
| Issues completed | **N** |
| Commits (7d) | **N** |
| Version range | vX.Y.Z1 -> vX.Y.Z2 |

## Open Work
<Compact list: open PRs, active specs, unresolved bugs — one line each, max 10 items>

## Code Health Summary
<One-line status per category: dead code (N found), complexity (top offender), conventions (clean/N issues)>

## Security
<Latest review date> — **N** High, **N** Medium, **N** Low | <overall posture>
<If new review since last prime: "New review arrived — check full report for findings">
<If no reviews: "No security reviews on file.">

## Codacy (live)
**N** Critical, **N** High SRM findings | **N** Overdue | **N** critical code issues
<If any Overdue or Critical: list top 3 with one-line descriptions — these are triage candidates>
<If clean: "No open security or critical findings.">
<If Codacy unavailable: "Codacy unavailable — skipped.">

## Suggested Session Plan
<If handoffIssue exists: "**Handoff from last session:** <issue ID> — <issue title>. Jump straight to this.">
1. <If handoffIssue: that issue is #1 | otherwise: highest priority actionable item>
2. <next priority>
3. <next priority>

---
Full report saved to: `DocVault/Projects/<name>/prime/<filename>.md`
```

## Graceful Degradation

Not every project has every capability. Handle missing pieces:

| Missing | Behavior |
|---------|----------|
| No session digest | Set `hasDigest=false`, fall back to mem0 + session-oracle for "where we left off" |
| No `issuePrefix` | Skip vault issue queries, show GitHub issues only |
| No CGC (Docker down) | Skip CGC stats + dead code + complexity, note in Index Health |
| CGC MCP disconnected | Note "CGC MCP unavailable — container may have restarted" in Index Health. Do NOT restart containers. |
| CGC index job fails | Note "CGC re-index failed — Neo4j connection error" in Index Health. Continue without. |
| No wiki/ | Skip wiki index check |
| No .specflow/ | Omit spec sections entirely |
| No version.lock | Show "n/a" for version |
| No undigested logs | Skip session-digest, note "All logs processed" |
| Agent timeout | Note which agent timed out, continue with available data |
| No security reviews | Show "No security reviews on file" in Security section |
| Codacy MCP down | Show "Codacy MCP unavailable — skipping live security scan" in Codacy section |
| Codacy returns error | Note the error, continue without Codacy data — never block prime on Codacy |
| Recent prime (<24h) | Switch to Incremental Prime — skip full agents, show delta only |

## Rules

### Data Source Priority
- **Session digest is the PRIMARY "where we left off" source** — read from DocVault/Daily Digests/<tag>/
- **mem0 is SUPPLEMENTAL** — retro learnings, workarounds, cross-session decisions, known issues
- **session-oracle is OPTIONAL** — only dispatch when no digest exists for the project
- The correct flow is: GitHub → Session Digest → Issues → Code/Security → Compile Keywords → mem0 → Report

### Execution
- Phase 2 indexes (CGC, claude-context, Codacy) start FIRST in Phase 1 Step 1.0 — they run in background while data is gathered
- Phase 1 agents MUST run in background — do not block on them sequentially
- NEVER run code-oracle or session-oracle in main context — always isolated agents
- If ALL agents fail, fall back to Phase 0 local context + digest + Phase 2 indexing

### Output
- **The full Forge-layout report renders in BOTH the terminal AND DocVault** — same content, both places. The user wants the dense dashboard in their terminal, not a stripped summary.
- The Terminal Summary Template (below) is **DEPRECATED** — kept in this file for reference only. Do NOT use it. Render the Full Report Template in the terminal as-is.
- Always `mkdir -p` the prime/ subdirectory before writing — it may not exist on first run
- DocVault path is ALWAYS `../DocVault/Projects/<name>/prime/` — use the project name from `project.json`, not the tag
- Timestamp format for filenames: `YYYY-MM-DD-HHMMSS` (local time, no colons — filesystem safe)
- After presenting the terminal summary, the session is ready for work — do not prompt for /prime again

### Incremental Mode
- Incremental prime skips ALL background agents (code-oracle, session-digest, prime-status) — main context only
- Incremental prime STILL reads the session digest — it's fast and critical for context
- Incremental prime still writes to DocVault with the `prime-delta` tag for traceability
- `/prime full` forces a complete refresh regardless of recent prime existence
- Security review staleness threshold is 30 days — flag stale reviews in both full and incremental reports
