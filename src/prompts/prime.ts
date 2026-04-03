import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { PromptDefinition } from './types.js';
import { ToolContext } from '../types.js';

const prompt: Prompt = {
  name: 'prime',
  title: 'Session Boot',
  description: 'Universal session boot. Gathers git history, open issues (priority-ranked), Codacy findings, index health, security reviews, and session context — all in main context, no blocking agents. Writes a full prime report to DocVault. Incremental delta mode activates automatically when a report exists within 24h. Use "prime full" to force a complete refresh.',
  arguments: [
    {
      name: 'mode',
      description: '"full" forces a complete prime run regardless of recent prime report (default: auto — incremental if <24h, full otherwise)',
      required: false
    }
  ]
};

async function handler(args: Record<string, any>, context: ToolContext): Promise<PromptMessage[]> {
  const forceFull = args.mode === 'full';
  return buildPrimeMessages(context, forceFull);
}

function buildPrimeMessages(context: ToolContext, forceFull: boolean): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Session boot. Run every step below in order. Write a prime report to DocVault. Display the terminal summary.

**Project path:** ${context.projectPath}
${context.dashboardUrl ? `**Dashboard:** ${context.dashboardUrl}` : ''}
${forceFull ? '**Mode: FULL** — skip the 24h delta check, always run the full pipeline.' : ''}

---

## Step 1: Project Identity

\`\`\`bash
cat .claude/project.json 2>/dev/null || echo "no-project-json"
\`\`\`

Extract \`name\`, \`tag\`, \`issuePrefix\`. If no project.json, infer name from:
\`\`\`bash
basename "$(git remote get-url origin 2>/dev/null)" .git
\`\`\`

Extract \`owner\` and \`repo\` from the git remote URL (e.g. \`git@github.com:lbruton/Forge.git\` → owner=lbruton, repo=Forge).

---

## Step 2: Check for recent prime (24h delta gate)

${forceFull ? `**FORCED FULL** — skip this check, go straight to Step 3.` : `\`\`\`bash
ls -t "/Volumes/DATA/GitHub/DocVault/Projects/<name>/prime/"*.md 2>/dev/null | head -1
\`\`\`

If a file exists and its filename timestamp is **less than 24 hours ago**, run **Delta Mode** (Step 3-Delta below) instead of the full pipeline.`}

---

## Step 3-Full: Gather Everything (main context, run ALL in parallel)

Run all of these bash commands and MCP calls simultaneously. Do not wait for one before starting the next.

