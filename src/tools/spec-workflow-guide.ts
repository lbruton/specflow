import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';

export const specWorkflowGuideTool: Tool = {
  name: 'spec-workflow-guide',
  description: `Load essential spec workflow instructions to guide feature development from idea to implementation.

# Instructions
Call this tool FIRST when users request spec creation, feature development, or mention specifications. This provides the complete workflow sequence (Requirements → Design → Tasks → Implementation) that must be followed. Always load before any other spec tools to ensure proper workflow understanding. Its important that you follow this workflow exactly to avoid errors.`,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },
  annotations: {
    title: 'Spec Workflow Guide',
    readOnlyHint: true,
  }
};

export async function specWorkflowGuideHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  // Dashboard URL is populated from registry in server.ts
  const dashboardMessage = context.dashboardUrl ?
    `Monitor progress on dashboard: ${context.dashboardUrl}` :
    'Please start the dashboard with: spec-workflow-mcp --dashboard';

  return {
    success: true,
    message: 'Complete spec workflow guide loaded - follow this workflow exactly',
    data: {
      guide: getSpecWorkflowGuide(),
      dashboardUrl: context.dashboardUrl,
      dashboardAvailable: !!context.dashboardUrl
    },
    nextSteps: [
      'Follow sequence: Requirements → Design → Tasks → Implementation',
      'Load templates with get-template-context first',
      'Request approval after each document',
      'Use MCP tools only',
      dashboardMessage
    ]
  };
}

