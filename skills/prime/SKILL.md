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

### Step 0.3: Detect capabilities

Run these checks (all instant, run in parallel):

```bash
# Has wiki?
[ -d "wiki/" ] && echo "hasWiki=true" || echo "hasWiki=false"

# Has spec-workflow?
[ -d ".spec-workflow/specs/" ] && echo "hasSpecs=true" || echo "hasSpecs=false"

# Has version lock?
[ -f "devops/version.lock" ] && echo "hasVersionLock=true" || echo "hasVersionLock=false"

# CGC running?
docker ps --filter "name=cgc" --format "{{.Names}}" 2>/dev/null | grep -q cgc && echo "hasCGC=true" || echo "hasCGC=false"

# Has security reviews?
[ -d "/Volumes/DATA/GitHub/DocVault/Projects/<name>/Security Reviews" ] && echo "hasSecurityReviews=true" || echo "hasSecurityReviews=false"

# Codacy configured? (check if MCP server responds)
# hasCodacy is true if the codacy MCP tools are available in this session
echo "hasCodacy=true"  # Always true — codacy MCP is globally configured
```

Also extract the git remote to derive `owner` and `repo` for Codacy API calls:

```bash
git remote get-url origin 2>/dev/null
# Parse: git@github.com:lbruton/<repo>.git → owner=lbruton, repo=<repo>
```

Store all values for agent dispatch.

### Step 0.4: Find undigested session logs

```bash
# Count logs not yet processed
LOGDIR="$HOME/.claude/iterm2"
PROCESSED="$LOGDIR/.processed"
touch "$PROCESSED"
find "$LOGDIR" -maxdepth 1 -name "*.log" -newer "$PROCESSED" -type f 2>/dev/null | head -20
```

Store the list of undigested log files.

### Step 0.5: Check for recent prime run

```bash
# Find most recent prime report for this project
PRIME_DIR="/Volumes/DATA/GitHub/DocVault/Projects/<name>/prime"
LATEST_PRIME=$(ls -t "$PRIME_DIR"/*.md 2>/dev/null | head -1)
if [ -n "$LATEST_PRIME" ]; then
  echo "latest_prime=$LATEST_PRIME"
  echo "latest_prime_ts=$(basename "$LATEST_PRIME" .md)"
fi
```

Compare the filename timestamp to current time. If the most recent prime report is
**less than 24 hours old**, set `recentPrimeExists=true` and store the file path and timestamp.

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
gh pr list --repo lbruton/<repo> --state open --json number,title,headRefName,isDraft

# New/changed vault issues since last prime (if issuePrefix exists)
find /Volumes/DATA/GitHub/DocVault/Projects/<name>/Issues/ -name "*.md" -newer "<latest_prime_file>" 2>/dev/null

# New security reviews since last prime (if hasSecurityReviews)
find "/Volumes/DATA/GitHub/DocVault/Projects/<name>/Security Reviews/" -name "*.md" -newer "<latest_prime_file>" 2>/dev/null
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

### Step I.4: Quick mem0 check

Run a single mem0 search for recent context:

```
mcp__mem0__search_memories(query="latest session <name>", filters={"AND": [{"agent_id": "<tag>"}]}, limit=3)
```

### Step I.5: Produce delta report

Write the delta report to DocVault at the same path as full reports:

```
/Volumes/DATA/GitHub/DocVault/Projects/<name>/prime/<YYYY-MM-DD>-<HHMMSS>.md
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

## Session Context (mem0)
<Brief context from mem0 search — 2-3 sentences about recent work>
<If no results: "No recent session context found.">

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

## Session Context
<2-3 sentences from mem0>

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

## Phase 1: Parallel Agent Dispatch (deterministic sources)

Fire ALL of the following agents simultaneously using background dispatch. Agents A and C
have zero data dependencies. Agent D (prime-status) MUST return before Phase 1.5 can begin —
dispatch it in the foreground or poll for completion.

### Agent A: Session Digest (if undigested logs exist, background)

Skip if no undigested logs found in Step 0.4.

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

This phase runs AFTER Agent D returns. It extracts keywords from the deterministic sources
and uses them to make targeted searches of fuzzy/episodic memory. This is the key improvement
over generic queries — the git history, PRs, and issues tell us WHAT happened, and now we
ask mem0 and session-oracle WHY and WHAT'S NEXT with precision.

### Step 1.5.1: Extract keywords from Agent D results

Parse the prime-status report to extract:
- **Commit keywords**: Significant nouns and verbs from the last 15 commit messages
  (strip prefixes like "fix:", "feat:", "update:", "add:" — keep the substance)
- **PR keywords**: Titles of open PRs
- **Issue keywords**: Titles of active/todo vault issues
- **Spec keywords**: Names of active specs

Deduplicate and select the **top 10-15 most distinctive terms** — skip generic words
(update, fix, change, add, remove) and focus on domain terms (feature names, component
names, bug descriptions, technology references).

Example: If commits mention "LACP", "bge0", "portfast", "VLAN 10", "TrueNAS Scale" and
issues mention "qBittorrent decom", "corosync QDevice" — those are the keywords.

### Step 1.5.2: Dispatch targeted searches (parallel)

Fire BOTH of these simultaneously:

**Targeted mem0 search** (main context — fast, no agent needed):

Run 2-3 mem0 searches using the extracted keywords. Group related keywords into queries:

```
mcp__mem0__search_memories(query="<keyword group 1 — e.g., feature/component names>", filters={"AND": [{"agent_id": "<tag>"}]}, limit=5)
mcp__mem0__search_memories(query="<keyword group 2 — e.g., bug/issue terms>", filters={"AND": [{"agent_id": "<tag>"}]}, limit=5)
mcp__mem0__search_memories(query="<keyword group 3 — e.g., infrastructure/tooling terms>", filters={"AND": [{"agent_id": "<tag>"}]}, limit=5)
```

If the project tag yields few results, also try without the agent_id filter for
cross-project context (some decisions span repos).

Deduplicate results and keep only memories that add context beyond what git/issues show
(e.g., verbal decisions, rationale, planned next steps, blocked-on-external-dependency).

**Targeted session-oracle** (agent dispatch):

Dispatch `session-oracle` agent with keyword-informed query:

```
Search for the most recent session context for this project:
- query: "last session for <name>: <top 5-8 keywords from step 1.5.1>"
- project: <name>
- dateRange: "last 7 days"

