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
  mcp__specflow__write-spec-doc,
  mcp__mem0__search_memories,
  mcp__plane__get_issue_using_readable_identifier,
  mcp__plane__list_states,
  mcp__plane__list_labels,
  mcp__plane__update_issue
---

$ARGUMENTS

# Spec Workflow Orchestrator

End-to-end spec-driven development: fetch an issue, create or resume a spec-workflow specification, orchestrate all 4 phases (Requirements → Design → Tasks → Implementation), and dispatch subagents for implementation with two-stage review.

**Cross-model handoff note:** When generating tasks.md for handoff to another CLI (Kimi, GLM, OpenCode, Codex), always use exact MCP tool names in `_Prompt` fields: `mcp__specflow__log-implementation`, `mcp__specflow__spec-status`, `mcp__specflow__approvals`, etc. Never use short names like "log-implementation" or skill syntax like "specflow:log-implementation" — these don't resolve in all CLIs.

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
3. **Read the template** for the current phase. Resolution order: project override (`$SPECFLOW_ROOT/templates/`) → global user override (`$SPECFLOW_DOCVAULT/user-templates/`) → global default (`$SPECFLOW_GLOBAL/templates/`). Do not write spec documents from memory or by guessing the format.
4. **Use `approvals`** — request dashboard approval after writing each document. Never accept verbal approval. Never skip the approval → poll → delete cycle.
5. **Use `log-implementation`** (`mcp__specflow__log-implementation`) — log every task completion with full artifacts. Never mark `[x]` without a successful log call.
6. **Use `spec-list`** — find the existing spec by issue ID before assuming a spec name or directory structure.

**Common violations this rule prevents:**
- Writing a `requirements.md` from scratch without reading the template → produces documents missing required sections (References, User Stories, Acceptance Criteria, Non-Functional Requirements)
- Writing `tasks.md` without reading the user-template → produces tasks missing `_Prompt`, `_Leverage`, `_Requirements` fields, VERSION CHECKOUT GATE, and Standard Closing Tasks
- Skipping `approvals` and asking the user "does this look good?" → verbal approval is never valid
- Resuming Phase 5 without calling `spec-status` → leads to re-implementing completed tasks or missing in-progress state
- Editing spec files directly without knowing the current approval state → overwrites pending approvals
- Use `mcp__specflow__write-spec-doc` to write spec documents (requirements.md, discovery.md, design.md, tasks.md) — never use the `Write` tool for files in the spec directory. The tool enforces phase gates server-side.

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

Read both config files to resolve all paths:

Use the `Read` tool on `.claude/project.json` and `.specflow/config.json`.

From `.claude/project.json` extract:
- `issuePrefix` → used for issue file lookups
- `name` → display label

From `.specflow/config.json` extract:
- `project` → project name for specflow paths
- `docvault` → relative path to DocVault (e.g. `../DocVault`)
- `issue_backend` → `"plane"` or `"docvault"` (default if absent: `"docvault"`)
- `plane_workspace` → only when `issue_backend` is `"plane"` (e.g. `"lbruton"`)
- `plane_project_id` → only when `issue_backend` is `"plane"` (uuid)

**Resolve the specflow root path** — this is used for ALL subsequent file reads (templates, specs, steering, discovery):

```bash
DOCVAULT=$(cd "$(pwd)/$(python3 -c "import json; print(json.load(open('.specflow/config.json')).get('docvault','../DocVault'))")" && pwd)
PROJECT=$(python3 -c "import json; print(json.load(open('.specflow/config.json')).get('project',''))")
ISSUE_BACKEND=$(python3 -c "import json; print(json.load(open('.specflow/config.json')).get('issue_backend','docvault'))")
SPECFLOW_ROOT="$DOCVAULT/specflow/$PROJECT"
SPECFLOW_GLOBAL="$DOCVAULT/specflow"
```

Store these variables for the entire session:
- `SPECFLOW_ROOT` → `{docvault}/specflow/{project}` (project-specific: specs, templates, steering, approvals)
- `SPECFLOW_GLOBAL` → `{docvault}/specflow` (global templates fallback)
- `DOCVAULT` → absolute DocVault root (for vault-update; for issue lookups only when backend is `docvault`)
- `ISSUE_BACKEND` → either `plane` or `docvault`; gates the issue lookup path below

### Fetch issue (backend-aware)

