---
description: "Spec-driven development orchestrator. Creates and executes spec-workflow specifications from an issue — Requirements → Design → Tasks → Implementation with dashboard approvals and subagent dispatch."
argument-hint: "<ISSUE-ID> [--resume]"
---

$ARGUMENTS

End-to-end spec-driven development: fetch an issue, create or resume a spec-workflow specification, orchestrate all 4 phases (Requirements → Design → Tasks → Implementation), and dispatch subagents for implementation with two-stage review.

**Does NOT:** brainstorm or explore open-ended design (that's `/chat` → `/discover` → `/spec`).
**Does NOT:** claim a version lock or create a worktree (that's `/release patch`).
**Does NOT:** push code or create PRs (that's `/release`).
**Does NOT:** create steering documents (that's the `steering-guide` MCP tool).

---

## HARD RULE: MCP Tools Are Mandatory — Even When Resuming

> **Whether creating a new spec or resuming an existing one, you MUST use the MCP tools and follow the template-driven procedures. There are ZERO exceptions.**

Resuming a spec does NOT mean "wing it." It means:

1. **Call `spec-workflow-guide`** — load the workflow. Every time. Even if you think you know the workflow.
2. **Call `spec-status`** — check which phase the spec is in and what's been completed.
3. **Read the template** for the current phase from the resolved workflow root `templates/` directory. Do not write spec documents from memory or by guessing the format.
4. **Use `approvals`** — request dashboard approval after writing each document. Never accept verbal approval. Never skip the approval → poll → delete cycle.
5. **Use `log-implementation`** — log every task completion with full artifacts. Never mark `[x]` without a successful log call.
6. **Use `spec-list`** — find the existing spec by issue ID before assuming a spec name or directory structure.

**Common violations this rule prevents:**
- Writing a `requirements.md` from scratch without reading the template → produces documents missing required sections (References, User Stories, Acceptance Criteria, Non-Functional Requirements)
- Writing `tasks.md` without reading the resolved workflow template → produces tasks missing `_Prompt`, `_Leverage`, `_Requirements` fields, VERSION CHECKOUT GATE, and Standard Closing Tasks
- Skipping `approvals` and asking the user "does this look good?" → verbal approval is never valid
- Resuming Phase 5 without calling `spec-status` → leads to re-implementing completed tasks or missing in-progress state
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

**Argument:** An issue ID (e.g. `STAK-XXX`, `SFLW-XXX`), required. If not provided, stop and ask.
**Optional flag:** `--resume` — skip directly to the current in-progress phase.

### Project detection

Read the config files to resolve all paths:

```bash
# .claude/project.json is optional — read it if present
[ -f .claude/project.json ] && cat .claude/project.json
cat .specflow/config.json
```

From `.claude/project.json` extract (if the file exists):
- `issuePrefix` → used for issue file lookups
- `name` → display label

If `.claude/project.json` is absent, read `issue_prefix` from `.specflow/config.json` and use it as `issuePrefix`.

From `.specflow/config.json` extract:
- `project` → project name for specflow paths
- `docvault` → relative path to DocVault (e.g. `../DocVault`)
- `issue_backend` → `"plane"` or `"docvault"` (default if absent: `"docvault"`)
- `plane_project_id` → only when `issue_backend` is `"plane"` (uuid)

**Resolve the specflow root path:**

```bash
if [ ! -f .specflow/config.json ]; then
  echo "ERROR: .specflow/config.json not found. Run this command from the project root." >&2
  exit 1
fi
DOCVAULT=$(python3 -c "import json, os; print(os.path.abspath(json.load(open('.specflow/config.json')).get('docvault','../DocVault')))")
PROJECT=$(python3 -c "import json; print(json.load(open('.specflow/config.json')).get('project',''))")
ISSUE_BACKEND=$(python3 -c "import json; print(json.load(open('.specflow/config.json')).get('issue_backend','docvault'))")
SPECFLOW_ROOT="$DOCVAULT/specflow/$PROJECT"
```

Store `SPECFLOW_ROOT`, `DOCVAULT`, and `ISSUE_BACKEND` for the entire session.

### Fetch issue (backend-aware)

**If `ISSUE_BACKEND == "plane"`:**

Use the Plane MCP to fetch the issue:

```bash
mcp__plane__get_issue_using_readable_identifier
  project_identifier: {issuePrefix — from .claude/project.json if present, else issue_prefix from .specflow/config.json}
  issue_identifier: {sequence number — strip the prefix from $ARGUMENTS}
```

For example, if `$ARGUMENTS` is `SFLW-3`, pass `project_identifier: "SFLW"` and `issue_identifier: "3"`.

Extract from the response:
- `name` → title
- `description_html` → description
- `priority` → priority
- `state` → resolve state name via `mcp__plane__list_states` (cache once per session)
- `labels` → resolve label names via `mcp__plane__list_labels`

**If `ISSUE_BACKEND == "docvault"` (legacy / unmigrated projects):**

Read the issue file from DocVault:

```bash
cat $DOCVAULT/Projects/$PROJECT/Issues/{ISSUE-ID}.md
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
State:    {state}
Labels:   {labels}

{description (first 3 lines)}
```

---

## Step 1: Check Existing Spec

### Search by issue ID first (canonical match)

```
spec-list query: "STAK-XXX"
```

If `spec-list` returns a match for this issue ID, use that spec (even if the title portion differs — the issue ID is canonical).

### Fallback: search by title keywords

If no issue ID match, also search by title keywords:

```
spec-list query: "{kebab-title keywords}"
```

### Legacy fallback: directory listing

```bash
spec-list query: "{ISSUE-ID}"
```

### Decision

**If a matching spec is found (any method):**
- Call `spec-status` with the matched `specName` to see phase progress
- Display current state (phase, task completion counts, pending approvals)
- **MANDATORY before resuming any phase:** Call `spec-workflow-guide` to reload the full workflow procedure. Do NOT rely on memory of how the workflow works.
- **MANDATORY before writing/editing any phase document:** Read the template for that phase from the resolved workflow root `templates/` directory. Do NOT write from memory.
- If `--resume` flag was passed, jump directly to the current phase (but still load guide + template first)
- Otherwise ask: "Resume at current phase, or restart from scratch?"
- If Phase 5 in progress, jump to Step 5 (Implementation)

**If no spec exists:**
- Inform: "No existing spec found. Starting Phase 1 — Requirements."
- Proceed to Step 2

**Resume procedure (applies to ALL phases, no exceptions):**

| Resuming Phase | Required MCP calls before any edits |
|---|---|
| Phase 1 (Requirements) | `spec-workflow-guide` → `spec-status` → read `templates/requirements-template.md` from the resolved workflow root |
| Phase 2 (Discovery) — optional | `spec-workflow-guide` → `spec-status` → read `templates/discovery-template.md` from the resolved workflow root → read existing `requirements.md` |
| Phase 3 (Design) | `spec-workflow-guide` → `spec-status` → read `templates/design-template.md` from the resolved workflow root → read existing `requirements.md` |
| Phase 4 (Tasks) | `spec-workflow-guide` → `spec-status` → read `templates/tasks-template.md` from the resolved workflow root → read existing `requirements.md` + `design.md` |
| Phase 5 (Implementation) | `spec-workflow-guide` → `spec-status` → read existing `tasks.md` → check Implementation Logs directory |

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
   cat <workflowRoot>/templates/requirements-template.md
   ```

3. **Search mem0 for prior context:**
   ```
   mcp__mem0__search_memories
     query: "{issue title} {specName}"
     limit: 5
   ```

4. **Run codebase-search** (mandatory before any design work):
   Invoke the `codebase-search` skill. Produce a Codebase Impact Report covering:
   - Files most likely to be touched
   - Existing patterns relevant to this feature
   - Potential ripple effects
   - Prior art in the codebase

   <HARD-GATE>
   Do not write requirements until codebase-search is complete and Impact Report is produced.
   </HARD-GATE>

5. **Ask clarifying questions** — one at a time, grounded in the Impact Report findings.

6. **Write requirements.md:**
   Call `mcp__specflow__write-spec-doc` with:
   - `specName`: the derived spec name
   - `documentType`: `"requirements"`
   - `content`: the drafted requirements document
   If the tool returns a gate error, surface the error and stop.

7. **Request dashboard approval:**
   ```
   approvals action:"request"
     title: "Requirements: {issue title}"
     filePath: "specs/{specName}/requirements.md"
     type: "document"
     category: "spec"
     categoryName: "{specName}"
   ```

8. **Poll for approval:**
   ```
   approvals action:"status"
   ```
   Check periodically until status is approved, rejected, or needs-revision.

9. **On approved:** `approvals action:"delete"` → proceed to Step 2.5 (or skip to Step 3 if the user chooses).
10. **On needs-revision:** update the document per feedback, create a new approval request.
11. **On rejected:** stop and inform the user.

---

## Step 2.5: Phase 2 — Discovery (optional)

> **This phase is optional.** After requirements are approved, ask the user: "Would you like to run a Discovery phase to research the codebase and competing approaches before designing? You can skip directly to Phase 3." If the user skips, proceed to Step 3.

> **SESSION BOUNDARY RULE:** If resuming this phase, you MUST call `spec-workflow-guide`, `spec-status`, read `templates/discovery-template.md`, and read the approved `requirements.md` before writing anything.

1. **Load workflow guide (MANDATORY — every session):**
   ```
   spec-workflow-guide
   ```

2. **Read discovery template (MANDATORY — do NOT write from memory):**
   ```bash
   cat <workflowRoot>/templates/discovery-template.md
   ```

3. **Read approved requirements.md** to ground the research in what was approved.

4. **Run research:** codebase-search skill → Context7 for framework/library docs → web search for competing approaches and prior art. Focus on questions raised by the requirements.

5. **Write discovery.md:**
   Call `mcp__specflow__write-spec-doc` with:
   - `specName`: the derived spec name
   - `documentType`: `"discovery"`
   - `content`: the drafted discovery document
   If the tool returns a gate error, surface the error and stop.

6. **Request dashboard approval** (same pattern as Step 2 — request → poll → delete on approval).

7. On approved → proceed to Step 3.

---

## Step 3: Phase 3 — Design

> **SESSION BOUNDARY RULE:** If you are entering this phase from a handoff or new session, you MUST: (1) call `spec-workflow-guide`, (2) call `spec-status`, (3) read the design template, (4) read the existing `requirements.md`. Do not write design.md from memory.

1. **Load workflow guide (MANDATORY — every session):**
   ```
   spec-workflow-guide
   ```

2. **Read design template (MANDATORY — do NOT write from memory):**
   ```bash
   cat <workflowRoot>/templates/design-template.md
   ```

3. **Reference requirements.md and Impact Report** from Step 2.

3. **Propose 2-3 approaches**, each referencing existing codebase patterns found in the Impact Report.

4. **Present design in sections**, get user feedback after each section.

5. **Write design.md:**
   Call `mcp__specflow__write-spec-doc` with:
   - `specName`: the derived spec name
   - `documentType`: `"design"`
   - `content`: the drafted design document
   If the tool returns a gate error, surface the error and stop.

6. **Request dashboard approval** (same pattern as Step 2 — request → poll → delete on approval).

7. On approved → proceed to Step 4.

---

## Step 4: Phase 4 — Tasks

> **SESSION BOUNDARY RULE:** If you are entering this phase from a handoff or new session, you MUST: (1) call `spec-workflow-guide`, (2) call `spec-status`, (3) read the tasks template from the resolved workflow root, (4) read the existing `requirements.md` + `design.md`. The tasks template contains critical project-specific patterns, gates, and prompt structures that CANNOT be improvised.

1. **Load workflow guide (MANDATORY — every session):**
   ```
   spec-workflow-guide
   ```

2. **Read tasks template (MANDATORY — the user-template has project-specific gates):**
   ```bash
   cat <workflowRoot>/templates/tasks-template.md
   ```

3. **Reference requirements.md + design.md.**

3. **Create tasks** with the following fields for each:
   - `_Prompt` — Role, Task, Restrictions, Success criteria
   - `_Leverage` — files and utilities to use
   - `_Requirements` — which requirements this task implements
   - **Recommended Agent** — Claude / Codex / Gemini / Human
   - **File Touch Map** — CREATE / MODIFY / TEST with file paths

4. **Write tasks.md:**
   Call `mcp__specflow__write-spec-doc` with:
   - `specName`: the derived spec name
   - `documentType`: `"tasks"`
   - `content`: the drafted tasks document
   If the tool returns a gate error, surface the error and stop.

5. **Request dashboard approval** (same pattern as Steps 2–3).

6. On approved → proceed to Step 5.

---

## Step 5: Phase 5 — Implementation

> **SESSION BOUNDARY RULE:** If you are entering this phase from a handoff or new session, you MUST:
> 1. Call `spec-workflow-guide`
> 2. Call `spec-status` to see task progress
> 3. Read the full `tasks.md`
> 4. Check Implementation Logs to see what's already done
> 5. **Ask the user how they want to execute** (step 4 below) — subagent dispatch, parallel terminals, or single task. Do NOT skip this question. Do NOT assume the previous session's choice carries over. **This question is MANDATORY every time Phase 5 is entered, even on resume.**

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
   Phase 5 — Implementation ready. X tasks pending, Y already complete.

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
   ls "<workflowRoot>/specs/{specName}/Implementation Logs/" 2>/dev/null
   ```

   #### c) Dispatch implementer subagent
   Use the Agent tool with:
   - The full `_Prompt` text from the task
   - All `_Leverage` file paths
   - Reference: `<workflowRoot>/templates/implementer-prompt-template.md` (if exists)
   - **Inject specialized role context** based on the task's File Touch Map (see Specialized Agent Roles below)
   - Subagent implements, tests, commits, and self-reviews
   - **Main context does NOT write implementation code**

   #### d) Dispatch spec compliance reviewer
   Use the Agent tool with:
   - Reference: `<workflowRoot>/templates/spec-reviewer-template.md` (if exists)
   - Reads actual code changes vs task requirements
   - If fail → dispatch implementer again to fix → re-review
   - Must pass before proceeding

   #### e) Dispatch code quality reviewer
   Use the Agent tool with:
   - Reference: `<workflowRoot>/templates/code-quality-reviewer-template.md` (if exists)
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

**Progress checkpoint** after each task:
- Save progress to mem0 periodically: spec name, completed tasks, next task ID

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
| **Frontend Developer** | `coding-standards` + `ui-design` | Any file in `js/`, `css/`, or `index.html` |
| **Backend/Infra** | `coding-standards` | Files in `devops/`, `.github/`, config files |
| **General** | `coding-standards` | All other files |

This ensures every subagent writes code that matches project conventions.

---

### After all tasks are `[x]` (any option)

4. Verify every task has a corresponding implementation log entry (cross-check task count vs log count)
5. Call `spec-status` to confirm 100% complete
6. Proceed to Step 5.5

---

## Step 5.5: Post-Implementation Gates (MANDATORY)

After all implementation tasks are `[x]` and logged, two gates must pass before the spec is complete. Dispatch both in parallel — they are independent.

### a) Test Authoring — dispatch test author agent

Dispatch a subagent with:
- All implementation logs for this spec (read from `<workflowRoot>/specs/{specName}/Implementation Logs/`)
- The `browserbase-test-maintenance` skill
- Instructions: "Review the implementation logs. Author new test steps that cover the new or changed behavior. Add steps to the existing test suite."

The agent reads the implementation logs to understand what changed, then writes test steps that verify the new behavior works end-to-end.

<HARD-GATE>
No spec is complete without test coverage for new behavior.
If no user-facing behavior changed (pure refactor, config-only), this gate can be skipped with explicit justification logged to the implementation log.
</HARD-GATE>

### b) DocVault Update — dispatch documentation agent

Dispatch a subagent with:
- All implementation logs for this spec
- The `vault-update` skill
- The DocVault repo path: `../DocVault`
- Instructions: "Review the implementation logs. Identify which DocVault pages are affected by these changes. Update the affected pages to reflect the new behavior, architecture, or API changes. Commit changes directly to main."

The agent reads the implementation logs, cross-references the DocVault pages, and updates affected pages.

<HARD-GATE>
No spec is complete without DocVault pages reflecting the current state.
If no documented behavior changed, this gate can be skipped with explicit justification logged to the implementation log.
</HARD-GATE>

### Gate completion

After both agents return successfully:
- Log a summary entry: `log-implementation` with taskId `"post-gates"`, listing test files created and wiki pages updated
- Proceed to Step 6

---

## Step 6: Close Issues & Completion

### a) Close issue (backend-aware)

**If `ISSUE_BACKEND == "plane"`:**

Resolve the `Done` state UUID (cached from earlier `list_states` call) and close via:

```bash
mcp__plane__update_issue
  project_id: {plane_project_id from .specflow/config.json}
  issue_id: {issue uuid from the earlier get_issue_using_readable_identifier response}
  issue_data:
    state: {Done state uuid}
```

Plane records `completed_at` automatically. Only close the issue this spec implemented — don't auto-cascade to parent/child issues.

**If `ISSUE_BACKEND == "docvault"`:**

Update the vault issue file in DocVault:

```bash
# Read the issue file, update frontmatter:
#   status: done
#   completed: {today's date}
#   updated: {today's date}
```

Edit the issue markdown file at `$DOCVAULT/Projects/$PROJECT/Issues/{ISSUE-ID}.md`.
If the issue has sub-issues, close those too (update each sub-issue file's status to `done`).

### b) Close GitHub issue (if user-facing)

Check the vault issue's `github_issue` frontmatter field:

```bash
# If github_issue is populated:
gh issue close {github_issue} --repo {owner}/{repo}
# Verify:
gh issue view {github_issue} --repo {owner}/{repo} --json state
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
Tests:    X new test steps authored
DocVault: X pages updated

Next: /release patch to version bump and create PR
```

<HARD-GATE>
A spec with open issues is NOT complete. Verify the vault issue status is `done` before declaring completion.
</HARD-GATE>

---

## Integration

**Called by:**
- User directly: `/spec {ISSUE-ID}`
- After `/discover` completes (discovery's terminal state)
- After `/start-patch` selects an issue (if the issue needs a spec)

**Calls:**
- `codebase-search` skill (Step 2, mandatory before requirements)
- Agent tool (Step 5, subagent dispatch for implementation + review)
- `browserbase-test-maintenance` skill (Step 5.5a, test authoring gate)
- `vault-update` skill (Step 5.5b, DocVault documentation gate)
- `/release patch` handoff suggestion (Step 6, after completion)
