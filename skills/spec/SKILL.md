---
name: spec
description: "Spec-driven development orchestrator. Creates and executes spec-workflow specifications from an issue — Requirements → Design → Tasks → Implementation with dashboard approvals and subagent dispatch."
user-invocable: true
argument-hint: "<ISSUE-ID> [--resume]"
allowed-tools: >-
  Bash, Read, Write, Edit, Glob, Grep, Agent,
  mcp__specflow__spec-workflow-guide,
  mcp__specflow__spec-status,
  mcp__specflow__approvals,
  mcp__specflow__log-implementation,
  mcp__specflow__spec-list,
  mcp__mem0__search_memories
---

$ARGUMENTS

# Spec Workflow Orchestrator

End-to-end spec-driven development: fetch an issue, create or resume a spec-workflow specification, orchestrate all 4 phases (Requirements → Design → Tasks → Implementation), and dispatch subagents for implementation with two-stage review.

**Does NOT:** brainstorm or explore open-ended design (that's `/chat` → `/discover` → `/spec`).
**Does NOT:** claim a version lock or create a worktree (that's `/release patch`).
**Does NOT:** push code or create PRs mid-spec (PR is the FINAL Step 6 action, after ALL tasks + gates pass).
**Does NOT:** create steering documents (that's the `steering-guide` MCP tool).
**Does NOT:** write spec files inside the project directory. ALL spec artifacts go in DocVault.

<HARD-GATE>
**SPEC FILES LIVE IN DOCVAULT — NEVER IN THE PROJECT.**

Specs, templates, steering docs, approvals, and implementation logs are stored in DocVault at the workflow root resolved from `.specflow/config.json`. The ONLY file inside the project is `.specflow/config.json` itself.

**NEVER** write `requirements.md`, `design.md`, `tasks.md`, or any spec artifact to:
- `.specflow/specs/` (WRONG — obsolete pre-consolidation path)
- The project's working directory (WRONG — project is for source code)
- Any path that does not start with the resolved DocVault workflow root

**ALWAYS** resolve the workflow root from `.specflow/config.json` first (Step 0), then write to `{workflowRoot}/specs/{specName}/`.

If you catch yourself writing to `.specflow/specs/` or anywhere inside the project directory for spec artifacts, STOP and fix the path.
</HARD-GATE>

---

## HARD RULE: MCP Tools Are Mandatory — Even When Resuming

> **Whether creating a new spec or resuming an existing one, you MUST use the MCP tools and follow the template-driven procedures. There are ZERO exceptions.**

Resuming a spec does NOT mean "wing it." It means:

1. **Call `spec-workflow-guide`** — load the workflow. Every time. Even if you think you know the workflow.
2. **Call `spec-status`** — check which phase the spec is in and what's been completed.
3. **Read the template** for the current phase from `{workflowRoot}/templates/`. Do not write spec documents from memory or by guessing the format.
4. **Use `approvals`** — request dashboard approval after writing each document. Never accept verbal approval. Never skip the approval → poll → delete cycle.
5. **Use `log-implementation`** — log every task completion with full artifacts. Never mark `[x]` without a successful log call.
6. **Use `spec-list`** — find the existing spec by issue ID before assuming a spec name or directory structure.

**Common violations this rule prevents:**
- Writing a `requirements.md` from scratch without reading the template → produces documents missing required sections (References, User Stories, Acceptance Criteria, Non-Functional Requirements)
- Writing `tasks.md` without reading the user-template → produces tasks missing `_Prompt`, `_Leverage`, `_Requirements` fields, VERSION CHECKOUT GATE, and Standard Closing Tasks
- Skipping `approvals` and asking the user "does this look good?" → verbal approval is never valid
- Resuming Phase 4 without calling `spec-status` → leads to re-implementing completed tasks or missing in-progress state
- Editing spec files directly without knowing the current approval state → overwrites pending approvals

**Self-check before writing ANY spec document:**
- [ ] Did I call `spec-workflow-guide`?
- [ ] Did I call `spec-status` (if resuming)?
- [ ] Did I read the template for this phase?
- [ ] Am I following the template structure section-by-section?
- [ ] Will I request dashboard approval after writing?

If any answer is "no," STOP and do the missing step first.

---

## Step 0: Parse Arguments & Project Detection

**Argument:** An issue ID (e.g. `STAK-XXX`, `SWF-XXX`), required. If not provided, stop and ask.
**Optional flag:** `--resume` — skip directly to the current in-progress phase.

### Project detection

Read `.claude/project.json` (in the current working directory):

```bash
cat .claude/project.json
```

Extract:
- `issuePrefix` → used for issue file lookups
- `name` → display label

### Resolve workflow root (MANDATORY — all file paths depend on this)

Read `.specflow/config.json` to find the DocVault-based workflow root:

```bash
cat .specflow/config.json
```

From the config, resolve the **workflow root** — the directory where all spec artifacts live:

```
{project_directory}/{docvault_relative_path}/specflow/{project_name}
```

Example: if config says `"docvault": "../DocVault"` and `"project": "StakTrakr"`, the workflow root is `../DocVault/specflow/StakTrakr` (relative) or the absolute equivalent.

Store this as `{workflowRoot}` — ALL subsequent file paths in this workflow use it:
- Templates: `{workflowRoot}/templates/`
- Specs: `{workflowRoot}/specs/{specName}/`
- Steering: `{workflowRoot}/steering/`
- Approvals: resolved automatically by MCP tools

<HARD-GATE>
If `.specflow/config.json` does not exist, STOP. The project has not been onboarded to specflow.
Do NOT fall back to `.specflow/specs/` — that path is obsolete post-DocVault consolidation.
</HARD-GATE>

### Fetch issue from vault

Read the issue file from DocVault:

```bash
cat /Volumes/DATA/GitHub/DocVault/Projects/{project}/Issues/{ISSUE-ID}.md 2>/dev/null || \
cat /Volumes/DATA/GitHub/DocVault/Projects/{project}/Issues/Closed/{ISSUE-ID}.md
```

Extract: title, description, priority, status, tags from frontmatter.

### Derive spec name

Combine the issue ID with the kebab-case title: `{ISSUE-ID}-{kebab-title}` (e.g. `STAK-456-clone-picker-modal`).
Store as `specName` for all subsequent file paths.

**Hard gate:** If no issue ID argument is provided, STOP. Do not allow spec creation without an issue.

### Display summary

```
## Spec: {specName}

Issue:    {ISSUE-ID} — {title}
Priority: {priority}
Status:   {status}
Tags:     {tags}

{description (first 3 lines)}
```

---

## Step 1: Check Existing Spec

### Search by issue ID first (canonical match)

```
spec-list query: "{ISSUE-ID}"
```

If `spec-list` returns a match for this issue ID, use that spec (even if the title portion differs — the issue ID is canonical).

### Fallback: search by title keywords

If no issue ID match, also search by title keywords:

```
spec-list query: "{kebab-title keywords}"
```

### Legacy fallback: directory listing

```bash
ls {workflowRoot}/specs/{specName}/ 2>/dev/null
```

### Decision

**If a matching spec is found (any method):**
- Call `spec-status` with the matched `specName` to see phase progress
- Display current state (phase, task completion counts, pending approvals)
- **MANDATORY before resuming any phase:** Call `spec-workflow-guide` to reload the full workflow procedure. Do NOT rely on memory of how the workflow works.
- **MANDATORY before writing/editing any phase document:** Read the template for that phase from `{workflowRoot}/templates/`. Do NOT write from memory.
- If `--resume` flag was passed, jump directly to the current phase (but still load guide + template first)
- Otherwise ask: "Resume at current phase, or restart from scratch?"
- If Phase 4 in progress, jump to Step 5 (Implementation)

**If no spec exists:**
- Inform: "No existing spec found. Starting Phase 1 — Requirements."
- Proceed to Step 2

**Resume procedure (applies to ALL phases, no exceptions):**

| Resuming Phase | Required MCP calls before any edits |
|---|---|
| Phase 1 (Requirements) | `spec-workflow-guide` → `spec-status` → read `{workflowRoot}/templates/requirements-template.md` |
| Phase 2 (Design) | `spec-workflow-guide` → `spec-status` → read `{workflowRoot}/templates/design-template.md` → read existing `requirements.md` |
| Phase 3 (Tasks) | `spec-workflow-guide` → `spec-status` → read `{workflowRoot}/templates/tasks-template.md` → read existing `requirements.md` + `design.md` |
| Phase 4 (Implementation) | `spec-workflow-guide` → `spec-status` → read existing `tasks.md` → check Implementation Logs directory |

Skipping any of these calls is a workflow violation.

---

## Step 2: Phase 1 — Requirements

> **SESSION BOUNDARY RULE:** If you are entering this phase from a handoff, new session, or `--resume`, you MUST complete steps 1-3 below before writing anything. Do not assume you remember the template structure from a previous session.

1. **Load workflow guide (MANDATORY — every session, every phase):**
   ```
   spec-workflow-guide
   ```

2. **Read requirements template (MANDATORY — do NOT write from memory):**
   ```bash
   cat {workflowRoot}/templates/requirements-template.md
   ```

3. **Search mem0 for prior context:**
   ```
   mcp__mem0__search_memories
     query: "{issue title} {specName}"
     limit: 5
   ```

4. **Check for existing discovery brief:**
   ```bash
   ls /Volumes/DATA/GitHub/DocVault/specflow/{project}/discovery/{ISSUE-ID}.md 2>/dev/null
   ```
   If a `/discover` brief exists for this issue, read it. The discovery findings inform requirements — user stories, edge cases, and technical constraints that were surfaced during exploration.

5. **Ask clarifying questions** — one at a time, grounded in the issue description and any discovery findings.

6. **Write requirements.md** (include YAML frontmatter — the template has it):
   ```
   {workflowRoot}/specs/{specName}/requirements.md
   ```
   Create the directory if it doesn't exist: `mkdir -p {workflowRoot}/specs/{specName}`

7. **Request dashboard approval:**
   ```
   approvals action:"request"
     title: "Requirements: {issue title}"
     filePath: "specs/{specName}/requirements.md"
     type: "document"
     category: "spec"
     categoryName: "{specName}"
   ```
   Note: `filePath` is relative to the workflow root — the MCP tool resolves it automatically. Do NOT pass absolute paths or paths with `../`.

8. **Poll for approval:**
   ```
   approvals action:"status"
   ```
   Check periodically until status is approved, rejected, or needs-revision.

9. **On approved:** `approvals action:"delete"` → proceed to Step 3.
10. **On needs-revision:** update the document per feedback, create a new approval request.
11. **On rejected:** stop and inform the user.

---

## Step 3: Phase 2 — Design

> **SESSION BOUNDARY RULE:** If you are entering this phase from a handoff or new session, you MUST: (1) call `spec-workflow-guide`, (2) call `spec-status`, (3) read the design template, (4) read the existing `requirements.md`. Do not write design.md from memory.

1. **Load workflow guide (MANDATORY — every session):**
   ```
   spec-workflow-guide
   ```

2. **Read design template (MANDATORY — do NOT write from memory):**
   ```bash
   cat {workflowRoot}/templates/design-template.md
   ```

3. **Discovery Research (MANDATORY — before any design decisions):**

   This is the discovery step. It happens here — after requirements are approved and before design proposals — so that design decisions are grounded in actual codebase state, not assumptions.

   a. **Read steering documents** for this project:
      ```bash
      cat {workflowRoot}/steering/product.md 2>/dev/null
      cat {workflowRoot}/steering/tech.md 2>/dev/null
      cat {workflowRoot}/steering/structure.md 2>/dev/null
      ```

   b. **Run codebase-search** — invoke the `codebase-search` skill. Produce a Codebase Impact Report:
      - Files most likely to be touched
      - Existing patterns relevant to this feature
      - Potential ripple effects
      - Prior art in the codebase

   c. **Reference any existing discovery brief** — if `/discover` was run before `/spec`, read `DocVault/specflow/{project}/discovery/{ISSUE-ID}.md` and incorporate its findings into the Impact Report. Do NOT duplicate the research — just reference and extend.

   <HARD-GATE>
   Do not write design.md until codebase-search is complete and the Impact Report is produced.
   Discovery research has NO separate approval gate — the approval is on design.md itself.
   </HARD-GATE>

4. **Reference requirements.md and Impact Report.**

5. **Propose 2-3 approaches**, each referencing existing codebase patterns found in the Impact Report.

6. **Present design in sections**, get user feedback after each section.

7. **Write design.md** (include YAML frontmatter — the template has it):
   ```
   {workflowRoot}/specs/{specName}/design.md
   ```

8. **Request dashboard approval** (same pattern as Step 2 — request → poll → delete on approval).

9. On approved → proceed to Step 4.

---

## Step 4: Phase 3 — Tasks

> **SESSION BOUNDARY RULE:** If you are entering this phase from a handoff or new session, you MUST: (1) call `spec-workflow-guide`, (2) call `spec-status`, (3) read the tasks template (user-templates first!), (4) read the existing `requirements.md` + `design.md`. The tasks template contains critical project-specific patterns, gates, and prompt structures that CANNOT be improvised.

1. **Load workflow guide (MANDATORY — every session):**
   ```
   spec-workflow-guide
   ```

2. **Read tasks template (MANDATORY — may have project-specific gates):**
   ```bash
   cat {workflowRoot}/templates/tasks-template.md
   ```

3. **Reference requirements.md + design.md.**

4. **Create tasks** with the following fields for each:
   - `_Prompt` — Role, Task, Restrictions, Success criteria
   - `_Leverage` — files and utilities to use
   - `_Requirements` — which requirements this task implements
   - **Recommended Agent** — Claude / Codex / Gemini / Human
   - **File Touch Map** — CREATE / MODIFY / TEST with file paths

5. **Write tasks.md** (include YAML frontmatter — the template has it):
   ```
   {workflowRoot}/specs/{specName}/tasks.md
   ```

6. **Request dashboard approval** (same pattern as Steps 2–3).

7. On approved → proceed to Step 5.

---

## Step 5: Phase 4 — Implementation

<HARD-GATE>
**NO PR CREATION DURING IMPLEMENTATION.** Do NOT create a pull request, push to remote, run Codacy scans, run Codex peer review, or perform final validation loops during this phase. Those happen AFTER the spec is complete — at the very end, in Step 6. The PR is the FINAL artifact of a completed spec, not an intermediate step.

If you feel the urge to create a PR after implementing tasks — STOP. Check: are ALL tasks `[x]`? Has Step 5.5 (post-implementation gate) passed? Has Step 6 run? If not, you are not done.
</HARD-GATE>

> **SESSION BOUNDARY RULE:** If you are entering this phase from a handoff or new session, you MUST:
> 1. Call `spec-workflow-guide`
> 2. Call `spec-status` to see task progress
> 3. Read the full `tasks.md`
> 4. Check Implementation Logs to see what's already done
> 5. **Ask the user how they want to execute** (step 4 below) — subagent dispatch, parallel terminals, or single task. Do NOT skip this question. Do NOT assume the previous session's choice carries over. **This question is MANDATORY every time Phase 4 is entered, even on resume.**

1. **Load workflow guide (MANDATORY — every session):**
   ```
   spec-workflow-guide
   ```

2. **Check current progress:**
   ```
   spec-status specName:"{specName}"
   ```

3. **Read tasks.md** to find all pending tasks (`[ ]`).

4. **Ask the user how to execute (MANDATORY — never skip, even on resume):**

   <HARD-GATE>
   You MUST present this choice and wait for the user's answer before writing any code or dispatching any agents.
   Do NOT assume the answer. Do NOT carry over a choice from a previous session. Ask every time.
   </HARD-GATE>

   ```
   Phase 4 — Implementation ready. X tasks pending, Y already complete.

   How do you want to execute?

   1. Subagent dispatch   — this session orchestrates, subagents implement in background
   2. Parallel terminals  — I'll print the prompts, you paste into fresh terminals
   3. Single task         — pick one task to implement in this session
   ```

   Wait for user selection before proceeding.

---

### Option 1: Subagent Dispatch

**Main context orchestrates. Subagents implement.**

**Parallel vs Serial decision:** Before dispatching, read all pending tasks and compare their **File Touch Map** entries. Tasks that share NO files (no overlapping MODIFY/CREATE paths) are independent and SHOULD be dispatched in parallel using multiple Agent tool calls in a single message. Tasks that share files MUST run sequentially. Group independent tasks into parallel batches, then run each batch concurrently.

For each pending task (or parallel batch of independent tasks):

   #### a) Mark in-progress
   Edit `tasks.md`: change `[ ]` → `[-]` for the current task.

   #### b) Check prior implementation logs
   ```bash
   ls "{workflowRoot}/specs/{specName}/Implementation Logs/" 2>/dev/null
   ```

   #### c) Dispatch implementer subagent

   Check the task's **Recommended Agent** field from tasks.md:

   - **Codex** → dispatch via `subagent_type: "codex:codex-rescue"` with `run_in_background: true`
     - Prompt must include the full `_Prompt`, `_Leverage` paths, and "After implementation: commit all changes, log-implementation, mark task [x]"
     - If Codex is unavailable (plugin not installed), fall back to `subagent_type: "general-purpose"` and note the fallback in the implementation log
   - **Gemini** → dispatch via `subagent_type: "general-purpose"` (Gemini CLI runs in terminal; print prompt to user via Option 2 instead when Gemini is preferred)
   - **Claude** or unspecified → dispatch via `subagent_type: "general-purpose"`

   All agent dispatches include:
   - The full `_Prompt` text from the task
   - All `_Leverage` file paths
   - Reference: `{workflowRoot}/templates/implementer-prompt-template.md` (if exists)
   - **Inject specialized role context** based on the task's File Touch Map (see Specialized Agent Roles below)
   - Subagent implements, tests, commits, and self-reviews
   - **Main context does NOT write implementation code**

   #### d) Dispatch spec compliance reviewer
   Use the Agent tool with:
   - Reference: `{workflowRoot}/templates/spec-reviewer-template.md` (if exists)
   - Reads actual code changes vs task requirements
   - If fail → dispatch implementer again to fix → re-review
   - Must pass before proceeding

   #### e) Dispatch code quality reviewer
   Use the Agent tool with:
   - Reference: `{workflowRoot}/templates/code-quality-reviewer-template.md` (if exists)
   - Checks architecture, error handling, testing, production readiness
   - If Critical or Important issues found → fix → re-review
   - Must pass before proceeding

   #### f) Log implementation (MANDATORY)
   ```
   log-implementation
     specName: "{specName}"
     taskId: "{taskId}"
     summary: "{what was done}"
     filesModified: [...]
     filesCreated: [...]
     statistics: { linesAdded: N, linesRemoved: N }
     artifacts: {
       apiEndpoints: [...],
       components: [...],
       functions: [...],
       classes: [...],
       integrations: [...]
     }
   ```

   <HARD-GATE>
   A task without an implementation log is NOT complete.
   Log EACH task individually as you finish it — not in a batch after all tasks are done.
   </HARD-GATE>

   #### g) Mark complete
   Edit `tasks.md`: change `[-]` → `[x]` (only after log-implementation succeeds).

   **NEVER mark a task `[x]` if it was skipped, blocked, or failed.** Use these states instead:
   - `[x]` — task completed successfully, log-implementation call succeeded
   - `[-]` — task in progress
   - `[!]` — task BLOCKED — requires human decision (e.g., skipped peer review, unresolved findings)
   - `[ ]` — task not started

   A task marked `[!]` means the spec is NOT complete until the user resolves it.

**Context budget check** after each task:
- After 10+ dispatches or feeling context pressure → save progress to mem0 (spec name, completed tasks, next task ID) and suggest starting a new session with `/spec {ISSUE-ID} --resume`

---

### Option 2: Parallel Terminals

**Follow-up question (MANDATORY):**

```
Would you like:
  a) Copy-paste prompts — I'll print prompt blocks here, you paste into terminals
  b) Dispatch to iTerm — I'll create named tabs automatically via /dispatch-terminals
```

Wait for the user's choice.

#### Option 2a: Copy-Paste Prompts

For each pending task, read the `_Prompt` from tasks.md and print a self-contained prompt block the user can paste into a fresh terminal.

Format each block as:

````
---
### Task {N}: {task title}
Recommended Agent: {Claude / Codex / Gemini}

```
/spec {ISSUE-ID} --resume

Implement Task {N} from spec "{specName}":

{full _Prompt text from tasks.md}

_Leverage: {file paths}

After implementation:
1. Self-review against task requirements
2. Run log-implementation for this task
3. Mark task [x] in tasks.md
```
---
````

Print ALL task blocks at once so the user can open multiple terminals and paste them in parallel.

After printing, remind:
```
Paste each prompt into a fresh terminal running `/spec {ISSUE-ID} --resume`.
Each session will pick up the spec context and implement its task.
Come back here or run `/spec {ISSUE-ID}` again to verify all tasks are logged.
```

#### Option 2b: Dispatch to iTerm

Invoke the `dispatch-terminals` skill with the current spec name:

```
/dispatch-terminals {specName}
```

This creates named iTerm tabs, CDs to the project, and writes prompt files.
The user starts their preferred agent (claude, codex, gemini) in each tab manually.

---

### Option 3: Single Task

Ask which task number to implement. Then follow the same subagent flow as Option 1 but for that one task only. After completion, show remaining task count and suggest re-running `/spec {ISSUE-ID}` in a new session for the next task.

---

### Specialized Agent Roles

When dispatching implementer subagents (Option 1 or Option 3), inject role-specific skill context based on the task's **File Touch Map**:

| Role | Inject these skills | Trigger: File Touch Map contains |
|------|--------------------|----------------------------------|
| **Frontend Developer** | `frontend-design:frontend-design` | Any file in `js/`, `css/`, or `index.html` |
| **Backend/Infra** | *(none — follow existing patterns)* | Files in `devops/`, `.github/`, config files |
| **General** | *(none — follow existing patterns)* | All other files |

This ensures frontend subagents have design system context; all agents follow existing project conventions.

---

### After all tasks are `[x]` (any option)

4. Verify every task has a corresponding implementation log entry (cross-check task count vs log count)
5. **Check for any `[!]` blocked tasks** — if ANY exist, stop and present the blocked items to the user for resolution. Do NOT proceed to Step 5.5 with blocked tasks.
6. Call `spec-status` to confirm 100% complete
7. Proceed to Step 5.5

---

## Step 5.5: Post-Implementation Gate (MANDATORY)

After all implementation tasks are `[x]` and logged, the following gate must pass before the spec is complete.

### Test Coverage

Read the project's steering document (`steering/tech.md`) to determine the correct test strategy:
- **If steering says Playwright CLI / local dev server** → run the project's test command against a local build
- **If steering says Browserbase / Stagehand** → run `/bb-test` against the PR preview URL (for web-facing E2E only)
- **If no test strategy in steering** → ask the user what test approach to use

Do NOT assume Browserbase. Do NOT hardcode a test framework. The steering document is the authority on how this project tests.

<HARD-GATE>
No spec is complete without test coverage for new behavior.
If no user-facing behavior changed (pure refactor, config-only), this gate can be skipped with explicit justification logged to the implementation log.
</HARD-GATE>

### DocVault Update — dispatch documentation agent

Dispatch a subagent with:
- All implementation logs for this spec
- The `vault-update` skill
- The DocVault repo path: `/Volumes/DATA/GitHub/DocVault`
- Instructions: "Review the implementation logs. Identify which DocVault pages are affected by these changes. Update the affected pages to reflect the new behavior, architecture, or API changes. Commit changes directly to main."

The agent reads the implementation logs, cross-references the DocVault pages, and updates affected pages.

<HARD-GATE>
No spec is complete without DocVault pages reflecting the current state.
If no documented behavior changed, this gate can be skipped with explicit justification logged to the implementation log.
</HARD-GATE>

### Gate completion

After test coverage is verified and documentation is updated:
- Log a summary entry: `log-implementation` with taskId `"post-gates"`, listing test results and DocVault pages updated
- Proceed to Step 6

---

## Step 5.75: Draft PR for Human Review (MANDATORY)

After Step 5.5 passes (all tasks `[x]`, tests authored, DocVault updated), create a **draft PR** and stop for human review.

1. **Verify worktree branch** — all commits should be on the feature branch, not main/master.
   If commits are on main, STOP and alert the user — do not create the PR.

2. **Create draft PR:**
   ```bash
   gh pr create --draft \
     --title "{specName}: {issue title}" \
     --body "Spec: {specName}
   Issue: {ISSUE-ID}
   Tasks: X/X complete
   
   ## Changes
   {brief summary from implementation logs}
   
   ## Review checklist
   - [ ] Implementation matches spec requirements
   - [ ] Tests pass
   - [ ] DocVault updated
   
   /cc @lbruton — ready for review"
   ```

3. **Print the PR URL** and stop:
   ```
   ## Draft PR Created — Waiting for Review

   PR:       {PR URL}
   Branch:   {branch}
   Commits:  {commit count}

   Review the PR. When satisfied, close the spec:
     /spec {ISSUE-ID} --resume   (to run Step 6 — close issues)
   ```

<HARD-GATE>
STOP HERE. Do NOT close issues, do NOT merge, do NOT continue to Step 6.
The human must review the draft PR first. Step 6 runs ONLY after the user explicitly resumes.
</HARD-GATE>

---

## Step 6: Close Issues & Completion

> **Only reach here via explicit `/spec {ISSUE-ID} --resume` AFTER the human has reviewed the draft PR from Step 5.75.**

### a) Run quality gates on the PR

1. Run Codacy scan on the PR (if Codacy MCP available)
2. Resolve any Critical/Important findings before proceeding

<HARD-GATE>
The PR must pass all status checks before closing issues.
</HARD-GATE>

### b) Close vault issue

Update the vault issue file in DocVault:

```bash
# Read the issue file, update frontmatter:
#   status: done
#   completed: {today's date}
#   updated: {today's date}
```

Edit the issue markdown file at `DocVault/Projects/{project}/Issues/{ISSUE-ID}.md`.
If the issue has sub-issues, close those too (update each sub-issue file's status to `done`).

### b) Close GitHub issue (if user-facing)

Check the vault issue's `github_issue` frontmatter field:

```bash
# If github_issue is populated:
gh issue close {github_issue} --repo lbruton/{repo}
# Verify:
gh issue view {github_issue} --repo lbruton/{repo} --json state
```

If `scope: internal` or `github_issue` is empty, skip this step.

### c) Display completion summary

```
## Spec Complete!

Spec:     {specName}
Issue:    {ISSUE-ID} — {title} → CLOSED
GitHub:   #{github_issue} → CLOSED (or N/A if internal)
Tasks:    X/X complete
Logs:     X implementation logs filed
Tests:    {test results summary}
DocVault: X pages updated
PR:       {PR URL} (draft — ready to mark ready for review)

Next: mark PR ready → /release patch to version bump
```

<HARD-GATE>
A spec with open issues is NOT complete. Verify the vault issue status is `done` before declaring completion.
</HARD-GATE>

---

## Integration

**Called by:**
- User directly: `/spec {ISSUE-ID}`
- After `/discover` completes (discovery's terminal state)

**Calls:**
- `codebase-search` skill (Step 3, mandatory before design)
- Agent tool (Step 5, subagent dispatch for implementation + review)
- `vault-update` skill (Step 5.5, DocVault documentation gate)
- `/release patch` handoff suggestion (Step 6, after completion)