**If `ISSUE_BACKEND == "plane"`:**

Use the Plane MCP to fetch the issue:

```
mcp__plane__get_issue_using_readable_identifier
  project_identifier: {issuePrefix from .claude/project.json}
  issue_identifier: {sequence number — strip the prefix from $ARGUMENTS}
```

For example, if `$ARGUMENTS` is `SFLW-3`, pass `project_identifier: "SFLW"` and `issue_identifier: "3"`. The Plane workspace is baked into the MCP server's startup config; the tool does not accept a `workspace_slug` parameter.

Extract from the response:
- `name` → title
- `description_html` (or `description_stripped`) → description
- `priority` → priority
- `state` → resolve state name via `mcp__plane__list_states` (cache once per session); map to status keyword (`backlog`, `todo`, `in-progress`, `in-review`, `done`, `cancelled`)
- `labels` → resolve label names via `mcp__plane__list_labels`; treat as tags

**If `ISSUE_BACKEND == "docvault"` (legacy / unmigrated projects):**

Read the issue file from DocVault:

Use the `Read` tool on `$DOCVAULT/Projects/$PROJECT/Issues/{ISSUE-ID}.md`. If not found, use `Glob` with pattern `**/{ISSUE-ID}.md` under `$DOCVAULT/Projects/$PROJECT/Issues/` to locate it (may be in `Closed/` or a subfolder).

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
ls "$SPECFLOW_ROOT/specs/{specName}/" 2>/dev/null
```

### Decision

**If a matching spec is found (any method):**
- Call `spec-status` with the matched `specName` to see phase progress
- Display current state (phase, task completion counts, pending approvals)
- **MANDATORY before resuming any phase:** Call `spec-workflow-guide` to reload the full workflow procedure. Do NOT rely on memory of how the workflow works.
- **MANDATORY before writing/editing any phase document:** Read the template for that phase from `$SPECFLOW_ROOT/templates/` (preferred) or `$SPECFLOW_GLOBAL/templates/` (fallback). Do NOT write from memory.
- If `--resume` flag was passed, jump directly to the current phase (but still load guide + template first)
- Otherwise ask: "Resume at current phase, or restart from scratch?"
- If Phase 5 in progress, jump to Step 5 (Implementation)

**If no spec exists:**
- Inform: "No existing spec found. Starting Phase 1 — Requirements."
- Proceed to Step 2

**Resume procedure (applies to ALL phases, no exceptions):**

| Resuming Phase | Required MCP calls before any edits |
|---|---|
| Phase 1 (Requirements) | `spec-workflow-guide` → `spec-status` → read `$SPECFLOW_ROOT/templates/requirements-template.md` (fallback: `$SPECFLOW_GLOBAL/templates/`) |
| Phase 2 (Discovery) — optional | `spec-workflow-guide` → `spec-status` → read `$SPECFLOW_ROOT/templates/discovery-template.md` (fallback: `$SPECFLOW_GLOBAL/templates/`) → read existing `requirements.md` |
| Phase 3 (Design) | `spec-workflow-guide` → `spec-status` → read `$SPECFLOW_ROOT/templates/design-template.md` (fallback: `$SPECFLOW_GLOBAL/templates/`) → read existing `requirements.md` |
| Phase 4 (Tasks) | `spec-workflow-guide` → `spec-status` → read `$SPECFLOW_ROOT/templates/tasks-template.md` (fallback: `$SPECFLOW_GLOBAL/templates/`) → read existing `requirements.md` + `design.md` |
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
   cat "$SPECFLOW_ROOT/templates/requirements-template.md" 2>/dev/null || cat "$SPECFLOW_GLOBAL/templates/requirements-template.md"
   ```

3. **Search mem0 for prior context:**
   ```
   mcp__mem0__search_memories
     query: "{issue title} {specName}"
     limit: 5
   ```

4. **Check for existing discovery brief** — two locations, in order:
   a. **In the issue body** (primary, post-OPS-150): the issue you already read in Step 0 may contain a populated `## Discovery` section with Problem Statement, Recommended Approach, Files Affected, Patterns to Follow, Context Pointers, and Estimated Scope. Use it directly — it's the authoritative source.
   b. **Legacy file path** (older specs only): `ls "$SPECFLOW_ROOT/discovery/{ISSUE-ID}.md" 2>/dev/null` — read if present.

   The Discovery block's Context Pointers list the exact mem0 query strings `/discover` used. Re-run them if you need to surface the full prior context in a fresh session. The discovery findings inform requirements — user stories, edge cases, and technical constraints surfaced during exploration.

