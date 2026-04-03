import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { PromptDefinition } from './types.js';
import { ToolContext } from '../types.js';

const prompt: Prompt = {
  name: 'prime',
  title: 'Session Quick-Start',
  description: 'Fast session boot (~15 seconds). Gathers git status, open issues/PRs, active specs, today\'s digest, and a targeted mem0 search — all in main context, no agents dispatched. Use "prime full" for a deep scan including code health, security, and indexing.',
  arguments: [
    {
      name: 'mode',
      description: 'Execution mode: "quick" (default, 15 seconds) or "full" (deep scan with agents, 60-90 seconds)',
      required: false
    }
  ]
};

async function handler(args: Record<string, any>, context: ToolContext): Promise<PromptMessage[]> {
  const mode = args.mode || 'quick';

  if (mode === 'full') {
    return buildFullPrimeMessages(context);
  }

  return buildQuickPrimeMessages(context);
}

function buildQuickPrimeMessages(context: ToolContext): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Quick session start. Gather project status fast — no agents, no indexing. Target: 15 seconds.

**Context:**
- Project: ${context.projectPath}
${context.dashboardUrl ? `- Dashboard: ${context.dashboardUrl}` : ''}

---

## Phase 0: Project Identity (instant)

\`\`\`bash
cat .claude/project.json 2>/dev/null
\`\`\`

Extract: \`name\`, \`tag\`, \`issuePrefix\`. If no project.json, infer from:
\`\`\`bash
basename "$(git remote get-url origin 2>/dev/null)" .git
\`\`\`

---

## Phase 1: Ground Truth (parallel, main context — no agents)

Run ALL of these in parallel using Bash:

\`\`\`bash
# Branch and working tree state
git branch --show-current && git status --short

# Recent commits (last 15)
git log --oneline -15 --no-merges

# Open worktrees
git worktree list

# Version lock (if exists)
cat devops/version.lock 2>/dev/null || echo "no-version-lock"
\`\`\`

\`\`\`bash
# Open PRs
gh pr list --state open --json number,title,headRefName,isDraft --jq '.[] | "PR #\\(.number): \\(.title) [\\(.headRefName)]\\(if .isDraft then " (draft)" else "" end)"' 2>/dev/null || echo "gh-unavailable"
\`\`\`

Also gather these (parallel with above):

**Vault Issues** — if \`issuePrefix\` exists, scan the vault issues folder:
\`\`\`bash
# List open issues (scan frontmatter for status != done)
grep -rl "status: backlog\\|status: todo\\|status: in-progress" /Volumes/DATA/GitHub/DocVault/Projects/<name>/Issues/*.md 2>/dev/null | head -50
\`\`\`
For each file found, read the first 15 lines and extract \`title\`, \`status\`, and \`priority\` from YAML frontmatter. If \`priority\` is absent, treat as P3. Store all three fields — they drive the urgency table in Phase 3.

**Active Specs** — if \`.spec-workflow/specs/\` exists:
- Use the **spec-status** tool (no specName — returns all specs) or:
\`\`\`bash
ls .spec-workflow/specs/ 2>/dev/null
\`\`\`
For each spec, check if tasks.md has any \`[-]\` (in-progress) or \`[ ]\` (pending) markers.

**Today's Digest** — check if a session digest was written today or yesterday:
\`\`\`bash
# Find most recent digest for this project
ls -t "/Volumes/DATA/GitHub/DocVault/Daily Digests/<ProjectFolder>/"*.md 2>/dev/null | head -1
\`\`\`
If found and from today/yesterday, read it for context on where we left off.

---

## Phase 2: Context (1-2 mem0 searches)

Extract **keywords** from Phase 1 results:
- Significant nouns from commit messages (skip generic: fix, update, add, remove, chore)
- PR titles
- Issue titles
- Spec names

Build 1-2 targeted mem0 searches:

\`\`\`
mcp__mem0__search_memories(
  query: "<top 5-8 distinctive keywords from Phase 1>",
  filters: {"AND": [{"agent_id": "<project-tag>"}]},
  limit: 5
)
\`\`\`

If the project tag yields <2 results, also try without the agent_id filter for cross-project context.

From the results, extract only what adds context BEYOND what git/issues show:
- Verbal decisions and rationale
- Planned next steps from last session
- Known blockers or dependencies
- Gotchas or warnings for areas being worked on

---

## Phase 3: Present

Display a concise terminal summary.

\`\`\`
# <ProjectName> — <date>
Branch: \`<branch>\` | Version: \`<version>\` | Status: <clean/dirty>

## Where We Left Off
<2-3 sentences from today's digest + mem0 context. If no digest: use mem0 alone. If neither: "No recent session history.">

## Open PRs & Active Specs
<One line each: open PRs and active specs with pending/in-progress task counts. If none: omit section.>

## Open Issues (urgency ranked)
| Priority | Issue | Title | Status |
|----------|-------|-------|--------|
<All open issues sorted by priority ascending (P1 first), then by status (in-progress > todo > backlog). Show ALL open issues — no row limit. If no open issues: "No open issues.">

## Suggested Next Steps
1. <highest priority — based on in-progress items, open PRs, or recent commits>
2. <next priority>
3. <next priority>
\`\`\`

---

## Rules

- **No agents dispatched.** Everything runs in main context.
- **No indexing.** CGC and claude-context are not touched (that's /audit's job).
- **No Codacy queries.** Security scanning is /audit's job.
- **No DocVault archive.** Quick primes don't write reports to disk.
- **No session-digest processing.** That's /wrap's job at end of session.
- **Target 15 seconds.** If it's taking longer, you're doing too much.
- **Present, don't prescribe.** Show what's there, suggest next steps, then stop. The user decides what to work on.
- **After presenting the summary, the session is ready for work.** Do not prompt to run prime again.`
      }
    }
  ];
}

