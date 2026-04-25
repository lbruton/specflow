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

## CRITICAL OUTPUT REQUIREMENTS

These rules apply to every prime report — full and delta alike:

1. **Frontmatter first**: The very first line of the report MUST be `---` (YAML block open). Never start with a heading or body text.

   **Note**: The YAML at the top of THIS skill file (`name: prime`, `description: ...`) describes the skill itself for the plugin registry — it is NOT the output format. The prime REPORT uses completely different field names.

   Every prime report — full and delta — begins with exactly these field names (no others, no substitutions):

   ```yaml
   ---
   doc_type: prime-report
   tags: [<tag>]
   project: <name>
   date: "<YYYY-MM-DD>"
   branch: dev
   version: "2.1.0"
   ---
   ```

   - Field `doc_type` — MUST be `prime-report`
   - Field `tags` (NOT `tag`, NOT `type`) — topic tags only, no `prime-report` (that goes in `doc_type`)
   - Field `project` (NOT `name`, NOT `title`) — project name as string
   - Field `date` (quoted string: `"<YYYY-MM-DD>"` NOT `<YYYY-MM-DD>`) — today's date
   - Field `branch` (NOT `git_branch`) — current git branch
   - Field `version` (NOT `ver`) — from version.lock or `"n/a"`

   Delta reports add a sixth field: `delta_from: <previous-prime-filename>`.
2. **Quote the date**: Always `date: "<YYYY-MM-DD>"` — NEVER `date: <YYYY-MM-DD>`. Unquoted dates break Obsidian Bases sorting.
3. **All frontmatter fields required**: `doc_type` (must be `prime-report`), `tags`, `project`, `date`, `branch`, `version`. Use `"n/a"` if unknown — never omit any field.
4. **All section headers required**: `## Recent Activity`, `## Where We Left Off`, `## Index Health`, `## Code Health`, `## Security Reviews`, `## Project Status`, `## Suggested Session Plan`. Show a placeholder if data is unavailable — never omit the header.
5. **Session plan must have items**: `## Suggested Session Plan` MUST have at least one `1. ...` numbered item.
6. **No unfilled placeholders**: Replace ALL `<angle-bracket>` tokens with real values before outputting. Never leave `<name>`, `<tag>`, `<branch>`, etc. in the final report.

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

Use the `Read` tool on `.claude/project.json` (relative to cwd). Also run:

```bash
pwd
git rev-parse --show-toplevel 2>/dev/null
```

Extract: `name`, `tag`, `issuePrefix` (may be absent — e.g., Playground has no tracked issues).

**If `.claude/project.json` is missing**, WARN prominently before continuing:

```
⚠ .claude/project.json MISSING
  cwd: <pwd>
  git toplevel: <git-toplevel>
  Likely cause: .claude/ is gitignored; file dropped during merge/reset/worktree switch.
  Impact: digests land under wrong folder (e.g. Root/ instead of Devops/), project scoping
  in mem0 breaks silently, prime/start/wrap all mis-route.
  Offer fix: create .claude/project.json now from sibling template.
```

Also warn if `pwd` is a subdirectory of a different git repo toplevel (e.g., Devops/ inside
the outer GitHub/ repo) — this usually means project.json was expected and missing.

Offer to create `project.json` immediately. Template:

```json
{"name":"<Name>","tag":"<name-lower>","issuePrefix":"<PREFIX>","issueTag":"<name-lower>","cachePrefix":"<name-lower>"}
```

If user declines / auto-create not possible, fall back to git inference:

```bash
basename "$(git remote get-url origin 2>/dev/null)" .git
```

Set `tag` to lowercase repo name, `issuePrefix` to empty.

**No-project-json does NOT mean a degraded report.** The full report format (frontmatter, all required sections, full content) is still required. Use the inferred name/tag/branch for all frontmatter fields. Note `project.json not found — inferred from git` in the report header line.

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
[ -d "${DOCVAULT_PATH}/Projects/<name>/Security Reviews" ] && echo "hasSecurityReviews=true" || echo "hasSecurityReviews=false"