5. **Ask clarifying questions** — one at a time, grounded in the issue description and any discovery findings.

6. **Write requirements.md** (include YAML frontmatter from the template):
   Call `mcp__specflow__write-spec-doc` with:
   - `specName: "{specName}"`
   - `documentType: "requirements"`
   - `content:` set to the full drafted markdown content

   If the tool returns a gate error, surface the error message to the user and stop.

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
   cat "$SPECFLOW_ROOT/templates/discovery-template.md" 2>/dev/null || cat "$SPECFLOW_GLOBAL/templates/discovery-template.md"
   ```

3. **Read approved requirements.md** to ground the research in what was approved.

4. **Run research:** codebase-search skill → Context7 for framework/library docs → web search for competing approaches and prior art. Focus on questions raised by the requirements.

5. **Write discovery.md:**
   Call `mcp__specflow__write-spec-doc` with:
   - `specName: "{specName}"`
   - `documentType: "discovery"`
   - `content:` set to the full drafted markdown content

   If the tool returns a gate error, surface the error message to the user and stop.

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
   cat "$SPECFLOW_ROOT/templates/design-template.md" 2>/dev/null || cat "$SPECFLOW_GLOBAL/templates/design-template.md"
   ```

3. **Discovery Research (MANDATORY — before any design decisions):**

   This is the discovery step. It happens here — after requirements are approved and before design proposals — so that design decisions are grounded in actual codebase state, not assumptions.

   a. **Read steering documents** for this project:
      ```bash
      cat "$SPECFLOW_ROOT/steering/product.md" 2>/dev/null
      cat "$SPECFLOW_ROOT/steering/tech.md" 2>/dev/null
      cat "$SPECFLOW_ROOT/steering/structure.md" 2>/dev/null
      ```

   b. **Run codebase-search** — invoke the `codebase-search` skill. Produce a Codebase Impact Report:
      - Files most likely to be touched
      - Existing patterns relevant to this feature
      - Potential ripple effects
      - Prior art in the codebase

   c. **Reference any existing discovery brief** — if `/discover` was run before `/spec`, the Discovery block lives in the issue body's `## Discovery` section (primary, post-OPS-150) or at legacy path `DocVault/specflow/{project}/discovery/{ISSUE-ID}.md`. Incorporate findings into the Impact Report — do NOT duplicate the research, just reference and extend. If the Discovery block lists Context Pointers (mem0 queries, Research Briefs, KB pages), follow them for additional context.

   <HARD-GATE>
   Do not write design.md until codebase-search is complete and the Impact Report is produced.
   Discovery research has NO separate approval gate — the approval is on design.md itself.
   </HARD-GATE>

4. **Reference requirements.md and Impact Report.**

5. **Propose 2-3 approaches**, each referencing existing codebase patterns found in the Impact Report.

6. **Present design in sections**, get user feedback after each section.

7. **Write design.md:**
   Call `mcp__specflow__write-spec-doc` with:
   - `specName: "{specName}"`
   - `documentType: "design"`
   - `content:` set to the full drafted markdown content

   If the tool returns a gate error, surface the error message to the user and stop.

8. **Request dashboard approval** (same pattern as Step 2 — request → poll → delete on approval).

9. On approved → proceed to Step 4.

---

## Step 4: Phase 4 — Tasks

> **SESSION BOUNDARY RULE:** If you are entering this phase from a handoff or new session, you MUST: (1) call `spec-workflow-guide`, (2) call `spec-status`, (3) read the tasks template (user-templates first!), (4) read the existing `requirements.md` + `design.md`. The tasks template contains critical project-specific patterns, gates, and prompt structures that CANNOT be improvised.

1. **Load workflow guide (MANDATORY — every session):**
   ```
   spec-workflow-guide
   ```

2. **Read tasks template (MANDATORY — user overrides take precedence over defaults):**
   ```bash
   # Resolution order: project override → global user override → global default
   cat "$SPECFLOW_ROOT/templates/tasks-template.md" 2>/dev/null || \
   cat "$SPECFLOW_DOCVAULT/user-templates/tasks-template.md" 2>/dev/null || \
   cat "$SPECFLOW_GLOBAL/templates/tasks-template.md"
   ```
   Where `$SPECFLOW_DOCVAULT` = `DocVault/specflow/` (the specflow root inside DocVault, one level above `$SPECFLOW_GLOBAL`).

