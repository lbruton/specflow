---
name: codacy-resolve
description: >-
  Triage and resolve Codacy findings for the current repository. Pulls SRM security items
  and code quality issues via Codacy MCP, classifies each finding, then executes resolutions:
  code fixes, .codacy.yml exclusion updates, or Codacy ignore markers. Tracks triaged items
  so repeat runs skip already-reviewed findings. Use this skill whenever the user mentions
  "codacy", "codacy triage", "codacy findings", "codacy issues", "clean up codacy",
  "resolve codacy", "codacy gate", "SRM findings", "code quality gate", or wants to
  manage Codacy configuration (.codacy.yml). Also use when Codacy quality gates are
  failing on a PR and the user wants to address the findings.
---

# Codacy Resolve

Triage, classify, and resolve Codacy findings for any repository. Works across all
projects — uses the git remote to auto-detect the Codacy organization and repository.

## When to Run

- Codacy quality gate is failing on a PR
- User wants to clean up Codacy findings
- Periodic hygiene pass on code quality / security
- After major refactors that may introduce new findings
- When `.codacy.yml` needs configuration updates

## Phase 0: Project Discovery

Auto-detect repository context from git:

```bash
git remote get-url origin 2>/dev/null
# Parse: git@github.com:owner/repo.git or https://github.com/owner/repo.git
# Extract: provider (gh/gl/bb), organization, repository
```

Also check for existing triage state:

```bash
cat .codacy-triage.json 2>/dev/null || echo "No triage history"
```

## Phase 1: Gather Findings

Pull findings from Codacy MCP in parallel — two categories:

### Security Findings (SRM)

```
mcp__codacy__codacy_search_repository_srm_items(
  provider, organization, repository,
  options={
    "statuses": ["OnTrack", "DueSoon", "Overdue"],
    "priorities": ["Critical", "High", "Medium"]
  },
  limit=100
)
```

### Code Quality Issues

```
mcp__codacy__codacy_list_repository_issues(
  provider, organization, repository,
  options={
    "levels": ["Error", "Warning"],
    "categories": [<filter if user specified, else all>]
  },
  limit=100
)
```

### Filtering

If the user specified a filter (category, severity, file path), apply it:

| Filter | How |
|--------|-----|
| `--security` | SRM only, skip quality issues |
| `--quality` | Quality issues only, skip SRM |
| `--category <cat>` | Filter quality issues by category (security, errorprone, complexity, codestyle, etc.) |
| `--severity <sev>` | Filter by priority/level (Critical, High, Medium, Error, Warning) |
| `--file <path>` | Use `codacy_get_file_issues` for a specific file |

### Skip Already-Triaged

Load `.codacy-triage.json` and filter out findings whose ID has already been triaged.
This file tracks decisions so repeat runs don't re-review the same items.

## Phase 2: Present Triage Table

Display findings in a structured table for classification:

```
Codacy Findings — <repo> (<N> new, <M> previously triaged)
============================================================

Security (SRM)
 #  | Priority | Category        | Scan  | Finding                              | File
 S1 | Critical | DoS             | SCA   | RegExp with non literal argument     | (dependency)
 S2 | High     | InsecureStorage | SAST  | Logger with potential hardcoded secret| sidecar/app.py:45

Quality
 #  | Severity | Category    | Tool      | Finding                    | File:Line
 Q1 | Error    | security    | ESLint    | Generic Object Injection   | src/store/index.ts:234
 Q2 | Warning  | codestyle   | ESLint    | prefer-nullish-coalescing  | src/components/TreeNode.tsx:190

Classification options:
  fix-now         — Valid, fix the code immediately
  false-positive  — Not applicable (update .codacy.yml or pattern config)
  pre-existing    — Valid but in untouched code, not introduced by recent work
  won't-fix       — Disagree with the rule for this codebase (ignore in Codacy)
  deferred        — Valid but out of scope, track as issue for later
```

Wait for user to classify each finding or approve a batch classification.

### Batch Classification Shortcuts

Users can classify groups at once:

- "all SCA findings are false-positive" — applies to all SCA scan type items
- "Q1-Q5 pre-existing" — range classification
- "all test file findings false-positive" — file pattern classification

## Phase 3: Execute Resolutions

After user approves classifications, execute each:

### fix-now

1. Read the file and understand the finding
2. Make the code fix
3. Stage and continue (batch commit at end)

### false-positive

Two sub-strategies based on scope:

**File/path exclusion** (broad — excludes entire files from a tool):
```yaml
# .codacy.yml
engines:
  opengrep:
    exclude_paths:
      - "src/__tests__/**"
```

**Pattern-level ignore** (surgical — disables a specific rule):
Check if the tool supports inline suppression comments:
- ESLint: `// eslint-disable-next-line rule-name`
- Opengrep/Semgrep: `// nosemgrep: rule-id`
- Bandit: `# nosec`
- Pylint: `# pylint: disable=rule-name`

Prefer inline suppression for individual false positives. Use `.codacy.yml`
`exclude_paths` when an entire directory produces false positives (e.g., test files).