# Codacy configured? (check if MCP server responds)
# hasCodacy is true if the codacy MCP tools are available in this session
echo "hasCodacy=true"  # Always true — codacy MCP is globally configured
```

Also extract the git remote to derive `owner` and `repo` for Codacy API calls:

```bash
git remote get-url origin 2>/dev/null
# Parse: git@github.com:<owner>/<repo>.git → owner, repo
# Works for https://github.com/<owner>/<repo>(.git) as well
```

Store all values for agent dispatch.

### Step 0.4: Retrieve recent session context (sessionflow)

sessionflow is the **primary** "where we left off" source. It indexes every jsonl turn
locally via Milvus Lite + EmbeddingGemma and provides project-scoped semantic search.

**IMPORTANT:** Do NOT pass the filesystem path as `project_root` — it silently returns
empty results. Use `project_root="*"` for cross-project search, or omit the parameter
entirely (defaults to current project via HTTP header).

```text
mcp__sessionflow__search_all_sessions(
  query="last session summary recent work decisions next steps handoff <project-name>",
  n=10
)
```

Extract from results:
- **Goals and accomplishments** from recent session turns
- **Decisions made** and their rationale
- **Next steps** / follow-up items mentioned
- **Key learnings** and pain points

Store the session context. This feeds the "Where We Left Off" section.
If sessionflow is unreachable (port 7102 down), set `hasSessionFlow=false` and fall back
to mem0 (Step 0.7) as the sole context source.

**Handoff detection:** If sessionflow results mention a handoff issue ID (e.g., `SWF-48`),
set `handoffIssue=<ID>`. This issue becomes the top suggested action in the session plan.
Read the issue file from DocVault to get its title and acceptance criteria for context.

### Step 0.5: (Retired — iTerm2 log digestion removed)

iTerm2 session logging is disabled. Session history is covered by JSONL files
digested into mem0 via `/batch-digest` and `/wrap`. Skip this step entirely.

### Step 0.6: (Removed — incremental prime retired)

Every `/prime` runs the full pipeline. Use `/start` for lightweight reorientation.

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

Also track both counts for the report header (SWF-92):

- `mem0_raw_count` — total results returned by the API across both queries before post-filtering
- `mem0_preload_count` — total unique results after post-filtering by `metadata.project`

The header always surfaces these counts so the user has an at-a-glance signal of recall quality.

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

Check if `${DOCVAULT_PATH}/Infrastructure/Expiration Tracker.md` exists before reading:

```bash
[ -f "${DOCVAULT_PATH}/Infrastructure/Expiration Tracker.md" ] && echo "hasExpirationTracker=true" || echo "hasExpirationTracker=false"
```

If `hasExpirationTracker=true`, use the `Read` tool on `${DOCVAULT_PATH}/Infrastructure/Expiration Tracker.md`. If `hasExpirationTracker=false`, skip this step and omit the `## ⚠️ Expiring Soon` section from the report.

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

## (Incremental Prime — retired)

Every `/prime` runs the full pipeline. Use `/start` for lightweight session reorientation.
No incremental detection, no state files, no delta reports.


## Phase 1: Indexes + Parallel Agent Dispatch

### Step 1.0: Start indexes FIRST (background, instant)

Kick off CGC and claude-context indexing checks immediately — these run while everything
else gathers data. By the time we reach the report, index results are ready.

Run Phase 2 Steps 2.1, 2.2, and 2.3 (claude-context, CGC, Codacy) in parallel NOW.

### Agent A: Session Digest (retired — iTerm2 logs removed)

Skip. iTerm2 session logging is disabled. Session digestion happens via `/batch-digest`
and `/wrap` against JSONL files, not iTerm2 logs.

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

**Issue scanning MUST be project-scoped**: scan only
`${DOCVAULT_PATH}/Projects/<name>/Issues/`
where <name> comes from project.json. NEVER use a cross-project glob
(`Projects/*/Issues/`) — DocVault tracks issues for all repos and broad
globs return foreign-project issues.