3. **Reference requirements.md + design.md.**

4. **Create tasks** with the following fields for each:
   - `_Prompt` — Role, Task, Restrictions, Success criteria
   - `_Leverage` — files and utilities to use
   - `_Requirements` — which requirements this task implements
   - **Recommended Agent** — model affinity tag from the template's Model Affinity Guide (if the loaded template has one). Use the guide's decision table to assign the cheapest capable model. Default to `Claude` when unsure. Escalate to `CODEX` for tricky edge cases, `OPUS` for architectural judgment, `OPUS-1M` only when full codebase context is genuinely needed. Include a one-line justification after the tag.
   - **File Touch Map** — CREATE / MODIFY / TEST with file paths

5. **Write tasks.md:**
   Call `mcp__specflow__write-spec-doc` with:
   - `specName: "{specName}"`
   - `documentType: "tasks"`
   - `content:` set to the full drafted markdown content

   If the tool returns a gate error, surface the error message to the user and stop.

6. **Request dashboard approval** (same pattern as Steps 2–3).

7. On approved → proceed to Step 5.

---

## Step 5: Phase 5 — Implementation

> **NO PRs DURING IMPLEMENTATION.** Do not create a PR, push code, run Codacy, or run Codex peer review here. The PR is the FINAL action in Step 6 — after ALL tasks pass, Step 5.5 gates clear, and issues close.

> **SESSION BOUNDARY RULE:** If you are entering this phase from a handoff or new session, you MUST:
> 1. Call `spec-workflow-guide`
> 2. Call `spec-status` to see task progress
> 3. Read the full `tasks.md`
> 4. Check Implementation Logs to see what's already done
> 5. **Ask the user how they want to execute** (step 4 below). Do NOT skip this question. Do NOT assume the previous session's choice carries over. **This question is MANDATORY every time Phase 5 is entered, even on resume, and again after each single-task completion.**

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

   1. Subagent dispatch     — this session orchestrates, Claude subagents implement all remaining tasks
   2. Continue here (full)  — this session implements all remaining tasks sequentially
   3. Continue here (single)— implement one task in this session, then return to this menu
   4. External agent (full) — hand all remaining tasks to an external CLI (Codex/Gemini/GLM/Kimi/Other)
   5. External agent (single)— hand one task to an external CLI, then return to this menu
   ```

   Wait for user selection before proceeding.

   **Re-entry loop:** After completing options 3 or 5 (single-task modes), re-present this menu with updated counts. This lets the user mix execution modes — do task 1 here, hand task 2 to kimi, subagent the rest.

---

### Option 1: Subagent Dispatch

**Main context orchestrates. Subagents implement.**

**Parallel vs Serial decision:** Before dispatching, read all pending tasks and compare their **File Touch Map** entries. Tasks that share NO files (no overlapping MODIFY/CREATE paths) are independent and SHOULD be dispatched in parallel using multiple Agent tool calls in a single message. Tasks that share files MUST run sequentially. Group independent tasks into parallel batches, then run each batch concurrently.

For each pending task (or parallel batch of independent tasks):

   #### a) Mark in-progress
   Edit `tasks.md`: change `[ ]` → `[-]` for the current task.

   #### b) Check prior implementation logs
   ```bash
   ls "$SPECFLOW_ROOT/specs/{specName}/Implementation Logs/" 2>/dev/null
   ```

   #### c) Dispatch implementer subagent
   Use the Agent tool with:
   - The full `_Prompt` text from the task
   - All `_Leverage` file paths
   - Reference: `$SPECFLOW_ROOT/templates/implementer-prompt-template.md` or `$SPECFLOW_GLOBAL/templates/` (if exists)
   - **Inject specialized role context** based on the task's File Touch Map (see Specialized Agent Roles below)
   - Subagent implements, tests, commits, and self-reviews
   - **Main context does NOT write implementation code**

   #### d) Dispatch spec compliance reviewer
   Use the Agent tool with:
   - Reference: `$SPECFLOW_ROOT/templates/spec-reviewer-template.md` or `$SPECFLOW_GLOBAL/templates/` (if exists)
   - Reads actual code changes vs task requirements
   - If fail → dispatch implementer again to fix → re-review
   - Must pass before proceeding

   #### e) Dispatch code quality reviewer
   Use the Agent tool with:
   - Reference: `$SPECFLOW_ROOT/templates/code-quality-reviewer-template.md` or `$SPECFLOW_GLOBAL/templates/` (if exists)
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

### Option 2: Continue Here (Full)

This session implements all remaining tasks sequentially. Follow the same per-task flow as Option 1 (mark in-progress → implement → log → mark complete) but execute inline instead of dispatching subagents.

---

### Option 3: Continue Here (Single)

Ask which task number to implement. Implement that one task inline (same flow as Option 2 but for one task only).

After completion, **re-present the dispatch menu** with updated counts:
```
Task {N} complete. X tasks remaining, Y total complete.

