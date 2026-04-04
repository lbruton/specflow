---
name: audit
description: >
  On-demand project health check — code quality (CGC), security (Codacy SRM), instruction file
  drift (CLAUDE.md vs Agents.md vs Gemini.md), issue landscape, index health.
  Triggers: "audit", "health check", "check project health", "scan codebase", "code health",
  "instruction drift", "check for drift".
---

# Project Health Audit

Run a project health audit. Follow each phase in order.

## Arguments

- **focus**: `"all"` (default), `"code"`, `"security"`, `"drift"`, or `"issues"`

---

## Phase 0: Project Identity

```bash
cat .claude/project.json 2>/dev/null
git remote get-url origin 2>/dev/null
```

Extract: `name`, `tag`, `issuePrefix`, `owner`, `repo` (parse from git remote).

### Pre-flight: Local/Remote Sync

Fetch the latest remote state and check if local is behind. An audit against stale
local state produces false findings (dead code already removed, dependencies already bumped).

```bash
git fetch origin 2>/dev/null
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$(git symbolic-ref --short HEAD) 2>/dev/null)
```

- If `LOCAL != REMOTE` and local is behind, warn the user:
  "Local branch is X commits behind origin. Audit results may include stale findings. Run `git pull` to sync, or proceed with current state."
  Wait for user confirmation before continuing.
- If on a feature branch (not `main`/`master`/`dev`), note it but proceed — auditing a branch is valid.
- If fetch fails (offline), note it and proceed — audit with what we have.

### Pre-flight: Ensure Codebase Indexes Exist

Before dispatching scans, verify BOTH code intelligence indexes exist and are healthy.

**Check both indexes (run in parallel):**

claude-context (Milvus):
```
mcp__claude-context__get_indexing_status(path="<PROJECT_PATH>")
```

CGC (Neo4j):
```
mcp__code-graph-context__get_repository_stats(repo_path="/workspace/<PROJECT_NAME>")
```

**Onboard if missing:**

If claude-context returns "not indexed":
```
mcp__claude-context__index_codebase(path="<PROJECT_PATH>")
```
Then poll `get_indexing_status` every 10 seconds until status is `indexed` or `indexfailed`.
If `indexfailed`, report the error and continue the audit without claude-context data.

If CGC returns an error or empty stats:
```
mcp__code-graph-context__add_code_to_graph(path="/workspace/<PROJECT_NAME>")
```
Then poll `check_job_status` with the returned job ID every 10 seconds until complete.
If the job fails, report the error and continue the audit without CGC data.

Note: Use `add_code_to_graph`, not `watch_directory` — watch has a known bug that silently fails.

**Confirm readiness:**
```
Index Status:
  claude-context: <indexed | failed | was already indexed>
  CGC:            <indexed | failed | was already indexed>
```

Do NOT skip this gate — an audit without indexes produces incomplete results.

---

## Phase 1: Parallel Scans

Dispatch ALL applicable scans simultaneously. Use agents for heavy work, main context for fast MCP calls. Skip sections not matching the `focus` argument (unless focus is "all").

### 1.1: Code Health (when focus is "all" or "code")

Dispatch a `code-oracle` agent:
```
Run a full code health audit:
- workingDir: <PROJECT_PATH>

Checks:
1. Dead code detection via CGC (mcp__code-graph-context__find_dead_code)
2. Top 10 most complex functions via CGC (mcp__code-graph-context__find_most_complex_functions)
3. Convention violations in files changed in the last 14 days
4. If CGC unavailable, fall back to grep-based analysis of unused exports

Output format: tables only, no prose. Max 20 findings per category.
```

### 1.2: Security Posture (when focus is "all" or "security")

**Codacy SRM findings:**
```
mcp__codacy__codacy_search_repository_srm_items(
  provider="gh", organization="<owner>", repository="<repo>",
  options={"statuses": ["OnTrack", "DueSoon", "Overdue"], "priorities": ["Critical", "High"]},
  limit=25
)
```

**Critical code quality issues:**
```
mcp__codacy__codacy_list_repository_issues(
  provider="gh", organization="<owner>", repository="<repo>",
  options={"levels": ["Error"], "categories": ["security", "errorprone"]},
  limit=25
)
```

**DocVault security reviews — staleness check:**
```bash
ls -t "/Volumes/DATA/GitHub/DocVault/Projects/<name>/Security Reviews/"*.md 2>/dev/null | head -1
```
If the most recent review is older than 30 days, flag it as stale.

**GitHub security alerts:**
```bash
gh api repos/<owner>/<repo>/vulnerability-alerts 2>/dev/null || echo "alerts-unavailable"
```

### 1.3: Instruction File Drift (when focus is "all" or "drift")

Check consistency across agent instruction files. Read ALL three files that exist for this project:

```bash
# Find instruction files
cat "<PROJECT_PATH>/CLAUDE.md" 2>/dev/null | head -200
cat "<PROJECT_PATH>/.codex/config.toml" 2>/dev/null || cat "<PROJECT_PATH>/Agents.md" 2>/dev/null | head -200
cat "<PROJECT_PATH>/Gemini.md" 2>/dev/null || cat "<PROJECT_PATH>/.gemini/config.md" 2>/dev/null | head -200
```

Also check the global instruction files:
```bash
cat ~/.claude/CLAUDE.md 2>/dev/null | head -100
cat ~/.codex/config.toml 2>/dev/null | head -100
```

**Extract factual claims** from each file:
- Tools/MCP servers referenced
- Services referenced (Linear, GitHub, Jira, etc.)
- Infrastructure references (IPs, ports, hostnames)
- Project names and repo paths
- Retired/deprecated items mentioned
- Workflow steps or mandatory gates