Return only the synthesized report.
```

## Phase 1.5: Keyword-Informed Context Enrichment

This phase runs AFTER Agent D returns. The sessionflow context (from Step 0.4) is the
**primary** "where we left off" source. This phase extracts keywords from ALL deterministic
sources (git + sessionflow + issues) and uses them for **targeted mem0 queries** that
supplement sessionflow with retro learnings, workarounds, and cross-session decisions.

**Data flow:** GitHub → sessionflow → Issues → Compile Keywords → mem0 (supplemental)

### Step 1.5.1: Extract keywords from Agent D results + digest

Parse BOTH the prime-status report AND the sessionflow context (Step 0.4) to extract:
- **Sessionflow keywords**: Goals, decisions, next steps, pain points from sessionflow results
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

### Step 1.5.3: (Removed — session-oracle redundant)

session-oracle uses sessionflow internally. If sessionflow is down, oracle falls back to
mem0 — same thing Step 0.7 already does. No unique data source. Removed.

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
volume mounts your repositories root (the directory containing all project repos) as `/workspace`.

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

If the function count seems low (< 50 for a medium-sized project), re-index:

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

- Step 0.4 sessionflow → **primary** "where we left off" (project-scoped semantic search)
- Agent D (prime-status) → ground truth: git, PRs, issues, specs
- Phase 1.5 mem0 → **supplemental** context: retro learnings, workarounds, cross-session decisions
- Agent C (code-oracle) → code health: dead code, complexity, conventions
- Step 2.3 Codacy → security: SRM findings, critical issues, overdue items
- Agent A (session-digest) → housekeeping: undigested logs processed

### Step 3.1: Assemble full report

Build the complete report using the **Full Report Template** below, populated with data from
all agents.

### Step 3.2: (DocVault write — retired)

Prime reports are no longer written to DocVault. The terminal output IS the report.
No `prime/` directory, no file write, no "Full report saved to:" line.

### Step 3.3: Terminal output

Render the full report directly in the terminal. This is the only output — there is no
separate file. The report uses the Full Report Template below.

---

### Full Report Template (written to DocVault)

```markdown
---
doc_type: prime-report
tags: [<tag>]
project: <name>
date: "<YYYY-MM-DD>"
branch: <branch>
version: <from version.lock or "n/a">
---

# Prime Report — <name> (<date>)
Branch: <branch> | Status: <clean/dirty> | Version: <from version.lock or "n/a">
mem0: <If mem0_unavailable=true: "🔴 unavailable — operating without long-term memory"> <Elif mem0_preload_empty=true: "⚠ 0 records — check `~/.claude/mem0-projects.json` for project mapping"> <Else: "<mem0_preload_count> records (post-filtered from <mem0_raw_count> raw, project=<tag>)">
<If inWorktree=true: append "⚠️ Worktree mode — branch: <worktreeBranch>, main: <mainBranch>">

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
<If hasDigest=false or no digest file found: write exactly "No session digest found for this project." then supplement with any mem0 context.>
<If digest exists: 3-5 sentence recap from the latest session digest — goals, decisions, next steps, pain points>
<Weave in relevant mem0 findings: retro learnings, workarounds, known issues from earlier sessions>
<If no digest exists: fall back to mem0 results>
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
| sessionflow MCP down | Set `hasSessionFlow=false`, fall back to mem0 for "where we left off" |
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
| Recent prime (<24h) | (Retired — incremental mode removed. Use `/start` for lightweight reorientation) |

## Rules

### Data Source Priority
- **sessionflow is the PRIMARY "where we left off" source** — project-scoped semantic search over all past turns
- **mem0 is SUPPLEMENTAL** — retro learnings, workarounds, cross-session decisions, known issues
- **session-oracle is NOT dispatched by prime** — redundant (it uses sessionflow internally; if sessionflow is down, Step 0.7 mem0 covers it)
- The correct flow is: GitHub → sessionflow → Issues → Code/Security → Compile Keywords → mem0 → Report