### pre-existing

No action needed — note in the triage log for awareness. These findings existed
before recent work and are not the current focus.

### won't-fix

Document the rationale and suppress. Two options:

1. **Inline suppression** with a comment explaining why:
   ```js
   // codacy:ignore — localStorage is intentional for this SPA, no server secrets
   localStorage.setItem(key, value);
   ```

2. **Codacy dashboard** — if the finding has an `htmlUrl`, note it for manual
   "ignore" action in the Codacy UI (MCP doesn't currently support programmatic ignore).

### deferred

Create or reference a tracking issue:
```
Deferred: <finding summary>
Tracked in: FORGE-XX / to be created
```

## Phase 4: Commit and Update Triage Log

### Commit code fixes

If any `fix-now` items produced code changes:

```bash
git add <changed files>
git commit -m "fix: resolve Codacy findings — <summary>

<list of findings fixed>

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Commit .codacy.yml changes

If `.codacy.yml` was updated:

```bash
git add .codacy.yml
git commit -m "chore: update .codacy.yml — exclude false positives from <tools>

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Update triage log

Write/update `.codacy-triage.json` in the repo root:

```json
{
  "lastTriaged": "2026-03-30T23:00:00Z",
  "findings": [
    {
      "id": "finding-uuid-or-hash",
      "title": "RegExp with non literal argument",
      "classification": "false-positive",
      "reason": "SCA dependency finding — not in our code",
      "triagedAt": "2026-03-30T23:00:00Z"
    }
  ]
}
```

Add `.codacy-triage.json` to `.gitignore` if not already there — triage decisions
are local developer context, not shared via the repo.

### Commit triage log

```bash
git add .codacy-triage.json .gitignore
git commit -m "chore: update Codacy triage log

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Phase 5: Summary Report

```
Codacy Triage — <repo> — Summary
==================================
Total findings reviewed: N

| Classification  | Count | Action Taken |
|-----------------|-------|-------------|
| fix-now         | N     | Code fixed, committed |
| false-positive  | N     | .codacy.yml updated / inline suppression |
| pre-existing    | N     | Noted, no action |
| won't-fix       | N     | Suppressed with rationale |
| deferred        | N     | Tracked in issues |

Commits: <list of SHAs>
Triage log updated: .codacy-triage.json (<M> total entries)

Next steps:
- Push commits and verify Codacy re-scans
- <any manual actions needed, e.g., "Ignore S3 in Codacy dashboard">
```

## Understanding Codacy Findings

### SRM vs Quality Issues

**SRM (Security and Risk Management)** findings come from security-focused scanners:
- **SAST** — Static Application Security Testing (code-level vulnerabilities)
- **SCA** — Software Composition Analysis (dependency vulnerabilities)
- **Secrets** — Hardcoded credentials/API keys
- **IaC** — Infrastructure as Code misconfigurations

SRM items have `priority` (Critical/High/Medium/Low) and `status` (OnTrack/DueSoon/Overdue).

**Quality issues** come from linters and code analysis tools:
- Categories: security, errorprone, performance, complexity, unusedcode, codestyle, etc.
- Levels: Error (critical), Warning (medium), Info (minor)

### Common False Positive Patterns

| Pattern | Why It's False | Resolution |
|---------|---------------|------------|
| SCA "Generic Object Injection Sink" | Flagged in dependencies, not your code | false-positive (SCA dependency) |
| Opengrep "hardcoded password" in test files | Test fixtures with fake credentials | Exclude `__tests__/` from Opengrep |
| "Unnecessary optional chain" on `globalThis.crypto?.subtle` | Intentional guard for test environments | won't-fix with inline comment |
| ESLint non-null assertion in tests | Test assertions where we know the value exists | Exclude test files from ESLint in .codacy.yml |
| "Logger with hardcoded secret" on log messages mentioning paths | Log message mentions "key" or "secret" in path string, not actual secret | false-positive |

### .codacy.yml Reference

```yaml
---
# Exclude entire directories from specific tools
engines:
  opengrep:
    exclude_paths:
      - "src/__tests__/**"
      - "**/*.test.ts"
  eslint:
    exclude_paths:
      - "src/__tests__/**"

# Global exclusions (all tools)
exclude_paths:
  - "node_modules/**"
  - "dist/**"
  - ".claude/**"

# Language-specific settings
languages:
  typescript:
    extensions:
      - ".ts"
      - ".tsx"
```

## Important Notes

- Always ask for user approval before executing classifications — never auto-fix
- Security findings (`SAST`) are never "pre-existing" — always classify as fix-now or won't-fix with explicit rationale
- SCA findings in dependencies may need `npm audit` / `pip install --upgrade` rather than code fixes
- The Codacy MCP does not support programmatic "ignore" — for won't-fix items that need dashboard action, note the `htmlUrl` for the user
- Keep `.codacy-triage.json` out of version control (add to `.gitignore`)
- If `.codacy.yml` doesn't exist yet, create it — don't modify Codacy dashboard settings directly