How do you want to continue?
[same 5-option menu]
```

---

### Option 4: External Agent (Full)

**Follow-up question (MANDATORY):**

```
Which external agent?
  a) Codex    (codex CLI)
  b) Gemini   (gemini CLI or claude-gemini)
  c) GLM      (claude-glm)
  d) Kimi     (claude-kimi or kimi CLI)
  e) Other    (specify CLI command)
```

Wait for user selection. Then print a single prompt block:

````
---
### External handoff — All remaining tasks
Target: `{selected CLI}`
Project: {projectPath}

```
/spec {ISSUE-ID} --resume
```

Context: Spec "{specName}" has {N} tasks remaining. The agent will load the spec via --resume, read tasks.md, and implement all pending tasks following the _Prompt instructions.
---
````

After printing:
```
Paste the prompt above into a fresh terminal running `{selected CLI}`.
The session will pick up spec context via --resume and implement all pending tasks.
Run `/spec {ISSUE-ID}` again here to verify all tasks are logged.
```

---

### Option 5: External Agent (Single)

Ask which task number to hand off. Then ask which external agent (same follow-up as Option 4).

Print a single-task prompt block:

````
---
### External handoff — Task {N}: {task title}
Target: `{selected CLI}`
Project: {projectPath}

```
/spec {ISSUE-ID} --resume

Implement Task {N} from spec "{specName}". Read tasks.md for full details.
```
---
````

After printing, **re-present the dispatch menu** with updated context:
```
Task {N} handed off to {agent}. X tasks remaining (including the handed-off task until logged).

How do you want to continue?
[same 5-option menu]
```

---

#### Future: Direct CLI dispatch (planned)

When external agent prompts are battle-tested, Options 4/5 may evolve to direct dispatch via `claude-kimi -p`, `kimi -p`, `codex -p`, or background `opencode` invocations. For now, the copy-paste `/spec --resume` approach lets us iterate on the prompt format.

Once GLM prompt delivery is validated through manual handoff sessions, this option will evolve to support `claude-glm -p "prompt"` for non-interactive batch dispatch. Not yet implemented — gathering data on GLM's task completion quality first.

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
- The DocVault repo path: `$DOCVAULT`
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

## Step 6: Close Issues & Completion

### a) Close issue (backend-aware)

**If `ISSUE_BACKEND == "plane"`:**

Resolve the `Done` state UUID (cached from earlier `list_states` call) and close via:

```
mcp__plane__update_issue
  project_id: {plane_project_id}
  issue_id: {issue uuid from the earlier get_issue_using_readable_identifier response}
  issue_data:
    state: {Done state uuid}
```

Plane records `completed_at` automatically. If the issue has parent/child relationships in Plane, only close the issue this spec implemented — don't auto-cascade to siblings or parents.

**If `ISSUE_BACKEND == "docvault"`:**

Update the vault issue file in DocVault:

```bash
# Read the issue file, update frontmatter:
#   status: done
#   completed: {today's date}
#   updated: {today's date}
```

Edit the issue markdown file at `$DOCVAULT/Projects/$PROJECT/Issues/{ISSUE-ID}.md`.
If the issue has sub-issues (letter-suffix children like `{ID}-A`), close those too (update each sub-issue file's status to `done`).

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
Tests:    {test results summary}
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

**Calls:**
- `codebase-search` skill (Step 3, mandatory before design)
- Agent tool (Step 5, subagent dispatch for implementation + review)
- `vault-update` skill (Step 5.5, DocVault documentation gate)
- `/release patch` handoff suggestion (Step 6, after completion)