function getSpecWorkflowGuide(): string {
  const currentYear = new Date().getFullYear();
  return `# Spec Development Workflow

## Overview

You guide users through spec-driven development using MCP tools. Transform rough ideas into detailed specifications through Requirements → Design → Tasks → Implementation phases. Use web search when available for current best practices (current year: ${currentYear}). Its important that you follow this workflow exactly to avoid errors.
Spec names MUST use Linear issue prefix: {ISSUE-ID}-{kebab-title} (e.g., STAK-123-user-authentication). A Linear issue is REQUIRED — specs without one cannot be created. Create ONE spec at a time.

## Workflow Diagram
\`\`\`mermaid
flowchart TD
    Start([Start: User requests feature]) --> CheckSteering{Steering docs exist?}
    CheckSteering -->|Yes| P1_Load[Read steering docs:<br/>.spec-workflow/steering/*.md]
    CheckSteering -->|No| P1_Template

    %% Phase 1: Requirements
    P1_Load --> P1_Template[Check user-templates first,<br/>then read template:<br/>requirements-template.md]
    P1_Template --> P1_Research[Web search if available]
    P1_Research --> P1_Create[Create file:<br/>.spec-workflow/specs/{name}/<br/>requirements.md]
    P1_Create --> P1_Approve[approvals<br/>action: request<br/>filePath only]
    P1_Approve --> P1_Status[approvals<br/>action: status<br/>poll status]
    P1_Status --> P1_Check{Status?}
    P1_Check -->|needs-revision| P1_Update[Update document using user comments as guidance]
    P1_Update --> P1_Create
    P1_Check -->|approved| P1_Clean[approvals<br/>action: delete]
    P1_Clean -->|failed| P1_Status

    %% Phase 2: Design
    P1_Clean -->|success| P2_Template[Check user-templates first,<br/>then read template:<br/>design-template.md]
    P2_Template --> P2_Analyze[Analyze codebase patterns]
    P2_Analyze --> P2_Create[Create file:<br/>.spec-workflow/specs/{name}/<br/>design.md]
    P2_Create --> P2_Approve[approvals<br/>action: request<br/>filePath only]
    P2_Approve --> P2_Status[approvals<br/>action: status<br/>poll status]
    P2_Status --> P2_Check{Status?}
    P2_Check -->|needs-revision| P2_Update[Update document using user comments as guidance]
    P2_Update --> P2_Create
    P2_Check -->|approved| P2_Clean[approvals<br/>action: delete]
    P2_Clean -->|failed| P2_Status

    %% Phase 3: Tasks
    P2_Clean -->|success| P3_Template[Check user-templates first,<br/>then read template:<br/>tasks-template.md]
    P3_Template --> P3_Break[Convert design to tasks]
    P3_Break --> P3_Create[Create file:<br/>.spec-workflow/specs/{name}/<br/>tasks.md]
    P3_Create --> P3_Approve[approvals<br/>action: request<br/>filePath only]
    P3_Approve --> P3_Status[approvals<br/>action: status<br/>poll status]
    P3_Status --> P3_Check{Status?}
    P3_Check -->|needs-revision| P3_Update[Update document using user comments as guidance]
    P3_Update --> P3_Create
    P3_Check -->|approved| P3_Clean[approvals<br/>action: delete]
    P3_Clean -->|failed| P3_Status

    %% Phase 3.5: Visual Prototype Gate (conditional)
    P3_Clean -->|success| P35_Check{design.md declares<br/>UI changes?}
    P35_Check -->|No| IRG_Run
    P35_Check -->|Yes| P35_Mockup[Tasks 0.1-0.3:<br/>Stitch mockup +<br/>Playground prototype]
    P35_Mockup --> P35_Approve{User approves<br/>visual design?}
    P35_Approve -->|No| P35_Revise[Revise mockup/<br/>prototype]
    P35_Revise --> P35_Mockup
    P35_Approve -->|Yes| P35_Update[Update design.md<br/>Prototype Artifacts]
    P35_Update --> IRG_Run

    %% Phase 3.9: Implementation Readiness Gate
    IRG_Run[Cross-validate:<br/>requirements + design + tasks<br/>Save readiness-report.md] --> IRG_Approve[approvals<br/>action: request<br/>readiness-report.md]
    IRG_Approve --> IRG_Status[approvals<br/>action: status<br/>poll status]
    IRG_Status --> IRG_Result{Dashboard<br/>decision?}
    IRG_Result -->|approved| IRG_Clean[approvals<br/>action: delete]
    IRG_Clean -->|success| P4_Ready[Spec complete.<br/>Ready to implement?]
    IRG_Clean -->|failed| IRG_Status
    IRG_Result -->|concerns| IRG_Log[Log concerns to<br/>tasks.md then<br/>delete approval]
    IRG_Log --> P4_Ready
    IRG_Result -->|rejected| IRG_Fix[Fix spec documents<br/>to resolve<br/>misalignment]
    IRG_Fix --> IRG_Run

    %% Phase 4: Implementation
    P4_Ready -->|Yes| P4_Status[spec-status]
    P4_Status --> P4_Task[Edit tasks.md:<br/>Change [ ] to [-]<br/>for in-progress]
    P4_Task --> P4_Code[Dispatch subagent:<br/>Implement code]
    P4_Code --> P4_SpecReview{Spec compliance<br/>review?}
    P4_SpecReview -->|pass| P4_QualityReview{Code quality<br/>review?}
    P4_SpecReview -->|fail| P4_Code
    P4_QualityReview -->|pass| P4_Log[log-implementation<br/>Record implementation<br/>details]
    P4_QualityReview -->|fail| P4_Code
    P4_Log --> P4_Complete[Edit tasks.md:<br/>Change [-] to [x]<br/>for completed]
    P4_Complete --> P4_More{More tasks?}
    P4_More -->|Yes| P4_Task
    P4_More -->|No| P5_Start[Phase 5:<br/>Wiki + E2E]
    P5_Start --> P5_Wiki[/wiki-update:<br/>Update wiki pages]
    P5_Wiki --> P5_E2E[/bb-test:<br/>Browserbase/Stagehand E2E<br/>against PR preview URL]
    P5_E2E --> P5_Check{Tests pass?}
    P5_Check -->|fail| P5_Fix[File Linear bug<br/>fix in new patch]
    P5_Check -->|pass| P5_Linear[Close Linear issues<br/>Move to Done]
    P5_Linear --> Done([Spec Complete])

    style Start fill:#e1f5e1
    style Done fill:#e1f5e1
    style P5_Start fill:#e3f2fd
    style P5_Check fill:#fff4e6
    style P1_Check fill:#ffe6e6
    style P2_Check fill:#ffe6e6
    style P3_Check fill:#ffe6e6
    style P4_SpecReview fill:#ffe6e6
    style P4_QualityReview fill:#ffe6e6
    style CheckSteering fill:#fff4e6
    style P4_More fill:#fff4e6
    style P35_Check fill:#fff4e6
    style P35_Approve fill:#ffe6e6
    style P35_Mockup fill:#e8f5e9
    style P35_Update fill:#e3f2fd
    style IRG_Run fill:#f3e5f5
    style IRG_Approve fill:#e3f2fd
    style IRG_Result fill:#ffe6e6
    style IRG_Clean fill:#e3f2fd
    style IRG_Log fill:#fff4e6
    style IRG_Fix fill:#ffe6e6
    style P4_Log fill:#e3f2fd
\`\`\`

## Spec Workflow

### Phase 1: Requirements
**Purpose**: Define what to build based on user needs.

**File Operations**:
- Read steering docs: \`.spec-workflow/steering/*.md\` (if they exist)
- Check for custom template: \`.spec-workflow/user-templates/requirements-template.md\`
- Read template: \`.spec-workflow/templates/requirements-template.md\` (if no custom template)
- Create document: \`.spec-workflow/specs/{issue-id}-{kebab-title}/requirements.md\`

**Tools**:
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Check if \`.spec-workflow/steering/\` exists (if yes, read product.md, tech.md, structure.md)
2. Check for custom template at \`.spec-workflow/user-templates/requirements-template.md\`
3. If no custom template, read from \`.spec-workflow/templates/requirements-template.md\`
4. Research market/user expectations (if web search available, current year: ${currentYear})
5. Generate requirements as user stories with EARS criteria6. Create \`requirements.md\` at \`.spec-workflow/specs/{issue-id}-{kebab-title}/requirements.md\`
7. Request approval using approvals tool with action:'request' (filePath only, never content)
8. Poll status using approvals with action:'status' until approved/needs-revision (NEVER accept verbal approval)
9. If needs-revision: update document using comments, create NEW approval, do NOT proceed
10. Once approved: use approvals with action:'delete' (must succeed) before proceeding
11. If delete fails: STOP - return to polling

### Phase 2: Design
**Purpose**: Create technical design addressing all requirements.

**File Operations**:
- Check for custom template: \`.spec-workflow/user-templates/design-template.md\`
- Read template: \`.spec-workflow/templates/design-template.md\` (if no custom template)
- Create document: \`.spec-workflow/specs/{issue-id}-{kebab-title}/design.md\`

**Tools**:
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Check for custom template at \`.spec-workflow/user-templates/design-template.md\`
2. If no custom template, read from \`.spec-workflow/templates/design-template.md\`
3. Analyze codebase for patterns to reuse
4. Research technology choices (if web search available, current year: ${currentYear})
5. Generate design with all template sections6. Create \`design.md\` at \`.spec-workflow/specs/{issue-id}-{kebab-title}/design.md\`
7. Request approval using approvals tool with action:'request'
8. Poll status using approvals with action:'status' until approved/needs-revision
9. If needs-revision: update document using comments, create NEW approval, do NOT proceed
10. Once approved: use approvals with action:'delete' (must succeed) before proceeding
11. If delete fails: STOP - return to polling

### Phase 3: Tasks
**Purpose**: Break design into atomic implementation tasks.

**File Operations**:
- Check for custom template: \`.spec-workflow/user-templates/tasks-template.md\`
- Read template: \`.spec-workflow/templates/tasks-template.md\` (if no custom template)
- Create document: \`.spec-workflow/specs/{issue-id}-{kebab-title}/tasks.md\`

**Tools**:
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Check for custom template at \`.spec-workflow/user-templates/tasks-template.md\`
2. If no custom template, read from \`.spec-workflow/templates/tasks-template.md\`
3. Convert design into atomic tasks (1-3 files each)
4. Include file paths and requirement references
5. **IMPORTANT**: Generate a _Prompt field for each task with:
   - Role: specialized developer role for the task
   - Task: clear description with context references
   - Restrictions: what not to do, constraints to follow
   - _Leverage: files/utilities to use
   - _Requirements: requirements that the task implements
   - Success: specific completion criteria
   - Instructions related to setting the task in progress in tasks.md, logging the implementation with log-implementation tool after completion, and then marking it as complete when the task is complete.
   - Start the prompt with "Implement the task for spec {issue-id}-{kebab-title}, first run spec-workflow-guide to get the workflow guide then implement the task:"
6. (Optional) Add a **Recommended Agent** field to each task: Claude, Codex, Gemini, or Human
7. Include a **File Touch Map** at the top of tasks.md listing all files the spec will CREATE, MODIFY, or TEST with brief scope notes
8. Create \`tasks.md\` at \`.spec-workflow/specs/{issue-id}-{kebab-title}/tasks.md\`
7. Request approval using approvals tool with action:'request'
8. Poll status using approvals with action:'status' until approved/needs-revision
9. If needs-revision: update document using comments, create NEW approval, do NOT proceed
10. Once approved: use approvals with action:'delete' (must succeed) before proceeding
11. If delete fails: STOP - return to polling
12. After successful cleanup: "Spec complete. Ready to implement?"

### Phase 3.5: Visual Prototype Gate (conditional)
**Purpose**: Ensure UI changes have visual approval before any implementation code is written.

**Trigger**: This phase fires automatically if design.md contains \`Has UI Changes: Yes\` AND \`Prototype Required: Yes\` in the UI Impact Assessment section.

**Skip condition**: If \`Has UI Changes: No\` or \`Prototype Required: No\`, skip directly to Phase 4.

**Process**:
1. Read design.md and check the \`UI Impact Assessment\` section
2. If UI changes are declared with prototype required:
   - Execute tasks 0.1–0.3 from tasks.md (these are the prototype gate tasks)
   - Task 0.1: Create visual mockup via \`ui-mockup\` skill (Stitch) or \`frontend-design\` skill
   - Task 0.2: Build interactive prototype via \`playground\` skill
   - Task 0.3: Present to user, collect explicit visual approval
3. If a reference HTML/mockup file path is listed in design.md, the prototype MUST use it as the baseline — do not ignore provided prototypes
4. Update design.md \`Prototype Artifacts\` section with Stitch IDs and playground path
5. **BLOCKING**: No task tagged \`ui:true\` may begin until visual approval is recorded
6. Proceed to Phase 4

**CRITICAL**: If a spec has a prototype HTML file referenced in design.md or requirements.md and the implementer ignores it, that is a spec compliance failure. The prototype is the source of truth for visual design — not the implementer's interpretation of the text description.

### Phase 3.9: Implementation Readiness Gate
**Purpose**: Cross-validate all spec documents for internal consistency before any code is written.

**Trigger**: This phase fires automatically after Phase 3 approval (and Phase 3.5 if applicable). It runs on EVERY spec — it is not conditional.

**File Operations**:
- Read specs: \`.spec-workflow/specs/{issue-id}-{kebab-title}/requirements.md\`, \`design.md\`, \`tasks.md\`
- Create report: \`.spec-workflow/specs/{issue-id}-{kebab-title}/readiness-report.md\`

**Tools**:
- approvals: Submit readiness report for dashboard review (actions: request, status, delete)

**Process**:
1. Read all three spec documents: \`requirements.md\`, \`design.md\`, \`tasks.md\`
2. Perform cross-validation checks:
   - **Requirement coverage**: Every requirement/user story in requirements.md has at least one corresponding task in tasks.md. Flag orphaned requirements.
   - **Task traceability**: Every task in tasks.md references valid requirements via its \`_Requirements\` field. Flag tasks with no requirement linkage.
   - **Design-task alignment**: Design decisions (components, data model, API changes) in design.md are reflected in the task structure. Flag design elements with no implementing task.
   - **No contradictions**: Check for conflicting statements between documents (e.g., design says "modal" but tasks say "inline panel").
   - **Prototype consistency**: If design.md references a prototype HTML file, verify it appears in task 0.1-0.3 artifacts and/or task \`_Leverage\` fields.
   - **File touch map validation**: Verify the File Touch Map in tasks.md covers all files mentioned in individual tasks.
3. Save the report as \`readiness-report.md\` in the spec folder using the output format below.
4. Request dashboard approval using approvals tool with action:'request', filePath pointing to readiness-report.md
5. Poll status using approvals with action:'status' until responded — the user has THREE options on the dashboard:
   - **Approve (PASS)**: All checks satisfied. Proceed to Phase 4.
   - **Concerns**: Minor gaps acknowledged. Agent proceeds to Phase 4 but MUST append a \`## Readiness Concerns\` section to tasks.md with the user's noted concerns.
   - **Reject (FAIL)**: Critical misalignment. Agent fixes the spec documents and re-runs the readiness check from step 1.
6. Once approved or concerns-acknowledged: use approvals with action:'delete' (must succeed) before proceeding.
7. If delete fails: STOP - return to polling.

**Report format** (saved to readiness-report.md):
\`\`\`markdown
# Implementation Readiness Report
- **Spec**: {spec-name}
- **Generated**: {timestamp}
- **Recommendation**: PASS | CONCERNS | FAIL

## Requirement Coverage (X/Y mapped)
- REQ-1.1: Task 2, Task 3 ✓
- REQ-2.1: [MISSING] ✗

## Design-Task Alignment
- Component X: Task 4 ✓
- Data model change Y: [NO IMPLEMENTING TASK] ✗

## Contradictions
- None found | List of conflicts

## Prototype Consistency
- N/A | Verified | [MISSING from task leverage]

## File Touch Map
- Consistent | [Task 5 touches foo.js but File Touch Map omits it]

## Agent Recommendation
{Brief explanation of the recommendation — why PASS/CONCERNS/FAIL}
\`\`\`

**CRITICAL**: This gate catches the #1 cause of spec implementation failures — tasks that drift from requirements during the design-to-tasks translation. Running this check takes 30 seconds and prevents hours of rework.
**CRITICAL**: The readiness report MUST be submitted to the dashboard for human review. Verbal approval is NOT accepted. The agent's recommendation (PASS/CONCERNS/FAIL) is advisory — the human makes the final call via the dashboard.

### Phase 4: Implementation
**Purpose**: Execute tasks systematically.

**File Operations**:
- Read specs: \`.spec-workflow/specs/{issue-id}-{kebab-title}/*.md\` (if returning to work)
- Edit tasks.md to update status:
  - \`- [ ]\` = Pending task
  - \`- [-]\` = In-progress task
  - \`- [x]\` = Completed task

**Tools**:
- spec-status: Check overall progress
- Bash (grep/ripgrep): CRITICAL - Search existing code before implementing (step 3)
- Read: Examine implementation log files directly
- implement-task prompt: Guide for implementing tasks
- log-implementation: Record implementation details with artifacts after task completion (step 5)
- Direct editing: Mark tasks as in-progress [-] or complete [x] in tasks.md

**Process**:
1. Check current status with spec-status
2. Read \`tasks.md\` to see all tasks
3. For each task:
   - **UI GATE CHECK**: Before dispatching any task that creates or modifies UI components, verify:
     - Read design.md \`UI Impact Assessment\` section
     - If \`Prototype Required: Yes\`, confirm tasks 0.1–0.3 are marked \`[x]\` and \`Prototype Artifacts\` in design.md are populated
     - If prototype gate is incomplete, STOP — complete Phase 3.5 first
     - Include the playground file path and/or Stitch screen IDs in the subagent prompt so the implementer has the approved visual reference
   - Edit tasks.md: Change \`[ ]\` to \`[-]\` for the task you're starting
   - **CRITICAL: BEFORE implementing, search existing implementation logs**:
     - Implementation logs are in: \`.spec-workflow/specs/{issue-id}-{kebab-title}/Implementation Logs/\`
     - **Option 1: Use grep for fast searches**:
       - \`grep -r "api\|endpoint" .spec-workflow/specs/{issue-id}-{kebab-title}/Implementation Logs/\` - Find API endpoints
       - \`grep -r "component" .spec-workflow/specs/{issue-id}-{kebab-title}/Implementation Logs/\` - Find UI components
       - \`grep -r "function" .spec-workflow/specs/{issue-id}-{kebab-title}/Implementation Logs/\` - Find utility functions
       - \`grep -r "integration" .spec-workflow/specs/{issue-id}-{kebab-title}/Implementation Logs/\` - Find integration patterns
     - **Option 2: Read markdown files directly** - Use Read tool to examine specific log files
     - Best practice: Search 2-3 different terms to discover comprehensively
     - This prevents: duplicate endpoints, reimplemented components, broken integrations
     - Reuse existing code that already solves part of the task
   - **Read the _Prompt field** for guidance on role, approach, and success criteria
   - Follow _Leverage fields to use existing code/utilities
   - Implement the code according to the task description
   - **Test your implementation — tests MUST be run, not just written**:
     - Run all tests relevant to this task (unit, integration, E2E as appropriate)
     - Record actual execution results (pass/fail counts, framework, duration)
     - If tests fail, fix them before proceeding — do NOT log failing tests as "passed"
     - If no automated tests exist for this task, at minimum verify the feature manually and log as framework: "manual"
     - A task logged with 0 total tests is a red flag — every task should have some form of validation
   - **MANDATORY: Log implementation BEFORE marking task complete** using log-implementation tool:
     - ⚠️ Do NOT change [-] to [x] until log-implementation returns success
     - A task without an implementation log is NOT complete — this is the most commonly skipped step
     - Provide taskId and clear summary of what was implemented (1-2 sentences)
     - Include files modified/created and code statistics (lines added/removed)
     - **REQUIRED: Include artifacts field with structured implementation data**:
       - apiEndpoints: All API routes created/modified (method, path, purpose, formats, location)
       - components: All UI components created (name, type, purpose, location, props)
       - functions: All utility functions created (name, signature, location)
       - classes: All classes created (name, methods, location)
       - integrations: Frontend-backend connections with data flow description
       - tests: All tests run (name, type, framework, location, status, pass/fail counts, linked userStories from spec requirements)
     - Example: "Created API GET /api/todos/:id endpoint and TodoDetail React component with WebSocket real-time updates. E2E tests: 12/12 passed covering user stories 1.1, 1.2, 2.1"
     - This creates a searchable knowledge base for future AI agents to discover existing code
     - Prevents implementation details from being lost in chat history
   - **Only after log-implementation succeeds**: Edit tasks.md: Change \`[-]\` to \`[x]\`
4. Continue until all tasks show \`[x]\`

#### Execution Strategy

Choose ONE approach per session:

**Same-Session Subagents (default)** — Dispatch a fresh Agent (subagent) per task. The main conversation context stays clean for orchestration — tracking progress, dispatching agents, reviewing results, making architectural decisions. All coding, file editing, testing, and codebase searching happens inside subagents.

Never write implementation code in the main context — dispatch a subagent instead.

**Parallel Session** — If the plan has 10+ tasks, split into session-sized batches. Each session handles ~3-4 batches of 3 tasks. Use a handoff mechanism between sessions to relay context (spec name, completed tasks, next task).

**Implementer template**: See \`.spec-workflow/templates/implementer-prompt-template.md\` for the subagent dispatch template. Paste the full task text into the subagent prompt — don't make the subagent read the plan file.

#### Two-Stage Review (after each task, BEFORE marking [x])

After the implementer subagent reports back, run two review stages before logging and marking complete:

**Stage 1 — Spec Compliance Review:**
Dispatch a reviewer subagent to verify the implementer built what was requested — nothing more, nothing less.
- Compare actual code to task requirements line by line
- Check for missing requirements, extra/unneeded work, misunderstandings
- ✅ Pass = proceed to Stage 2
- ❌ Fail = implementer fixes issues → dispatch reviewer again
- Template: \`.spec-workflow/templates/spec-reviewer-template.md\`

**Stage 2 — Code Quality Review:**
Only dispatch AFTER Stage 1 passes. Verify the code is well-built and production-ready.
- Check: architecture, error handling, testing, security, performance
- Categorize issues: Critical (must fix) / Important (should fix) / Minor (nice to have)
- ✅ Approved = proceed to log-implementation → mark [x]
- Issues found = implementer fixes → dispatch reviewer again
- Template: \`.spec-workflow/templates/code-quality-reviewer-template.md\`

**Review loop:** If either reviewer finds issues, the implementer subagent fixes them, then the reviewer re-reviews. Repeat until approved. Never skip re-review — "it should be fine now" is not verification.

#### Context Budget

- Session budget: ~125k tokens (~15-20 task dispatches with reviews)
- After 10+ agent dispatches or 70% context usage: suggest handoff to a fresh session
- Save handoff context: spec name, completed task list, in-progress state, next task ID
- NEVER wait for auto-compaction — it loses context silently

#### Main Context vs Subagent Responsibilities

| Main Context (orchestrator) | Subagents (workers) |
|----------------------------|---------------------|
| Read plan, extract tasks | Write code, edit files |
| Dispatch agents with context | Run tests, verify output |
| Review agent summaries | Read large files |
| Make architectural decisions | Debug and fix issues |
| Track progress (task list) | Search codebase |
| Approve/reject agent work | Generate new files |

### Phase 5: Post-Implementation (Wiki + E2E)
**Purpose**: Update documentation and verify the feature end-to-end before closing the spec.

**File Operations**:
- Read spec files and tasks.md to identify affected source files
- Wiki pages updated in-place via \`/wiki-update\` skill

**Tools**:
- Skill \`wiki-update\`: Detects affected wiki pages via YAML frontmatter \`sourceFiles\` and rewrites them from current source
- Skill \`bb-test\`: Browserbase/Stagehand cloud E2E tests — **primary E2E tool for all specs**
- \`mcp__claude_ai_Linear__save_issue\`: Close linked Linear issues

**⚠️ Do NOT use browserless or /smoke-test for spec E2E** — browserless is unreliable. All E2E testing uses Browserbase/Stagehand.

**Process**:
1. Run \`/wiki-update\` — auto-detects wiki pages whose YAML frontmatter \`sourceFiles\` match changed files and rewrites them from current source. Do not manually edit wiki pages.
2. **Get the PR preview URL** before running E2E — do not test against staktrakr.pages.dev (main):
   \`\`\`bash
   # Get Cloudflare Pages preview URL from the draft PR
   gh pr checks <PR_NUMBER> --json name,state,targetUrl \\
     | python3 -c "import sys,json; checks=json.load(sys.stdin); [print(c['targetUrl']) for c in checks if 'pages.dev' in c.get('targetUrl','')]"
   # Or: gh pr view <PR_NUMBER> --json statusCheckRollup \\
   #   --jq '[.statusCheckRollup[] | select(.targetUrl | test("pages.dev"))] | .[0].targetUrl'
   \`\`\`
   Wait for the Cloudflare Pages check to complete (green) before proceeding.
3. Run \`/bb-test\` with the preview URL — Browserbase/Stagehand against the PR preview deployment. Session has a **10-minute hard timeout**: if any individual test step has not returned a result within 10 minutes, skip it, log a warning, and move on. Do not block spec closure on a timed-out step.
4. If E2E tests fail: file a Linear bug issue and fix in a new patch — do not block spec closure for failures unrelated to this spec's changes.
5. **MANDATORY — Close all linked issues:**
   - **Linear**: Use \`mcp__plugin_linear_linear__save_issue\` to move each linked issue's state to "Done"
   - **GitHub**: Run \`gh issue close <number>\` for each linked GitHub issue
   - Verify closure: \`gh issue view <number> --json state\` should show "CLOSED"
   - A spec with open issues is NOT complete — this is the most commonly forgotten step
6. **The spec is NOT complete until wiki is updated AND E2E tests have been run AND all linked issues are closed.**

## Workflow Rules

- Create documents directly at specified file paths
- Read templates from \`.spec-workflow/templates/\` directory
- Follow exact template structures
- Get explicit user approval between phases (using approvals tool with action:'request')
- Complete phases in sequence (no skipping)
- Phase 5 (wiki + E2E) is mandatory — do not declare spec complete until wiki is updated and E2E tests have been run
- Phase 5 E2E always uses Browserbase/Stagehand (/bb-test) against the PR preview URL — never browserless/smoke-test
- One spec at a time
- Spec names use Linear issue prefix: {ISSUE-ID}-{kebab-title}
- Approval requests: provide filePath only, never content
- BLOCKING: Never proceed if approval delete fails
- CRITICAL: Must have approved status AND successful cleanup before next phase
- CRITICAL: Every task marked [x] MUST have a corresponding implementation log — call log-implementation BEFORE changing [-] to [x]
- CRITICAL: Every completed spec MUST have all linked Linear AND GitHub issues closed — a spec with open issues is NOT done
- CRITICAL: Specs with UI changes MUST complete Phase 3.5 (visual prototype gate) before any UI implementation task begins
- CRITICAL: If design.md references a prototype HTML file, implementers MUST source their visual design from it — ignoring a provided prototype is a spec compliance failure
- CRITICAL: Phase 3.9 (Implementation Readiness Gate) fires on EVERY spec before Phase 4 — generates readiness-report.md, submits to dashboard for review. Three dashboard actions: Approve (proceed), Concerns (proceed with logged risks), Reject (fix and re-run). Verbal approval NOT accepted.
- CRITICAL: Verbal approval is NEVER accepted - dashboard or VS Code extension only
- NEVER proceed on user saying "approved" - check system status only
- Steering docs are optional - only create when explicitly requested

## File Structure
\`\`\`
.spec-workflow/
├── templates/           # Auto-populated on server start
│   ├── requirements-template.md
│   ├── design-template.md
│   ├── tasks-template.md
│   ├── product-template.md
│   ├── tech-template.md
│   └── structure-template.md
├── specs/
│   └── {ISSUE-ID}-{kebab-title}/
│       ├── requirements.md
│       ├── design.md
│       ├── tasks.md
│       └── Implementation Logs/     # Created automatically
│           ├── task-1_timestamp_id.md
│           ├── task-2_timestamp_id.md
│           └── ...
└── steering/
    ├── product.md
    ├── tech.md
    └── structure.md
\`\`\``;
}