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

> **Why this section exists:** Surface the blast radius before any task begins. The Phase 4 orchestrator uses this map to decide which tasks can run in parallel (no overlapping files) versus serial (shared files). The readiness gate (Phase 3.9) verifies that every file referenced by any task below appears in this map. Reviewers use it as a 30-second preview of "how big is this change really" before reading individual tasks.

| Action | Files | Scope |
|--------|-------|-------|
| CREATE | `path/to/new/file.ext` | [one-line scope note] |
| MODIFY | `path/to/existing/file.ext` | [what changes — function names or rough line ranges] |
| DELETE | `path/to/dead/file.ext` | [why it's going away] |
| TEST   | `tests/path/test_new.ext` | [what the new test file covers] |

**Total files touched:** N created, N modified, N deleted, N test files added/modified.

**Cross-cutting concerns:** [list any files where the spec also requires updates that aren't immediately obvious — e.g., `__init__.py` exports, `package.json`, env var docs, project conventions JSON]

**Parallel/serial dispatch hint:** Tasks that share NO files (no overlapping CREATE/MODIFY paths) are independent and SHOULD be dispatched in parallel. Tasks that share files MUST run sequentially. Group independent tasks into parallel batches.

---

## UI Prototype Gate (conditional — include ONLY if design.md declares `Has UI Changes: Yes` AND `Prototype Required: Yes`)

> **BLOCKING:** Tasks 0.1–0.3 MUST be completed and approved before ANY task tagged `ui:true` begins.
> If the spec has no UI changes, delete this entire section.

- [ ] 0.1 Create visual mockup (Stitch or equivalent)
  - **Recommended Agent:** Claude
  - Invoke the `ui-mockup` skill (Step 1–4) OR the `frontend-design` skill
  - If design.md references a prototype HTML file, use it as the starting point
  - Generate mockups for all states: populated, loading, empty, error
  - Include light and dark theme variants
  - Purpose: Establish visual direction before writing any UI code
  - _Requirements: All UI-related requirements_
  - _Prompt: Role: UI/UX Designer | Task: Create visual mockups using the ui-mockup skill (Stitch) or frontend-design skill for all new/modified UI components described in design.md. Cover all visual states (populated, loading, empty, error) and theme variants (light, dark). If a reference HTML prototype exists at the path noted in design.md, use it as the baseline. | Restrictions: Do NOT write any production code. Output is mockup artifacts only. | Success: Stitch screen IDs or equivalent visual artifacts are generated and presented to the user for review._

- [ ] 0.2 Build interactive prototype (Playground)
  - **Recommended Agent:** Claude
  - Invoke the `playground` skill using the approved mockup as spec
  - Must use the project's actual tech stack (CSS framework, theme system, data attributes)
  - Include realistic sample data, interactive controls, and all data states
  - Purpose: Validate UX feel and interactions before production code
  - _Requirements: All UI-related requirements_
  - _Prompt: Role: Frontend Prototyper | Task: Build an interactive single-file HTML playground using the playground skill. Source visual design from the approved Stitch mockup (Task 0.1). Use the project's actual CSS framework and theme system. Include realistic data, clickable controls, hover states, and all data states (populated, loading, empty, error). | Restrictions: This is a throwaway prototype — do NOT integrate into the codebase. Must match the project's tech stack. | Success: User can interact with the prototype in a browser, validate layout/UX, and give explicit approval before implementation begins._

- [ ] 0.3 Visual approval checkpoint
  - **Recommended Agent:** Claude
  - Present prototype to user for explicit approval
  - Update design.md `Prototype Artifacts` section with Stitch IDs and playground file path
  - Purpose: Hard gate — no UI implementation proceeds without visual sign-off
  - _Requirements: All UI-related requirements_
  - _Prompt: Role: Project Coordinator | Task: Present the interactive prototype (Task 0.2) to the user. Ask explicitly - does this look and feel right? Collect approval or revision feedback. If approved, update the UI Impact Assessment section in design.md with the Stitch screen IDs and playground file path. | Restrictions: Do NOT proceed to any ui:true implementation task until the user explicitly approves the prototype. Verbal approval IS accepted for this visual checkpoint (unlike spec phase approvals). | Success: User has approved the visual design. design.md Prototype Artifacts section is populated. Implementation tasks may now begin._

---

{/* MANDATORY GATES — These gates appear verbatim in every generated tasks.md. Do NOT treat as placeholders.

VERSION CHECKOUT GATE — INTERACTIVE:
Before implementing ANY task below, check the project's version management:
1. IF the project has `devops/version.lock`:
   - Run `/release patch` to claim a version and create a worktree
   - Record the assigned version in the first implementation log
   - ALL file edits happen inside the worktree — never in the main repo working directory
   - Verify: `git branch --show-current` returns patch/VERSION, not dev or main
   - If multiple tasks are parallelized across agents, each agent gets its own /release patch
2. IF the project has NO `devops/version.lock`:
   - Prompt the user: "This project has no version lock or changelog. Would you like to set up version tracking (version.lock + CHANGELOG.md)?"
   - IF yes: assist with scaffolding `devops/version.lock` and `CHANGELOG.md` before proceeding
   - IF no: skip this gate and record the decision as a comment in tasks.md
Skipping this gate without user acknowledgment is a workflow violation.

IMPLEMENTATION LOGGING GATE — HARD GATE:
Before marking ANY task [x], you MUST call the `log-implementation` MCP tool with full
artifacts (functions added/modified, files changed, endpoints created, tests written).
Do NOT mark [x] until the log-implementation tool call succeeds. No exceptions.

SPEC COMPLETION GATE — BLOCKING (Phase 5):
After ALL tasks are [x] and implementation logs are recorded:
1. Generate `verification.md` in the spec directory — a checklist mapping every requirement
   and acceptance criterion from requirements.md to file:line code evidence. Any unchecked
   item means the spec is NOT complete — loop back to implementation.
2. Run `/vault-update` to update DocVault pages affected by this spec's changed files
3. Close all linked DocVault issues (move to Done, move file to Closed/)
4. Run `/verification-before-completion` for a final smoke check
5. The spec is NOT complete until all four steps are verified.
*/}

---

## Phase 1 — [Phase Name — short descriptor matching design.md mermaid graph, e.g., "(Phase A — the domino)"]

- [ ] 1. [Task title]
  - **Recommended Agent:** [Claude / Codex / Gemini — pick based on task type: Claude for general implementation, Codex for verification scans and adversarial review, Gemini for long-context analysis]
  - File: `[file path]`
  - [What to implement — be specific about function names, line numbers, and code patterns]
  - [Second bullet if multi-part]
  - Purpose: [Why this task exists — what problem it solves]
  - _Leverage: [Existing functions/constants/patterns to reuse, with file:line references]_
  - _Requirements: REQ-X_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: [Role] | Task: [Detailed implementation instructions referencing specific file paths, line numbers, existing functions, and exact variable names. Include the complete behavior specification.] | Restrictions: [What NOT to do — other files to leave untouched, patterns to avoid, anti-patterns for this codebase] | Success: [Concrete, verifiable acceptance criteria — what works, what doesn't break] PREREQUISITE: Before writing any code, verify you are in the correct working context. If the project uses version.lock, confirm `git branch --show-current` returns patch/VERSION. If not, STOP and run /release patch first. Mark task as [-] in tasks.md before starting. BLOCKING: After implementation, you MUST call the log-implementation tool with full artifacts before marking [x]. Do NOT mark [x] until the log-implementation tool call succeeds._

- [ ] 2. [Task title]
  - **Recommended Agent:** Claude
  - File: `[file path]`
  - [Implementation details]
  - Purpose: [Why]
  - _Leverage: [Existing code to reuse]_
  - _Requirements: REQ-Y_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: [Role] | Task: [Instructions] | Restrictions: [Constraints] | Success: [Criteria] PREREQUISITE: Before writing any code, verify you are in the correct working context. If the project uses version.lock, confirm `git branch --show-current` returns patch/VERSION. If not, STOP and run /release patch first. Mark task as [-] in tasks.md before starting. BLOCKING: After implementation, you MUST call the log-implementation tool with full artifacts before marking [x]. Do NOT mark [x] until the log-implementation tool call succeeds._

---

## Phase 2 — [Phase Name] (optional — remove if single-phase)

- [ ] 3. [Task title]
  - **Recommended Agent:** Claude
  - File: `[file path]`
  - [Implementation details]
  - Purpose: [Why]
  - _Leverage: [Existing code to reuse]_
  - _Requirements: REQ-Z_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: [Role] | Task: [Instructions] | Restrictions: [Constraints] | Success: [Criteria] PREREQUISITE: Before writing any code, verify you are in the correct working context. If the project uses version.lock, confirm `git branch --show-current` returns patch/VERSION. If not, STOP and run /release patch first. Mark task as [-] in tasks.md before starting. BLOCKING: After implementation, you MUST call the log-implementation tool with full artifacts before marking [x]. Do NOT mark [x] until the log-implementation tool call succeeds._

---

## Standard Closing Tasks

- [ ] C1. Establish test baseline
  - **Recommended Agent:** Claude
  - File: (no file changes — testing only)
  - Run the project's test command to establish a passing baseline before any implementation changes
  - If no test suite exists, flag this to the user and discuss whether to set one up
  - Purpose: Record the starting state so regressions can be detected
  - _Leverage: Project test configuration (test scripts, config files, CI definitions)_
  - _Requirements: All_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Identify and run the project's established test suite to verify a passing baseline before implementation. Check project documentation and config files for the test command. Record the number of passing/failing/skipped tests. If no test suite exists, flag this to the user and ask whether to set one up before proceeding. | Restrictions: Use the project's existing test framework — do not introduce a new one. Do not modify any source files. | Success: Test suite runs and baseline results (pass/fail/skip counts) are recorded. PREREQUISITE: This is a verification-only task — no worktree changes needed. BLOCKING: After recording baseline, you MUST call the log-implementation tool with the test results before marking [x]. Do NOT mark [x] until the log-implementation tool call succeeds._

- [ ] C2. Write failing tests for new behavior (TDD — BEFORE implementation)
  - **Recommended Agent:** Claude
  - File: [test file paths — determined by project conventions]
  - Write failing tests using the project's test framework for all new behavior described in requirements.md
  - Tests should map to acceptance criteria — one or more tests per AC
  - Purpose: TDD — tests define the expected behavior before code is written
  - _Leverage: Project test framework, requirements.md acceptance criteria_
  - _Requirements: All_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Write failing tests for all new behavior described in requirements.md acceptance criteria. Use the project's existing test framework and conventions. Each acceptance criterion should have at least one corresponding test. Tests MUST fail before implementation (red phase of TDD) and pass after (green phase). | Restrictions: Use the project's existing test framework — do not introduce a new one. Tests must be runnable with the project's test command. Do not write implementation code in this task. | Success: Failing tests exist for every acceptance criterion in requirements.md. Running the test suite shows the new tests fail (expected) while existing tests still pass. PREREQUISITE: Before writing any code, verify you are in the correct working context. If the project uses version.lock, confirm `git branch --show-current` returns patch/VERSION. If not, STOP and run /release patch first. Mark task as [-] in tasks.md before starting. BLOCKING: After writing tests, you MUST call the log-implementation tool with test file paths and AC mapping before marking [x]. Do NOT mark [x] until the log-implementation tool call succeeds._

- [ ] C3. Implement — make tests pass
  - **Recommended Agent:** Claude
  - File: [implementation file paths — determined by design.md]
  - Write the minimum code needed to make all failing tests from C2 pass
  - Follow existing project patterns and conventions
  - Purpose: Green phase of TDD — implementation is driven by tests
  - _Leverage: design.md architecture decisions, existing project patterns_
  - _Requirements: All_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Senior Developer | Task: Write the implementation code to make all failing tests from task C2 pass. Follow the architecture and patterns described in design.md. Use existing project utilities and patterns — do not reinvent. Keep changes minimal and focused on making tests green. | Restrictions: Do not modify test files from C2 to make them pass — fix the implementation instead. Do not introduce new dependencies without justification. Follow existing code style and patterns. | Success: All tests from C2 now pass. No existing tests regress. Code follows project conventions. PREREQUISITE: Before writing any code, verify you are in the correct working context. If the project uses version.lock, confirm `git branch --show-current` returns patch/VERSION. If not, STOP and run /release patch first. Mark task as [-] in tasks.md before starting. BLOCKING: After implementation, you MUST call the log-implementation tool with full artifacts before marking [x]. Do NOT mark [x] until the log-implementation tool call succeeds._

- [ ] C4. Run full test suite — zero regressions
  - **Recommended Agent:** Claude
  - File: (no file changes — testing only)
  - Run the project's complete test suite after all implementation is done
  - All new tests must pass; no existing tests may regress from the C1 baseline
  - Purpose: Verify implementation is complete and nothing is broken
  - _Leverage: Project test command, baseline results from C1_
  - _Requirements: All_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Run the project's full test suite. Compare results against the baseline from task C1. All new tests from C2 must pass. No existing tests may have regressed. If any test fails, diagnose and fix before proceeding — do not skip or disable failing tests. | Restrictions: Do not skip or disable any tests. Do not modify tests to make them pass unless they have a genuine bug. | Success: Full test suite passes. New test count matches C2. Zero regressions from C1 baseline. PREREQUISITE: This is a verification-only task — no file changes expected unless fixing regressions. BLOCKING: After test run, you MUST call the log-implementation tool with pass/fail/skip counts and comparison to C1 baseline before marking [x]. Do NOT mark [x] until the log-implementation tool call succeeds._

- [ ] C5. Log implementation — HARD GATE
  - **Recommended Agent:** Claude
  - File: (no file changes — logging only)
  - Call the `log-implementation` MCP tool with a comprehensive summary of ALL implementation work done across all tasks in this spec
  - Include: all functions added/modified, all files changed, all tests written, all endpoints created
  - Purpose: Create a permanent record of what was implemented for future reference and audit
  - _Leverage: Implementation logs from individual tasks, git diff_
  - _Requirements: All_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Project Coordinator | Task: Call the log-implementation MCP tool with a comprehensive summary covering all implementation tasks in this spec. Aggregate: (1) all functions added or modified with file paths, (2) all files created or changed, (3) all test files and test counts, (4) any new endpoints, routes, or APIs, (5) any configuration changes. This is the consolidated implementation record. | Restrictions: Do not skip any task's artifacts. Do not mark this task [x] until the log-implementation tool call succeeds. | Success: log-implementation MCP tool call succeeds with full artifact listing. BLOCKING: This IS the logging gate. Do NOT mark [x] until the log-implementation tool call succeeds._

- [ ] C5.5 Security Review — Codacy SRM scan
  - **Recommended Agent:** Claude
  - File: (no file changes — review only, fixes happen via loop-back if needed)
  - Run Codacy SRM (Security & Risk Management) scan against the changed files in this spec
  - Triage findings: Critical/High → MUST fix, Medium → fix or document waiver, Low/Info → advisory
  - For each Critical/High finding: either fix in code OR add a documented exclusion to `.codacy.yml` with justification
  - Purpose: Catch security regressions BEFORE PR — input validation, authn/authz, secrets handling, injection vectors, data exposure, dependency vulnerabilities
  - _Leverage: `/codacy-resolve` skill, `mcp__codacy__codacy_search_repository_srm_items`, `mcp__codacy__codacy_list_repository_issues` filtered to changed files_
  - _Requirements: Security NFR from requirements.md_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Security Engineer | Task: Invoke the /codacy-resolve skill to triage Codacy SRM findings against the files changed in this spec. For each Critical or High severity finding: (a) read the finding, (b) read the code at the cited file:line, (c) determine if it's a real issue or false positive, (d) for real issues fix the code, (e) for false positives add a documented exclusion to .codacy.yml with justification referencing this spec ID. Medium findings should be fixed or get a documented waiver in the implementation log. Low/Info findings are advisory. | Restrictions: Do not blanket-disable Codacy rules. Do not silence findings without investigation. Do not commit secrets or weaken auth checks to "fix" findings. | Success: Zero unaddressed Critical/High findings against changed files. All decisions logged. BLOCKING: After completing the security review, you MUST call the log-implementation tool with findings count and resolution summary before marking [x]. Do NOT mark [x] until the log-implementation tool call succeeds._

- [ ] C6. Generate verification.md
  - **Recommended Agent:** Claude
  - File: `DocVault/specflow/{{projectName}}/specs/{{spec-name}}/verification.md`
  - Generate a verification checklist in the spec directory
  - List every requirement and acceptance criterion from requirements.md as a checklist item
  - For each item: mark `[x]` with `file:line` code evidence, OR mark `[ ]` with a gap description
  - Purpose: Prove every requirement is met with traceable evidence — no hand-waving
  - _Leverage: requirements.md, implementation logs, git diff_
  - _Requirements: All_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: QA Engineer | Task: Generate verification.md in the spec directory. Read requirements.md and list every requirement and acceptance criterion as a markdown checklist. For each item, search the codebase for the implementing code and mark [x] with file:line evidence (e.g., "src/core/parser.ts:142 — validates input format"). If any criterion cannot be verified, mark [ ] with a description of the gap. Run /vault-update to update any DocVault pages affected by this spec's changes. Close all linked DocVault issues. Run /verification-before-completion for a final check. | Restrictions: Do not mark [x] without concrete file:line evidence. Do not fabricate evidence. If a gap exists, document it honestly. | Success: verification.md exists with every requirement/AC listed. All items marked [x] with evidence, OR [ ] items have gap descriptions. /vault-update completed. Linked issues closed. /verification-before-completion passed. BLOCKING: After generating verification.md, you MUST call the log-implementation tool before marking [x]. Do NOT mark [x] until the log-implementation tool call succeeds._

- [ ] C6.5 Codex Peer Review (cross-model verification)
  - **Recommended Agent:** Claude (orchestrator) — dispatches to Codex via `codex:codex-rescue`
  - File: (no file changes — review only, fixes happen via loop-back if needed)
  - **Self-detection guard:** IF the current session is running from Codex itself (check `$CODEX_SESSION` env var or session metadata) → mark this task `[!]` with note "blocked: running from codex, no recursive review — user must run `/codex:review` manually or skip"
  - **Install detection guard:** IF Codex CLI is not installed (`command -v codex` returns nothing) AND no `codex:codex-rescue` agent type is registered → mark this task `[!]` with note "blocked: codex not available — user must decide whether to skip peer review"
  - **Primary path (Claude dispatches):** Use the Agent tool with `subagent_type: "codex:codex-rescue"` and `run_in_background: true` to dispatch a code review. The prompt must instruct Codex to read the branch diff and report findings by severity (Critical / Important / Minor).
  - **Human fallback path:** IF Claude cannot dispatch `codex:codex-rescue` (agent-dispatch context, permission denied, etc.) → STOP and tell the user to run `/codex:review --base &lt;main-or-dev&gt;` manually, then paste findings back. Do NOT mark this task `[x]` until findings are received and addressed.
  - Address all Critical and Important findings before proceeding to C7
  - Minor findings are advisory — fix at discretion, document in log
  - **NEVER silently skip this task.** If the review cannot run for any reason, mark `[!]` (BLOCKED) — never `[x]`. The user must explicitly decide to proceed without peer review.
  - Purpose: Cross-model peer review catches blind spots a single AI might miss; using a different model architecture surfaces different classes of bugs
  - _Leverage: `codex:codex-rescue` subagent (with review prompt), `/codex:review` (user-invocable fallback), branch git diff_
  - _Requirements: All_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Code Review Coordinator | Task: First, check skip guards: (a) if running from Codex (check $CODEX_SESSION or session origin), mark this task [!] BLOCKED with note "running from codex — user must run /codex:review manually or skip" and STOP. (b) if Codex CLI not installed and codex:codex-rescue agent type unavailable, mark this task [!] BLOCKED with note "codex not available — user decides" and STOP. Otherwise, dispatch the review: use the Agent tool with subagent_type "codex:codex-rescue" and run_in_background true. The review prompt for the Codex agent MUST be: "You are reviewing a git branch diff for code quality. Run `git diff $(git merge-base HEAD main || git merge-base HEAD dev || echo main)...HEAD` to read the changes (auto-detects base branch). For each file changed, check: (1) correctness — logic bugs, wrong return types, off-by-one errors, race conditions; (2) CLAUDE.md compliance — does the code follow the project's CLAUDE.md instructions; (3) security — injection vectors, unvalidated input, exposed secrets, XSS; (4) patterns — does it follow existing codebase patterns or introduce inconsistencies; (5) edge cases — null/undefined handling, empty arrays, boundary conditions. Report findings grouped by severity: Critical (would break prod / security / data loss), Important (bug, wrong pattern, missed edge case), Minor (style, naming, comments). For each finding include the file path, line range, and a one-sentence explanation. If no issues found, report 'No issues found'." After the Codex agent returns: read the findings. Fix any Critical or Important issues by looping back to implementation. Minor issues are advisory. If the Codex dispatch fails or hangs (no response within 5 minutes), mark this task [!] BLOCKED and tell the user to run /codex:review --base &lt;ref&gt; manually. Record all review findings (or block reason) in the implementation log. | Restrictions: NEVER mark this task [x] if the review was skipped or blocked — use [!] instead. Do not dismiss findings without investigating. The user must explicitly approve proceeding without peer review if this task is [!]. | Success: Codex review completed with Critical/Important issues addressed AND log-implementation called with findings, OR task is marked [!] BLOCKED with documented reason for user decision. BLOCKING: After review completion, you MUST call the log-implementation tool with review findings before marking [x]. After block, you MUST call log-implementation with the block reason before marking [!]. Do NOT mark [x] or [!] until the log-implementation tool call succeeds._

- [ ] C7. Loop or complete
  - **Recommended Agent:** Claude
  - File: (no file changes — decision gate only)
  - IF ANY task above is marked `[!]` (BLOCKED) → STOP. Present the blocked tasks to the user. The user must explicitly decide: (a) resolve the block and re-run the task, or (b) waive the requirement with a documented justification logged via log-implementation. Do NOT proceed past a `[!]` without user decision.
  - IF verification.md has ANY unchecked `[ ]` items → return to task C2 and write tests for the gaps, then implement (C3), test (C4), log (C5), security review (C5.5), verify (C6), peer review (C6.5)
  - IF C5.5 found unaddressed Critical/High security findings → return to C3 to fix them
  - IF C6.5 Codex review found unaddressed Critical/Important issues → return to C3 to fix them
  - ONLY when ALL items in verification.md are `[x]` AND C5.5 has zero unaddressed findings AND C6.5 has zero unaddressed findings (or user-waived with justification) AND zero `[!]` tasks remain → proceed to PR/commit
  - Purpose: Enforce the verification loop — specs are not complete until every requirement is proven AND all reviews pass. The `[!]` blocked state prevents silent task skipping — a task that cannot complete must be explicitly resolved by the user, not silently marked done.
  - _Leverage: verification.md from C6, Codacy results from C5.5, Codex results from C6.5, task state markers from all tasks_
  - _Requirements: All_
  - _Prompt: Implement the task for spec {{spec-name}}, first run spec-workflow-guide to get the workflow guide then implement the task: Role: Project Coordinator | Task: First, scan ALL tasks in this spec for any marked [!] (BLOCKED). IF any [!] tasks exist: list them with their block reasons, present to the user, and STOP. The user must either resolve each block or explicitly waive it with justification. Do NOT proceed until all [!] tasks are resolved or waived. Then: read verification.md from task C6. Count unchecked [ ] items. Read C5.5 security findings — count unaddressed Critical/High. Read C6.5 Codex findings — count unaddressed Critical/Important. IF any of those counts are non-zero: list the gaps, return to task C2/C3 to fix them, then re-execute C3 through C6.5 in order. Repeat until all three counts are zero. ONLY when all are clean AND zero [!] tasks remain: proceed to create the PR or commit. | Restrictions: Do NOT proceed to PR/commit if ANY [ ] items remain in verification.md OR ANY unaddressed security/peer-review findings remain OR ANY [!] tasks exist without user waiver. Do NOT remove unchecked items to force completion. Do NOT change [!] to [x] without user decision. Each loop iteration must go through C2→C6.5 in order. | Success: Zero [!] blocked tasks (all resolved or user-waived). verification.md has zero unchecked items. C5.5 has zero unaddressed Critical/High. C6.5 has zero unaddressed Critical/Important. All requirements are proven with code evidence. PR/commit may proceed. BLOCKING: After confirming all items are verified, all reviews are clean, and no blocked tasks remain, you MUST call the log-implementation tool with the final verification status before marking [x]. Do NOT mark [x] until the log-implementation tool call succeeds._