Focus on: decisions made, rationale for choices, next steps discussed,
blockers identified, and any handoff notes.

Return a 3-5 sentence recap of where we left off, prioritizing information
that explains the WHY behind recent commits and open issues.
```

## Phase 2: Indexing (runs during Phase 1 and 1.5)

While waiting for agents, run indexing in main context. These are fast operations.
Start indexing during Phase 1 and let it continue through Phase 1.5.

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
volume mounts `/Volumes/DATA/GitHub` as `/workspace`.

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

- Agent D (prime-status) → ground truth: git, PRs, issues, specs
- Phase 1.5 mem0 → targeted context: decisions, rationale, verbal plans
- Phase 1.5 session-oracle → targeted context: where we left off, next steps
- Agent C (code-oracle) → code health: dead code, complexity, conventions
- Step 2.3 Codacy → security: SRM findings, critical issues, overdue items
- Agent A (session-digest) → housekeeping: logs processed

### Step 3.1: Assemble full report

Build the complete report using the **Full Report Template** below, populated with data from
all agents.

### Step 3.2: Write to DocVault

Write the full report to:

```
/Volumes/DATA/GitHub/DocVault/Projects/<name>/prime/<YYYY-MM-DD>-<HHMMSS>.md
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

## Where We Left Off (keyword-targeted session-oracle + mem0)
<3-5 sentence recap from Phase 1.5 session-oracle — informed by keywords from git/PRs/issues>
<Weave in relevant mem0 findings: decisions, rationale, planned next steps>
<If no results from either: "No recent session history found.">

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
1. <highest priority actionable item>
2. <next priority>
3. <next priority>
<3-5 items based on: recent git activity > open PRs > unfinished specs > open bugs > mem0 planned next steps > session-oracle handoff items > quick wins>
```

---

### Terminal Summary Template (displayed to user)

```markdown
# <name> — <date>
Branch: `<branch>` | Version: `<version>` | Status: <clean/dirty>

## Where We Left Off
<3-5 sentence recap from Phase 1.5 session-oracle + mem0, informed by git/PR/issue keywords>

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
1. <highest priority actionable item>
2. <next priority>
3. <next priority>

---
Full report saved to: `DocVault/Projects/<name>/prime/<filename>.md`
```

## Graceful Degradation

Not every project has every capability. Handle missing pieces:

| Missing | Behavior |
|---------|----------|
| No `issuePrefix` | Skip vault issue queries, show GitHub issues only |
| No CGC (Docker down) | Skip CGC stats + dead code + complexity, note in Index Health |
| CGC MCP disconnected | Note "CGC MCP unavailable — container may have restarted" in Index Health. Do NOT restart containers. |
| CGC index job fails | Note "CGC re-index failed — Neo4j connection error" in Index Health. Continue without. |
| No wiki/ | Skip wiki index check |
| No .spec-workflow/ | Omit spec sections entirely |
| No version.lock | Show "n/a" for version |
| No undigested logs | Skip session-digest, note "All logs processed" |
| Agent timeout | Note which agent timed out, continue with available data |
| No security reviews | Show "No security reviews on file" in Security section |
| Codacy MCP down | Show "Codacy MCP unavailable — skipping live security scan" in Codacy section |
| Codacy returns error | Note the error, continue without Codacy data — never block prime on Codacy |
| Recent prime (<24h) | Switch to Incremental Prime — skip full agents, show delta only |

## Rules

- Phase 1 agents MUST run in background — do not block on them sequentially
- Phase 2 indexing runs in main context while agents work (it's lightweight)
- NEVER run code-oracle or session-oracle in main context — always isolated agents
- If ALL agents fail, fall back to just the Phase 0 local context + Phase 2 indexing
- The **full report** goes to DocVault ONLY — never dump the full report in the terminal
- The **terminal summary** must stay under 40 lines — concise, actionable, scannable
- Always `mkdir -p` the prime/ subdirectory before writing — it may not exist on first run
- DocVault path is ALWAYS `/Volumes/DATA/GitHub/DocVault/Projects/<name>/prime/` — use the project name from `project.json`, not the tag
- Timestamp format for filenames: `YYYY-MM-DD-HHMMSS` (local time, no colons — filesystem safe)
- After presenting the terminal summary, the session is ready for work — do not prompt for /prime again
- Incremental prime skips ALL background agents (code-oracle, session-digest, prime-status) — main context only
- Incremental prime still writes to DocVault with the `prime-delta` tag for traceability
- `/prime full` forces a complete refresh regardless of recent prime existence
- Security review staleness threshold is 30 days — flag stale reviews in both full and incremental reports
