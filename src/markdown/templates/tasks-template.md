---
tags: [tasks, spec]
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
---

# Tasks Document

## References

- **Issue:** PROJ-XXX
- **GitHub PR:** [#NNN](https://github.com/owner/repo/pull/NNN)
- **Spec Path:** `DocVault/specflow/{{projectName}}/specs/{{spec-name}}/`

## File Touch Map

> **Why this section exists:** Surface the blast radius before any task begins. The Phase 5 orchestrator uses this map to decide which tasks can run in parallel (no overlapping files) versus serial (shared files). The readiness gate (Phase 4.9) verifies that every file referenced by any task below appears in this map. Reviewers use it as a 30-second preview of "how big is this change really" before reading individual tasks.

| Action | Files | Scope |
|--------|-------|-------|
| CREATE | `path/to/new/file.ext` | [one-line scope note] |
| MODIFY | `path/to/existing/file.ext` | [what changes — function names or rough line ranges] |
| DELETE | `path/to/dead/file.ext` | [why it's going away] |
| TEST   | `tests/path/test_new.ext` | [what the new test file covers] |

**Total files touched:** N created, N modified, N deleted, N test files added/modified.

**Cross-cutting concerns:** [list any files where the spec also requires updates that aren't immediately obvious — e.g., `__init__.py` exports, `package.json`, env var docs, project conventions JSON]

### Parallel Dispatch Plan

> **MANDATORY — The spec author MUST fill this in.** The Phase 4 orchestrator uses this plan to dispatch tasks. Tasks listed in the same batch MUST be sent as parallel Agent tool calls in a SINGLE message. Batches run sequentially (batch 2 waits for all of batch 1 to finish).

**Rules for grouping:**
1. Two tasks are **independent** if they share NO files in the File Touch Map (no overlapping CREATE/MODIFY/TEST paths).
2. Independent tasks go in the **same batch** — they MUST run in parallel via simultaneous Agent tool calls in one message.
3. Tasks that share ANY file MUST be in **different batches** (sequential).
4. Within a batch, each Agent call gets its own worktree target path to prevent split diffs.

| Batch | Tasks | Rationale |
|-------|-------|-----------|
| 1     | [task numbers] | [why these are independent — list disjoint file sets] |
| 2     | [task numbers] | [depends on batch 1 because of shared file X] |
| ...   | ...   | ... |

> **Orchestrator enforcement:** When executing Phase 4, you MUST follow this batch plan. Launching independent tasks serially when they could run in parallel is a workflow violation — it turns a 15-minute parallel run into a multi-hour serial crawl. If you are unsure whether two tasks conflict, check the File Touch Map above. If their file sets are disjoint, they are parallel.

---

## Task Execution Protocol

> **The orchestrator MUST prepend this protocol to every subagent dispatch.** Individual task `_Prompt:` fields contain ONLY the unique `Role | Task | Restrictions | Success` content. This protocol wraps every dispatch — it is NOT repeated per-task.

### Dispatch Prefix (orchestrator copies this verbatim before each _Prompt:)

```text
Implement the task for spec {{spec-name}}.
Before starting: run mcp__specflow__spec-workflow-guide to load workflow context, verify worktree (if project has devops/version.lock: git branch --show-current must return patch/VERSION — if not, STOP), mark task [-] in tasks.md.
After completing: call mcp__specflow__log-implementation with full artifacts (functions added/modified, files changed, endpoints created, tests written). Do NOT mark [x] until the tool call succeeds. Then mark [x].
```

### Pre-Flight Tool Check (once per session, before first task)

Verify all MCP tools are available before executing ANY task:
1. Call `mcp__specflow__spec-workflow-guide` — if this fails, specflow MCP is not connected. STOP.
2. Call `mcp__specflow__spec-status` with the spec name — if this fails, the spec doesn't exist yet. STOP.
3. Verify `mcp__specflow__log-implementation` is callable.

If ANY tool is missing, report the missing tools to the user and STOP.

### Version Checkout (once per session, before first task)

1. IF the project has `devops/version.lock`: run `/release patch` to claim a version and create a worktree. ALL file edits happen inside the worktree. Verify: `git branch --show-current` returns `patch/VERSION`.
2. IF the project has NO `devops/version.lock`: prompt the user about setting up version tracking. Record their decision.
3. **Parallel agent dispatch:** When the Parallel Dispatch Plan above lists tasks in the same batch, dispatch them as simultaneous Agent tool calls in a SINGLE message. Each parallel agent MUST receive an explicit worktree target path — agents that inherit the wrong `cwd` write to the main tree and produce split diffs. Each agent also needs its own `/release patch` call to claim its own worktree before writing any files.

### MCP Tool Reference

- `mcp__specflow__spec-workflow-guide` — load workflow instructions
- `mcp__specflow__spec-status` — check spec phase progress
- `mcp__specflow__spec-list` — search for existing specs
- `mcp__specflow__approvals` — request/status/delete dashboard approvals
- `mcp__specflow__log-implementation` — record implementation artifacts (HARD GATE)
- `mcp__mem0__search_memories` — search cross-session memory
- `mcp__mem0__add_memory` — save to cross-session memory

---

## UI Prototype Gate (conditional — include ONLY if design.md declares `Has UI Changes: Yes` AND `Prototype Required: Yes`)

> **BLOCKING:** Tasks 0.1–0.3 MUST be completed and approved before ANY task tagged `ui:true` begins.
> If the spec has no UI changes, delete this entire section.

- [ ] 0.1 Create visual mockup (Stitch or equivalent)
  - Invoke the `ui-mockup` skill (Step 1–4) OR the `frontend-design` skill
  - If design.md references a prototype HTML file, use it as the starting point
  - Generate mockups for all states: populated, loading, empty, error
  - Include light and dark theme variants
  - Purpose: Establish visual direction before writing any UI code
  - _Requirements: All UI-related requirements_
  - _Prompt: Role: UI/UX Designer | Task: Create visual mockups using the ui-mockup skill (Stitch) or frontend-design skill for all new/modified UI components described in design.md. Cover all visual states (populated, loading, empty, error) and theme variants (light, dark). If a reference HTML prototype exists at the path noted in design.md, use it as the baseline. | Restrictions: Do NOT write any production code. Output is mockup artifacts only. | Success: Stitch screen IDs or equivalent visual artifacts are generated and presented to the user for review._

- [ ] 0.2 Build interactive prototype (Playground)
  - Invoke the `playground` skill using the approved mockup as spec
  - Must use the project's actual tech stack (CSS framework, theme system, data attributes)
  - Include realistic sample data, interactive controls, and all data states
  - Purpose: Validate UX feel and interactions before production code
  - _Requirements: All UI-related requirements_
  - _Prompt: Role: Frontend Prototyper | Task: Build an interactive single-file HTML playground using the playground skill. Source visual design from the approved Stitch mockup (Task 0.1). Use the project's actual CSS framework and theme system. Include realistic data, clickable controls, hover states, and all data states (populated, loading, empty, error). | Restrictions: This is a throwaway prototype — do NOT integrate into the codebase. Must match the project's tech stack. | Success: User can interact with the prototype in a browser, validate layout/UX, and give explicit approval before implementation begins._

- [ ] 0.3 Visual approval checkpoint
  - Present prototype to user for explicit approval
  - Update design.md `Prototype Artifacts` section with Stitch IDs and playground file path
  - Purpose: Hard gate — no UI implementation proceeds without visual sign-off
  - _Requirements: All UI-related requirements_
  - _Prompt: Role: Project Coordinator | Task: Present the interactive prototype (Task 0.2) to the user. Collect approval or revision feedback. If approved, update the UI Impact Assessment section in design.md with the Stitch screen IDs and playground file path. | Restrictions: Do NOT proceed to any ui:true implementation task until the user explicitly approves the prototype. Verbal approval IS accepted for this visual checkpoint (unlike spec phase approvals). | Success: User has approved the visual design. design.md Prototype Artifacts section is populated. Implementation tasks may now begin._

---

## Phase 0 — TDD Foundation (BLOCKING)

> **BLOCKING:** Tasks 0.4–0.5 MUST complete before ANY Phase 1+ implementation task begins.
> Tests define the expected behavior FIRST — implementation tasks in Phase 1+ are the "green phase" that makes them pass.
> This is NOT optional. Skipping Phase 0 and writing implementation code first defeats TDD.

- [ ] 0.4 Establish test baseline
  - File: `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json` (read or create)
  - **Cached baseline check:** Read `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json` if it exists. If the cached baseline is valid (commit matches `git merge-base HEAD <base-branch>` AND timestamp < 12 hours old), use the cached results instead of re-running the full suite. Log that the cached baseline was used.
  - **Full run (if cache miss):** Run the project's test command to establish a passing baseline. Write results to `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json`.
  - If no test suite exists, flag this to the user and discuss whether to set one up
  - Purpose: Record the starting state so regressions can be detected. Cached baselines avoid redundant full-suite runs when running multiple specs in one session.
  - _Leverage: Project test configuration, `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json` (if exists)_
  - _Requirements: All_
  - _Prompt: Role: QA Engineer | Task: Check for `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json`. If it exists, read it and validate: (1) the `commit` field matches `git merge-base HEAD <base-branch>` (the merge-base of the current worktree branch and the base branch), (2) the `timestamp` is less than 12 hours old, (3) `fail` is 0. If ALL three conditions pass, log "Using cached baseline" with the cached counts and skip the full run. If ANY condition fails (or file missing), run the project's full test suite, record pass/fail/skip counts, then write `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json` with format: `{"timestamp": "<ISO>", "command": "<test cmd>", "pass": N, "fail": N, "skip": N, "total": N, "branch": "<base>", "commit": "<merge-base-sha>"}`. If no test suite exists, flag to user. | Restrictions: Use the project's existing test framework. Do not modify source files. Do not use a stale baseline (commit mismatch or > 12h). | Success: Baseline results (pass/fail/skip) are recorded — either from cache or fresh run. `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json` exists and is current._

- [ ] 0.5 Write failing tests for new behavior (TDD — BEFORE implementation)
  - File: [test file paths — determined by project conventions]
  - Write failing tests using the project's test framework for all new behavior described in requirements.md
  - Tests should map to acceptance criteria — one or more tests per AC
  - Tests MUST fail now (red phase) and pass after Phase 1+ implementation (green phase)
  - Purpose: TDD — tests define the expected behavior before code is written
  - _Leverage: Project test framework, requirements.md acceptance criteria, baseline from task 0.4_
  - _Requirements: All_
  - _Prompt: Role: QA Engineer | Task: Write failing tests for all new behavior described in requirements.md acceptance criteria. Use the project's existing test framework and conventions. Each acceptance criterion should have at least one corresponding test. Tests MUST fail before implementation (red phase of TDD) and pass after Phase 1+ implementation (green phase). | Restrictions: Use the project's existing test framework — do not introduce a new one. Tests must be runnable with the project's test command. Do not write implementation code in this task. | Success: Failing tests exist for every acceptance criterion in requirements.md. Running the test suite shows the new tests fail (expected) while existing tests from task 0.4 baseline still pass._

---

## Phase 1 — [Phase Name — short descriptor matching design.md mermaid graph, e.g., "(Phase A — the domino)"]

> **TDD Context:** Phase 0 established the test baseline (task 0.4) and wrote failing tests for all acceptance criteria (task 0.5).
> Implementation tasks below are the "green phase" — write the minimum code to make those tests pass while following design.md patterns.
>
> **Targeted tests during implementation:** Run only tests related to the files you changed, not the full suite. Use your framework's file-filtering option: `vitest --related <files>`, `jest --findRelatedTests <files>`, `pytest <test-file>`, etc. The full suite runs once in closing task N. This saves significant time and tokens on multi-task specs.

- [ ] 1. [Task title]
  - File: `[file path]`
  - [What to implement — be specific about function names, line numbers, and code patterns]
  - [Second bullet if multi-part]
  - Purpose: [Why this task exists — what problem it solves]
  - _Leverage: [Existing functions/constants/patterns to reuse, with file:line references]_
  - _Requirements: REQ-X_
  - _Prompt: Role: [Role] | Task: [Detailed implementation instructions referencing specific file paths, line numbers, existing functions, and exact variable names. Include the complete behavior specification.] | Restrictions: [What NOT to do — other files to leave untouched, patterns to avoid, anti-patterns for this codebase] | Success: [Concrete, verifiable acceptance criteria — what works, what doesn't break]_

- [ ] 2. [Task title]
  - File: `[file path]`
  - [Implementation details]
  - Purpose: [Why]
  - _Leverage: [Existing code to reuse]_
  - _Requirements: REQ-Y_
  - _Prompt: Role: [Role] | Task: [Instructions] | Restrictions: [Constraints] | Success: [Criteria]_

---

## Phase 2 — [Phase Name] (optional — remove if single-phase)

- [ ] 3. [Task title]
  - File: `[file path]`
  - [Implementation details]
  - Purpose: [Why]
  - _Leverage: [Existing code to reuse]_
  - _Requirements: REQ-Z_
  - _Prompt: Role: [Role] | Task: [Instructions] | Restrictions: [Constraints] | Success: [Criteria]_

---

> **STANDARD CLOSING TASKS — VERBATIM-COPY MANDATORY**
>
> These N..N+5 tasks are the verification loop. They are NOT optional boilerplate.
> Copy this entire section verbatim into every generated tasks.md — renumber only.
>
> TDD Foundation tasks (0.4–0.5: test baseline + write failing tests) live in Phase 0,
> NOT here. They run BEFORE implementation. Do NOT move them back into closing.
>
> **DO NOT:**
> - Rewrite these tasks from scratch
> - Simplify or consolidate them
> - Skip any task in this block
> - Treat N+1–N+5 as placeholders for your own closing tasks
> - Move TDD tasks (0.4–0.5) back into this block — they are Phase 0
>
> The tasks-closing-gate hook will **block** writes to tasks.md missing this block.
> Root cause: STAK-517 — closing gates were silently dropped when the agent wrote
> simplified closing tasks instead of copying this block.

## Standard Closing Tasks

> **Numbering:** Closing tasks continue the numbering from the last implementation task above.
> If implementation ends at Task 3, closing tasks start at 4. The spec validator rejects
> non-numeric IDs like `C1.` — use sequential numbers only.

- [ ] N. Run full test suite — zero regressions + update baseline
  - File: `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json` (update)
  - Run the project's **complete** test suite after all implementation is done (no `--related` filtering — this is the full verification)
  - All new tests from Phase 0 task 0.5 must now pass (green); no existing tests may regress from the task 0.4 baseline
  - After a passing run, update `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json` with the new counts and current commit — this primes the cache for the next spec
  - Purpose: Verify implementation is complete AND refresh the baseline cache so the next spec's task 0.4 can skip the full run
  - _Leverage: Project test command, baseline results from Phase 0 task 0.4_
  - _Requirements: All_
  - _Prompt: Role: QA Engineer | Task: Run the project's FULL test suite (no --related filtering). Compare results against the baseline from Phase 0 task 0.4. All failing tests from task 0.5 must now pass (green phase complete). No existing tests may have regressed. If any test fails, diagnose and fix before proceeding. After a fully passing run, update `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json` with: `{"timestamp": "<ISO>", "command": "<test cmd>", "pass": N, "fail": N, "skip": N, "total": N, "branch": "<current>", "commit": "<HEAD sha>"}`. | Restrictions: Do not skip or disable any tests. Do not modify tests to make them pass unless they have a genuine bug. Do NOT update the baseline if any test fails. | Success: Full test suite passes. Zero regressions. `{{workflowRoot}}/specs/{{spec-name}}/test-baseline.json` updated with current results._

- [ ] N+1. Log implementation — HARD GATE
  - File: (no file changes — logging only)
  - Call `mcp__specflow__log-implementation` with a comprehensive summary of ALL implementation work done across all tasks in this spec
  - Include: all functions added/modified, all files changed, all tests written, all endpoints created
  - Purpose: Create a permanent record of what was implemented for future reference and audit
  - _Leverage: Implementation logs from individual tasks, git diff_
  - _Requirements: All_
  - _Prompt: Role: Project Coordinator | Task: Call the log-implementation MCP tool with a comprehensive summary covering all implementation tasks in this spec. Aggregate: (1) all functions added or modified with file paths, (2) all files created or changed, (3) all test files and test counts, (4) any new endpoints, routes, or APIs, (5) any configuration changes. This is the consolidated implementation record. | Restrictions: Do not skip any task's artifacts. | Success: log-implementation MCP tool call succeeds with full artifact listing._

- [ ] N+2. Security Review — Codacy CLI + CodeRabbit (parallel scan)
  - File: (no file changes — review only, fixes happen via loop-back if needed)
  - **PARALLEL DISPATCH — MANDATORY:** In a SINGLE message, invoke BOTH scanners simultaneously:
    1. `codacy-cli` skill — local SAST/quality scan via `.codacy/cli.sh analyze` against changed files (SARIF output). Bootstraps `.codacy/cli.sh` if missing.
    2. `coderabbit:review` skill — AI review of the branch diff (catches logic bugs, architecture smells, test gaps that often surface post-PR).
  - Do NOT serialize the two scans. Do NOT treat CodeRabbit as a fallback — it runs every time alongside Codacy CLI.
  - After BOTH complete: merge findings, deduplicate overlaps, triage by severity.
  - Triage: Critical/High -> MUST fix, Medium -> fix or document waiver, Low/Info -> advisory
  - Purpose: Catch security + review regressions BEFORE PR.
  - _Leverage: `codacy-cli` skill (local Codacy CLI v2 scanner — NOT the Codacy MCP), `coderabbit:review` skill, branch git diff_
  - _Requirements: Security NFR from requirements.md_
  - _Prompt: Role: Security Engineer | Task: Run pre-PR security + review scans IN PARALLEL. In a single message, dispatch BOTH (1) the codacy-cli skill against files changed in this spec, AND (2) the coderabbit:review skill to review the branch diff. Wait for both to complete, merge findings, deduplicate. For each Critical/High finding: read the code, determine real vs false positive, fix or add inline suppression with justification. Medium: fix or waiver. Low/Info: advisory. | Restrictions: Do NOT call mcp__codacy__* tools — use the local Codacy CLI skill. Do NOT serialize the scanners. Do NOT skip CodeRabbit. Do not blanket-disable rules. | Success: Both scans completed and merged. Zero unaddressed Critical/High findings. All triage decisions logged._

- [ ] N+3. Generate verification.md
  - File: `{{workflowRoot}}/specs/{{spec-name}}/verification.md`
  - Generate a verification checklist in the spec directory
  - List every requirement and acceptance criterion from requirements.md as a checklist item
  - For each item: mark `[x]` with `file:line` code evidence, OR mark `[ ]` with a gap description
  - Purpose: Prove every requirement is met with traceable evidence — no hand-waving
  - _Leverage: requirements.md, implementation logs, git diff_
  - _Requirements: All_
  - _Prompt: Role: QA Engineer | Task: Generate verification.md in the spec directory. Read requirements.md and list every requirement and acceptance criterion as a markdown checklist. For each item, search the codebase for the implementing code and mark [x] with file:line evidence. If any criterion cannot be verified, mark [ ] with a gap description. Run /vault-update and close linked issues. Run /verification-before-completion for a final check. | Restrictions: Do not mark [x] without concrete file:line evidence. Do not fabricate evidence. | Success: verification.md exists with every requirement/AC listed and evidenced. /vault-update completed. Linked issues closed. /verification-before-completion passed._

- [ ] N+4. Cross-Model Peer Review
  - File: (no file changes — review only, fixes happen via loop-back if needed)
  - **Note:** CodeRabbit already ran in task N+2 alongside Codacy CLI — do NOT re-invoke it here. This task is Codex-first cross-model review.
  - **Review dispatch chain (try in order, use first that works):**
    1. **Codex (`codex:rescue`)** — invoke via the Skill tool with `skill: "codex:rescue"`. Do NOT use the Agent tool with a subagent_type.
    2. **Built-in code review (`pr-review-toolkit:review-pr`)** — fallback if Codex dispatch fails.
    3. **Mark `[!]` BLOCKED** — only if both options above fail. Present to user for manual review decision.
  - **Self-detection guard:** IF running from Codex itself (check `$CODEX_SESSION` env var) -> skip Codex dispatch, go directly to option 2.
  - Address all Critical and Important findings before proceeding. Minor findings are advisory.
  - **NEVER silently skip this task.** If ALL review options fail, mark `[!]` (BLOCKED).
  - Purpose: Cross-model peer review catches blind spots a single-model review misses.
  - _Leverage: `codex:rescue` skill (primary), `pr-review-toolkit:review-pr` skill (fallback), branch git diff_
  - _Requirements: All_
  - _Prompt: Role: Code Review Coordinator | Task: Run a cross-model peer review. Try in order: (1) codex:rescue via Skill tool, (2) pr-review-toolkit:review-pr via Skill tool, (3) mark [!] BLOCKED. Fix Critical/Important findings by looping back to implementation. Minor findings are advisory. | Restrictions: Do NOT invoke coderabbit:review (already ran in N+2). Do NOT use Agent tool for codex:rescue — use Skill tool. NEVER mark [x] if review was skipped — use [!]. | Success: Review completed with Critical/Important issues addressed, OR [!] BLOCKED with documented reason._

- [ ] N+5. Loop or complete
  - File: (no file changes — decision gate only)
  - IF ANY task above is marked `[!]` (BLOCKED) -> STOP. Present to user for decision.
  - IF verification.md has ANY unchecked `[ ]` items -> fix the failing requirements/code first, THEN loop back through N–N+4
  - IF N+2 has unaddressed Critical/High -> fix the flagged code first, THEN loop back through N–N+4
  - IF N+4 has unaddressed Critical/Important -> fix the flagged code first, THEN loop back through N–N+4
  - ONLY when ALL clean AND zero `[!]` tasks remain -> proceed to PR/commit
  - Purpose: Enforce the verification loop — specs are not complete until every requirement is proven AND all reviews pass.
  - _Leverage: verification.md from N+3, scan results from N+2, review results from N+4_
  - _Requirements: All_
  - _Prompt: Role: Project Coordinator | Task: Scan ALL tasks for [!] BLOCKED — if any exist, present to user and STOP. Then check: verification.md unchecked items, N+2 unaddressed Critical/High, N+4 unaddressed Critical/Important. If any count is non-zero, FIX the failing code or tests first (do not re-run verification without fixing the root cause), then loop back through N–N+4. Only when all clean: proceed to PR/commit. | Restrictions: Do NOT proceed if ANY gaps remain. Do NOT remove unchecked items to force completion. Do NOT change [!] to [x] without user decision. Do NOT loop back without fixing the underlying issue first. | Success: Zero [!] tasks. verification.md fully checked. All reviews clean. PR/commit may proceed._