### Execution
- Phase 2 indexes (CGC, claude-context, Codacy) start FIRST in Phase 1 Step 1.0 — they run in background while data is gathered
- Phase 1 agents MUST run in background — do not block on them sequentially
- NEVER run code-oracle or session-oracle in main context — always isolated agents
- If ALL agents fail, fall back to Phase 0 local context + digest + Phase 2 indexing

### Output
- **The full Forge-layout report renders in BOTH the terminal AND DocVault** — same content, both places. The user wants the dense dashboard in their terminal, not a stripped summary.
- The Terminal Summary Template (below) is **DEPRECATED** — kept in this file for reference only. Do NOT use it. Render the Full Report Template in the terminal as-is.
- Always `mkdir -p` the prime/ subdirectory before writing — it may not exist on first run
- DocVault path is ALWAYS `${DOCVAULT_PATH}/Projects/<name>/prime/` — use the project name from `project.json`, not the tag
- Timestamp format for filenames: `YYYY-MM-DD-HHMMSS` (local time, no colons — filesystem safe)
- After presenting the terminal summary, the session is ready for work — do not prompt for /prime again
- **The report body MUST include the save path**: end every report (full and delta) with a line like `Full report saved to: \`DocVault/Projects/<name>/prime/<filename>.md\`` — this is required for traceability

### Frontmatter
- Frontmatter is **MANDATORY in every prime report** — full and delta alike. The very first line of the report MUST be `---` (YAML block open), not a heading.
- If `project.json` is missing, infer the project name from git remote URL, directory name, or context. Never use `<name>` literally — always substitute the real value.
- **ALWAYS quote the date field** — this is the most common mistake: write `date: "<YYYY-MM-DD>"` NOT `date: <YYYY-MM-DD>`. Unquoted dates are parsed as datetime objects and break Obsidian Bases sorting.
- All fields are required: `doc_type`, `tags`, `project`, `date`, `branch`, `version`, and (for delta) `delta_from`. Use `"n/a"` if a value is unavailable — never omit the field.
- The `doc_type` field MUST be `"prime-report"` — this is how Obsidian Bases finds all prime reports across projects. Do NOT put `prime-report` in the `tags` array.

### Session Digest Absence
- When `hasDigest=false` or no digest file is found, the **Where We Left Off** section MUST include the exact phrase "No recent session history" (or "No session digest found" / "No session context found"). Never invent context or silently skip it.
- When no `project.json` exists and no digest exists, note both explicitly in the report.

### P1 Issue Surfacing
- Any open issue with `priority: 1` (critical/blocking) MUST appear prominently in `## Project Status` — use a dedicated **🔴 Priority 1 — Blocking** subsection or bold/flag it clearly. Never bury P1 issues in a generic issue list.

### Required Sections
Both full and delta reports MUST include ALL of these section headers. If data is unavailable, show a one-line placeholder — **never omit the header**:
- `## Recent Activity` — show "No data available." if git history unavailable
- `## Where We Left Off` — show "No recent session context found." if no digest or mem0
- `## Index Health` — show "Not applicable." or "Not re-checked in delta." as appropriate
- `## Code Health` — show "Not applicable." or "Not re-analyzed in delta." as appropriate
- `## Security Reviews` — show "No security reviews on file." if hasSecurityReviews=false
- `## Project Status` — show "No open issues." if issue list is empty
- `## Suggested Session Plan` — MUST have at least one numbered item (`1. ...`). If nothing is in progress, generate a sensible default based on open issues or recent commits.

### Incremental Mode
- Incremental prime skips ALL background agents (code-oracle, session-digest, prime-status) — main context only
- Incremental prime STILL reads the session digest — it's fast and critical for context
- Incremental prime still writes to DocVault with the `prime-delta` tag for traceability
- `/prime full` forces a complete refresh regardless of recent prime existence
- Security review staleness threshold is 30 days — flag stale reviews in both full and incremental reports