**Compare across files.** Report contradictions:
- Tool X mentioned in CLAUDE.md but not in Agents.md
- Service Y marked as "retired" in one file but still referenced in another
- Different IPs or ports for the same service
- Workflow steps that differ between agents

**Format findings as a table:**
| Claim | CLAUDE.md | Agents.md | Gemini.md | Issue |
|-------|-----------|-----------|-----------|-------|
| Linear usage | "retired 2026-03-13" | "track in INGEST project" | not mentioned | Stale reference in Agents.md |

### 1.4: Issue Landscape (when focus is "all" or "issues")

**Vault issues:**
```bash
# All open issues
grep -rl "status: backlog\|status: todo\|status: in-progress" /Volumes/DATA/GitHub/DocVault/Projects/<name>/Issues/*.md 2>/dev/null
```

For each open issue, read frontmatter to extract: id, title, status, priority, created date.

**GitHub issues:**
```bash
gh issue list --repo <owner>/<repo> --state open --json number,title,labels,createdAt --limit 30 2>/dev/null
```

**Cross-reference with recent work:**
```bash
git log --oneline -30 --no-merges
```

Identify:
- **Stale issues**: open for >30 days with no recent commits referencing them
- **Done but not closed**: issues whose work appears in git log but status is still open
- **Orphan GitHub issues**: GitHub issues with no corresponding vault issue (or vice versa)

### 1.5: Index Health (always runs)

```
mcp__claude-context__get_indexing_status(path="<PROJECT_PATH>")
```

If stale (>24h), trigger re-index:
```
mcp__claude-context__index_codebase(path="<PROJECT_PATH>")
```

Check CGC:
```
mcp__code-graph-context__get_repository_stats(repo_path="/workspace/<PROJECT_NAME>")
```

If CGC function count seems low (<50 for medium+ projects), flag for re-index.

### 1.6: Vault Health (always runs)

If Obsidian is running, include these checks (run in parallel):

```bash
OBS='/Applications/Obsidian.app/Contents/MacOS/obsidian'

# Vault stats
$OBS vault="DocVault" vault
$OBS vault="DocVault" files total

# Link health
$OBS vault="DocVault" orphans total          # Files with no incoming links
$OBS vault="DocVault" unresolved total       # Broken [[wikilinks]]
$OBS vault="DocVault" deadends total         # Files with no outgoing links

# Unresolved details (for the report)
$OBS vault="DocVault" unresolved verbose format=json

# Tag distribution
$OBS vault="DocVault" tags counts sort=count format=tsv

# Open tasks across vault
$OBS vault="DocVault" tasks todo total

# Issue landscape via base:query (structured JSON)
$OBS vault="DocVault" base:query path="Issues.base" format=json
```

Include in the terminal summary:
```
Vault Health:
  Files: N across N folders
  Orphans: N (no incoming links)
  Unresolved: N (broken wikilinks)
  Deadends: N (no outgoing links)
  Open tasks: N
```

**Unresolved links > 0 is a yellow flag** — these are broken `[[wikilinks]]` that should be fixed. List them in the full report.

---

## Phase 2: Synthesis

Wait for all scans to complete. Combine results into a structured report.

### Terminal Summary (display to user, <40 lines)

```
# Audit — <ProjectName> (<date>)

## Code Health
| Category | Count | Top Finding |
|----------|-------|-------------|
| Dead code | N | <most impactful unused symbol> |
| Complexity | N hotspots | <highest CCN function> |
| Conventions | N issues | <most common violation> |

## Security
**Codacy SRM:** N Critical, N High | N Overdue
<List Critical/Overdue items if any>
**Code Quality:** N Error-level issues
**Last Review:** <date> (<N days ago>)
<If >30 days: "Stale — schedule a new security review">

## Instruction File Drift
<N contradictions found across CLAUDE.md / Agents.md / Gemini.md>
<List each contradiction as a one-liner>
<If clean: "All instruction files consistent.">

## Issues
| Status | Count |
|--------|-------|
| In Progress | N |
| Backlog | N |
| Stale (>30d) | N |
| Done-not-closed | N |

## Index Health
| Tool | Status | Details |
|------|--------|---------|
| claude-context | Fresh/Stale | N files |
| CGC | Running/Down | N functions |

## Vault Health
<Obsidian stats if available, otherwise "Obsidian not running — skipped">

## Recommended Actions
1. <highest priority action>
2. <next>
3. <next>
```

### Full Report (write to DocVault)

Write the complete report to:
```
/Volumes/DATA/GitHub/DocVault/Projects/<name>/audit/<YYYY-MM-DD>-<HHMMSS>.md
```

Include YAML frontmatter:
```yaml
---
tags: [audit-report, <tag>]
project: <name>
date: <YYYY-MM-DD>
focus: <focus-value>
---
```

The full report includes all raw findings (not just the summary). Commit to DocVault:
```bash
cd /Volumes/DATA/GitHub/DocVault && mkdir -p "Projects/<name>/audit" && git add "Projects/<name>/audit/" && git commit -m "audit: <project> <date>" && git push origin main
```

---

## Rules

- **Parallel by default.** All scans that can run simultaneously should.
- **Graceful degradation.** If CGC is down, Codacy fails, or a file is missing — note it and continue. Never block the audit on a single failing check.
- **Facts, not opinions.** Report what the tools find. Don't editorialize.
- **Actionable output.** Every finding should map to a concrete next step.
- **Don't fix during audit.** The audit reports; the user decides what to fix. Exception: if the user says "fix it" after seeing results, then proceed.
- **Instruction drift is advisory.** Report contradictions but don't auto-sync files — each agent reads slightly different formats.
