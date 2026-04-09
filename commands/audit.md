---
description: "On-demand project health check — code quality (CGC), security (Codacy SRM), instruction file drift, issue landscape, and index health."
argument-hint: "[code|security|drift|issues|all]"
---

$ARGUMENTS

Run a project health audit. Focus: use the argument if provided, otherwise default to "all".

Valid focus areas: "code" (dead code, complexity), "security" (Codacy, SRM), "drift" (instruction file consistency), "issues" (stale/orphan issues), or "all".

---

## Phase 0: Project Identity

```bash
cat .claude/project.json 2>/dev/null
git remote get-url origin 2>/dev/null
```

Extract: `name`, `tag`, `issuePrefix`, `owner`, `repo` (parse from git remote).

---

## Phase 1: Parallel Scans

Dispatch ALL applicable scans simultaneously.

### 1.1: Code Health (if focus includes "code")

Dispatch a `code-oracle` agent in background:
- Dead code detection via CGC
- Top 10 most complex functions via CGC
- Convention violations in files changed in the last 14 days
- Output format: tables only, max 20 findings per category

### 1.2: Security Posture (if focus includes "security")

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

**GitHub security alerts:**
```bash
gh api repos/<owner>/<repo>/vulnerability-alerts 2>/dev/null || echo "alerts-unavailable"
```

### 1.3: Instruction File Drift (if focus includes "drift")

Read all instruction files that exist for this project:
- `CLAUDE.md`, `.codex/config.toml` or `Agents.md`, `Gemini.md` or `.gemini/config.md`
- Also check global: `~/.claude/CLAUDE.md`, `~/.codex/config.toml`

Extract factual claims from each and compare. Report contradictions as a table:
| Claim | CLAUDE.md | Agents.md | Gemini.md | Issue |

### 1.4: Issue Landscape (if focus includes "issues")

**Vault issues:** scan frontmatter for open issues
**GitHub issues:** `gh issue list --state open --limit 30`
**Cross-reference with git log** to identify: stale issues, done-but-not-closed, orphan GitHub issues

### 1.5: Index Health (always runs)

```
mcp__claude-context__get_indexing_status(path="<projectPath>")
mcp__code-graph-context__get_repository_stats(repo_path="/workspace/<name>")
```

If stale (>24h), trigger re-index.

---

## Phase 2: Synthesis

Wait for all scans to complete. Present terminal summary (<40 lines) and write full report to:
```
../DocVault/Projects/<name>/audit/<YYYY-MM-DD>-<HHMMSS>.md
```

Commit to DocVault directly.

---

## Rules

- **Parallel by default.** All scans that can run simultaneously should.
- **Graceful degradation.** If CGC is down, Codacy fails, or a file is missing — note it and continue.
- **Facts, not opinions.** Report what the tools find.
- **Actionable output.** Every finding should map to a concrete next step.
- **Don't fix during audit.** Report; the user decides what to fix.