**Git state:**
\`\`\`bash
git branch --show-current && git status --short && git worktree list
cat devops/version.lock 2>/dev/null || echo "no-version-lock"
\`\`\`

**Recent commits (last 15, no merges):**
\`\`\`bash
git log --oneline -15 --no-merges
\`\`\`

**Hot files — most changed in last 7 days:**
\`\`\`bash
git log --since="7 days ago" --name-only --pretty=format: | grep -v '^$' | sort | uniq -c | sort -rn | head -10
\`\`\`

**This week counts:**
\`\`\`bash
echo "commits_7d=$(git log --since='7 days ago' --oneline --no-merges | wc -l | tr -d ' ')"
echo "issues_closed=$(find /Volumes/DATA/GitHub/DocVault/Projects/<name>/Issues/Closed/ -name '*.md' -newer <(date -v-7d +"%Y-%m-%d") 2>/dev/null | wc -l | tr -d ' ')"
\`\`\`

**Open PRs:**
\`\`\`bash
gh pr list --state open --json number,title,headRefName,isDraft --jq '.[] | "#\\(.number): \\(.title) [\\(.headRefName)]\\(if .isDraft then " (draft)" else "" end)"' 2>/dev/null || echo "no-open-prs"
\`\`\`

**Vault issues (open only):**
\`\`\`bash
grep -rl "status: backlog\\|status: todo\\|status: in-progress" /Volumes/DATA/GitHub/DocVault/Projects/<name>/Issues/*.md 2>/dev/null | grep -v '/Closed/' | head -60
\`\`\`
For each file found:
- Issue ID = filename without extension (e.g. \`FORGE-42.md\` → \`FORGE-42\`)
- Read first 15 lines, extract \`title\`, \`status\`, \`priority\` from YAML frontmatter
- Default \`priority\` to \`P3\` if absent

**Active specs:**
\`\`\`bash
ls .spec-workflow/specs/ 2>/dev/null || echo "no-specs"
\`\`\`
For each spec dir found, check tasks.md for \`[-]\` or \`[ ]\` markers.

**Most recent session digest:**
\`\`\`bash
ls -t /Volumes/DATA/GitHub/DocVault/Daily\\ Digests/*<name>*/*.md 2>/dev/null | head -1
\`\`\`
If from today or yesterday, read it.

**Most recent security review:**
\`\`\`bash
ls -t "/Volumes/DATA/GitHub/DocVault/Projects/<name>/Security Reviews/"*.md 2>/dev/null | head -1
\`\`\`
If found, read the first 40 lines (severity table + posture). Note the file date. Flag as stale if >30 days old.

**Index health (run both):**
\`\`\`
mcp__claude-context__get_indexing_status(path="${context.projectPath}")
\`\`\`
\`\`\`
mcp__code-graph-context__get_repository_stats(repo_path="/workspace/<name>")
\`\`\`
If claude-context is stale (>24h), also trigger: \`mcp__claude-context__index_codebase(path="${context.projectPath}")\`

**Codacy SRM (run both):**
\`\`\`
mcp__codacy__codacy_search_repository_srm_items(
  provider="gh", organization="<owner>", repository="<repo>",
  options={"statuses": ["OnTrack", "DueSoon", "Overdue"], "priorities": ["Critical", "High"]},
  limit=25
)
\`\`\`
\`\`\`
mcp__codacy__codacy_list_repository_issues(
  provider="gh", organization="<owner>", repository="<repo>",
  options={"levels": ["Error"], "categories": ["security", "errorprone"]},
  limit=25
)
\`\`\`
If Codacy fails: note "Codacy unavailable" and continue.

**mem0 context:**
After the bash/MCP results arrive, extract the top 5–8 distinctive keywords from commit messages, PR titles, and issue titles. Then:
\`\`\`
mcp__mem0__search_memories(
  query: "<top keywords>",
  filters: {"AND": [{"agent_id": "<tag>"}]},
  limit: 5
)
\`\`\`
If fewer than 2 results, retry without the agent_id filter.

---

## Step 3-Delta: Gather delta only (if recent prime exists and not forced full)

Read the previous prime report to establish baseline. Then run in parallel:

\`\`\`bash
git log --oneline --since="<last_prime_datetime>" --no-merges
git status --short
\`\`\`
\`\`\`bash
gh pr list --state open --json number,title,headRefName,isDraft 2>/dev/null
find /Volumes/DATA/GitHub/DocVault/Projects/<name>/Issues/ -name "*.md" -newer "<latest_prime_filepath>" 2>/dev/null
find "/Volumes/DATA/GitHub/DocVault/Projects/<name>/Security Reviews/" -name "*.md" -newer "<latest_prime_filepath>" 2>/dev/null
\`\`\`
\`\`\`
mcp__codacy__codacy_search_repository_srm_items(provider="gh", organization="<owner>", repository="<repo>", options={"statuses": ["OnTrack","DueSoon","Overdue"],"priorities":["Critical","High"]}, limit=25)
\`\`\`
\`\`\`
mcp__mem0__search_memories(query="latest session <name>", filters={"AND":[{"agent_id":"<tag>"}]}, limit=3)
\`\`\`

Then jump to **Step 5-Delta**.

---

## Step 4: Assemble full report and write to DocVault

**Wait until ALL parallel operations from Step 3-Full have returned results before this step.**

Write to: \`/Volumes/DATA/GitHub/DocVault/Projects/<name>/prime/<YYYY-MM-DD>-<HHMMSS>.md\`
Run \`mkdir -p\` on the directory first. Use local time for the timestamp. Filename format: \`YYYY-MM-DD-HHMMSS\` (no colons).

Use this template exactly:

\`\`\`markdown
---
tags: [prime-report, <tag>]
project: <name>
date: <YYYY-MM-DD>
branch: <branch>
version: <from version.lock or "n/a">
---

# Prime Report — <name> (<date>)
Branch: <branch> | Status: <clean/dirty> | Version: <version>

## Recent Activity (ground truth from git + GitHub)

### Recent Commits
| Date | Commit | Message |
|------|--------|---------|
<15 rows from git log>

### Open PRs
<"No open PRs." if none. Otherwise table: PR# | Title | Branch | Draft>

### Hot Files (most-changed in 7 days)
| Changes | File |
|---------|------|
<Top 10 rows>

### This Week by the Numbers
| Metric | Count |
|--------|-------|
| Issues completed | **N** |
| Commits (7d) | **N** |
| Version range | <range or "n/a"> |

## Where We Left Off
<2–4 sentences from today's digest + mem0. If no digest: mem0 only. If neither: "No recent session history.">

## Session Logs Digested
All logs already processed.

## Index Health
| Tool | Status | Details |
|------|--------|---------|
| claude-context | <Fresh/Stale/Indexing/Error> | <N files or error> |
| CGC (Neo4j) | <Running/Down/Error> | <N files, N functions or error> |

## Code Health
Background code scan not run — use \`/audit\` or \`/prime full\` with code-oracle for dead code and complexity analysis.

## Security Reviews
<If review found:>
### Latest Review: <date>
| Severity | Count | Key Findings |
|----------|-------|--------------|
| High | **N** | <findings or "None"> |
| Medium | **N** | <findings or "None"> |
| Low | **N** | <findings or "None"> |

Overall: <posture line>
<If >30 days old: "⚠ Review is stale — consider scheduling a new scan.">
<If no reviews: "No security reviews on file.">

## Codacy Findings (live scan)

### Security (SRM)
| Priority | Count | Category | Scan Type | Finding Pattern |
|----------|-------|----------|-----------|-----------------|
<Rows from SRM results. If none: "No open security findings.">

**Summary:** **N** Critical, **N** High | **N** Overdue
<If Overdue: "⚠ Overdue items need immediate attention.">

### Critical Code Quality Issues
<List Error-level issues or "No critical code quality issues.">
<If Codacy unavailable: "Codacy MCP unavailable — skipping live security scan.">

## Project Status

### Active Specs
<Table if specs exist. If none: "No active specs.">

### Pending Approvals
<List or "No pending approvals.">

### Open Bugs (by priority)
| Priority | Issue | Summary |
|----------|-------|---------|
<Bug-type issues sorted by priority ascending>

### Open Features / In-Progress
| Priority | Issue | Summary |
|----------|-------|---------|
<Feature/enhancement issues sorted by priority ascending>

### Backlog
| Issue | Summary |
|-------|---------|
<Lower-priority items>
<If no issuePrefix: omit vault sections, show GitHub issues only>

## Suggested Session Plan
1. <highest priority actionable item>
2. <next>
3. <next>
4. <next>
5. <next>
\`\`\`

After writing the file, display **Step 5-Full** terminal summary.

---

## Step 5-Full: Terminal Summary

Display this to the user. Do not dump the full report — that lives in DocVault.

\`\`\`
# <name> — <date>
Branch: \`<branch>\` | Version: \`<version>\` | Status: <clean/dirty>

## Where We Left Off
<2–3 sentences from digest + mem0>

## This Week
| Metric | Count |
|--------|-------|
| Issues completed | **N** |
| Commits (7d) | **N** |

## Open Issues (urgency ranked)
| Priority | Issue | Title | Status |
|----------|-------|-------|--------|
<One row per open issue. Sort: P1 → P2 → P3, then in-progress → todo → backlog.
ALL open issues — no row limit. MANDATORY table — never a bullet list.
If none: one row with "—" in every column.>

## Security & Codacy
<Latest security review: date + posture, or "No reviews on file">
Codacy: <N Critical, N High | N Overdue — or "Clean" — or "Unavailable">

## Index Health
| Tool | Status |
|------|--------|
| claude-context | <status> |
| CGC | <status> |

## Suggested Session Plan
1. <highest priority>
2. <next>
3. <next>

---
Full report: DocVault/Projects/<name>/prime/<filename>.md
\`\`\`

---

## Step 5-Delta: Delta terminal summary + DocVault write

Write delta report to: \`/Volumes/DATA/GitHub/DocVault/Projects/<name>/prime/<YYYY-MM-DD>-<HHMMSS>.md\`

\`\`\`markdown
---
tags: [prime-report, prime-delta, <tag>]
project: <name>
date: <YYYY-MM-DD>
branch: <branch>
version: <version or "n/a">
delta_from: <previous prime filename>
---

# Prime Delta — <name> (<date>)
Branch: <branch> | Status: <clean/dirty> | Version: <version>
Delta from: <previous prime datetime>

## New Commits Since Last Prime
| Date | Commit | Message |
|------|--------|---------|
<New commits or "No new commits.">

## Changes
- **New commits**: N since last prime
- **Open PRs**: N (note any changes)
- **New/changed issues**: N (list titles)
- **Git status**: <clean/dirty with file list>

## Security Reviews
<New review summary, or "No new security reviews since last prime.">

## Codacy Findings (live)
- **N** open SRM findings (Critical: N, High: N) | **N** Overdue
- Net new since last prime: N (list if any)

## Session Context (mem0)
<2–3 sentences or "No recent session context found.">

## Suggested Next Steps
1. <based on new commits and open work>
2. <next>
3. <next>
\`\`\`

Display to user:
\`\`\`
# <name> — <date> (delta)
Branch: \`<branch>\` | Version: \`<version>\` | Since: <last prime time>

## What Changed
- N new commits | N open PRs | N changed issues
<If new security review: "New security review — N High, N Medium">
<Codacy: N Critical, N High | N Overdue — or "No change">

## Session Context
<2–3 sentences>

## Suggested Next Steps
1. <highest>
2. <next>
3. <next>

---
Delta report: DocVault/Projects/<name>/prime/<filename>.md
Full prime last ran: <datetime> — run \`/prime full\` to force complete refresh
\`\`\`

---

## Rules

- **Do not produce ANY output until all parallel operations in Step 3 have returned.** Wait for every bash command and MCP call to complete before assembling the report.
- **Always write to DocVault.** Both full and delta runs write a file. No exceptions.
- **Issues table is mandatory.** Never collapse to a bullet list.
- **mkdir -p the prime/ directory** before writing.
- **Timestamp format:** \`YYYY-MM-DD-HHMMSS\` (local time, no colons, filesystem-safe).
- **Full report goes to DocVault only.** The terminal displays only the summary template.
- **Codacy failures are non-blocking.** Note the error and continue.
- **CGC / claude-context failures are non-blocking.** Note the error and continue. Never restart containers.
- **After the terminal summary, the session is ready.** Do not prompt to run prime again.`
      }
    }
  ];
}

export const primePrompt: PromptDefinition = {
  prompt,
  handler
};