function buildFullPrimeMessages(context: ToolContext): PromptMessage[] {
  return [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Full session start with deep scanning. This includes everything from quick prime PLUS code health, security, and indexing.

**Context:**
- Project: ${context.projectPath}
${context.dashboardUrl ? `- Dashboard: ${context.dashboardUrl}` : ''}

---

## Step 1: Run Quick Prime First

Execute the full quick prime sequence (Phase 0-3 from the quick mode) to get the baseline status fast. Present the quick summary to the user immediately — don't wait for the deep scans.

---

## Step 2: Deep Scans (parallel agents, background)

After presenting the quick summary, dispatch these in parallel:

### 2.1: Code Health (Agent: code-oracle, background)
Dispatch a \`code-oracle\` agent:
\`\`\`
Run a code health check:
- query: "dead code, complexity hotspots, convention violations"
- workingDir: ${context.projectPath}
- Focus on: dead code (CGC), top 5 complex functions (CGC), convention issues in files changed last 7 days
- Keep report compact — tables only, max 15 findings
\`\`\`

### 2.2: Security Scan (main context, parallel with 2.1)
Query Codacy for open findings:
\`\`\`
mcp__codacy__codacy_search_repository_srm_items(
  provider="gh", organization="<owner>", repository="<repo>",
  options={"statuses": ["OnTrack", "DueSoon", "Overdue"], "priorities": ["Critical", "High"]},
  limit=25
)
\`\`\`

Also query critical code quality issues:
\`\`\`
mcp__codacy__codacy_list_repository_issues(
  provider="gh", organization="<owner>", repository="<repo>",
  options={"levels": ["Error"], "categories": ["security", "errorprone"]},
  limit=25
)
\`\`\`

### 2.3: Index Health (main context, parallel)
\`\`\`
mcp__claude-context__get_indexing_status(path="${context.projectPath}")
\`\`\`

If stale (>24h), trigger a re-index:
\`\`\`
mcp__claude-context__index_codebase(path="${context.projectPath}")
\`\`\`

Check CGC if available:
\`\`\`
mcp__code-graph-context__get_repository_stats(repo_path="/workspace/<name>")
\`\`\`

---

## Step 3: Deep Report

When agents return, present an extended report BELOW the quick summary:

\`\`\`
## Deep Scan Results

### Code Health
<Dead code count, top complexity hotspots, convention issues — from code-oracle agent>

### Security
**Codacy SRM:** N Critical, N High | N Overdue
<List any Critical or Overdue items>
**Code Quality:** N Error-level issues
<If clean: "No open security or critical findings.">

### Index Health
| Tool | Status | Details |
|------|--------|---------|
| claude-context | Fresh/Stale/Indexing | N files |
| CGC | Running/Down | N functions, N relationships |
\`\`\`

---

## Step 4: Archive to DocVault

Write the full report (quick summary + deep results) to:
\`\`\`
/Volumes/DATA/GitHub/DocVault/Projects/<name>/prime/<YYYY-MM-DD>-<HHMMSS>.md
\`\`\`

Create the directory if needed (\`mkdir -p\`). Include YAML frontmatter:
\`\`\`yaml
---
tags: [prime-report, <tag>]
project: <name>
date: <YYYY-MM-DD>
branch: <branch>
---
\`\`\`

Commit to DocVault (direct to main).

---

## Rules

- **Quick summary first.** Don't make the user wait for agents — show quick results immediately.
- **Agents run in background.** Present deep results as they arrive.
- **Graceful degradation.** If CGC is down, Codacy fails, or agents timeout — note it and continue.
- **Full mode is opt-in.** Users run this when they want a thorough check, not every session.`
      }
    }
  ];
}

export const primePrompt: PromptDefinition = {
  prompt,
  handler
};
