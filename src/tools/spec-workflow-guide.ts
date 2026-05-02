import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';

export const specWorkflowGuideTool: Tool = {
  name: 'spec-workflow-guide',
  description: `Load essential spec workflow instructions to guide feature development from idea to implementation.

# Instructions
Call this tool FIRST when users request spec creation, feature development, or mention specifications. This provides the complete workflow sequence (Requirements → Design → Tasks → Implementation) that must be followed. Always load before any other spec tools to ensure proper workflow understanding. Its important that you follow this workflow exactly to avoid errors.`,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  annotations: {
    title: 'Spec Workflow Guide',
    readOnlyHint: true,
  },
};

export async function specWorkflowGuideHandler(
  args: any,
  context: ToolContext,
): Promise<ToolResponse> {
  // Dashboard URL is populated from registry in server.ts
  const dashboardMessage = context.dashboardUrl
    ? `Monitor progress on dashboard: ${context.dashboardUrl}`
    : 'Please start the dashboard with: specflow --dashboard';

  return {
    success: true,
    message: 'Complete spec workflow guide loaded - follow this workflow exactly',
    data: {
      guide: getSpecWorkflowGuide(PathUtils.getWorkflowRoot(context.projectPath)),
      dashboardUrl: context.dashboardUrl,
      dashboardAvailable: !!context.dashboardUrl,
    },
    nextSteps: [
      'Follow sequence: Requirements → Design → Tasks → Implementation',
      'Read the current phase template from the resolved workflow root',
      'Request approval after each document',
      'Use MCP tools only',
      dashboardMessage,
    ],
  };
}

function getSpecWorkflowGuide(workflowRoot: string): string {
  const currentYear = new Date().getFullYear();
  // workflowRoot is the resolved path (DocVault or local ${wr}/)
  // Use it in all path references so agents look in the right place
  const wr = workflowRoot;
  return `# Spec Development Workflow

## Overview

You guide users through spec-driven development using MCP tools. Transform rough ideas into detailed specifications through Requirements → Design → Tasks → Implementation phases. Use web search when available for current best practices (current year: ${currentYear}). Its important that you follow this workflow exactly to avoid errors.
Spec names MUST use issue prefix: {ISSUE-ID}-{kebab-title} (e.g., STAK-123-user-authentication). An issue is REQUIRED — specs without one cannot be created. Create ONE spec at a time.

## Workflow Diagram
\`\`\`mermaid
flowchart TD
    Start([Start: User requests feature]) --> P1_Template

    %% Phase 1: Requirements
    P1_Template[Check project template overrides,<br/>then global template:<br/>requirements-template.md]
    P1_Template --> P1_Research[Web search if available]
    P1_Research --> P1_Create[Create file:<br/>${wr}/specs/{name}/<br/>requirements.md]
    P1_Create --> P1_Approve[approvals<br/>action: request<br/>filePath only]
    P1_Approve --> P1_Status[approvals<br/>action: status<br/>poll status]
    P1_Status --> P1_Check{Status?}
    P1_Check -->|needs-revision| P1_Update[Update document using user comments as guidance]
    P1_Update --> P1_Create
    P1_Check -->|approved| P1_Clean[approvals<br/>action: delete]
    P1_Clean -->|failed| P1_Status

    %% Phase 2: Discovery (optional, after Requirements)
    P1_Clean -->|success| DiscoveryChoice{Run Discovery<br/>Phase 2?}
    DiscoveryChoice -->|Skip| P3_Template
    DiscoveryChoice -->|Yes| CheckSteering{Steering docs exist?}
    CheckSteering -->|Yes| P2_Load[Read steering docs]
    CheckSteering -->|No| P2_Template
    P2_Load --> P2_Template[Check project template overrides,<br/>then global template:<br/>discovery-template.md]
    P2_Template --> P2_Research[Codebase analysis +<br/>Context7 + web search]
    P2_Research --> P2_Create[Create file:<br/>${wr}/specs/{name}/<br/>discovery.md]
    P2_Create --> P2_Approve[approvals<br/>action: request<br/>filePath only]
    P2_Approve --> P2_Status[approvals<br/>action: status<br/>poll status]
    P2_Status --> P2_Check{Status?}
    P2_Check -->|needs-revision| P2_Update[Update document using user comments as guidance]
    P2_Update --> P2_Create
    P2_Check -->|approved| P2_Clean[approvals<br/>action: delete]
    P2_Clean -->|failed| P2_Status

    %% Phase 3: Design
    P2_Clean -->|success| P3_Template[Check project template overrides,<br/>then global template:<br/>design-template.md]
    P3_Template --> P3_Analyze[Analyze codebase patterns]
    P3_Analyze --> P3_Create[Create file:<br/>${wr}/specs/{name}/<br/>design.md]
    P3_Create --> P3_Approve[approvals<br/>action: request<br/>filePath only]
    P3_Approve --> P3_Status[approvals<br/>action: status<br/>poll status]
    P3_Status --> P3_Check{Status?}
    P3_Check -->|needs-revision| P3_Update[Update document using user comments as guidance]
    P3_Update --> P3_Create
    P3_Check -->|approved| P3_Clean[approvals<br/>action: delete]
    P3_Clean -->|failed| P3_Status

    %% Phase 4: Tasks
    P3_Clean -->|success| P4_Template[Check project template overrides,<br/>then global template:<br/>tasks-template.md]
    P4_Template --> P4_Break[Convert design to tasks]
    P4_Break --> P4_Create[Create file:<br/>${wr}/specs/{name}/<br/>tasks.md]
    P4_Create --> P4_Approve[approvals<br/>action: request<br/>filePath only]
    P4_Approve --> P4_Status[approvals<br/>action: status<br/>poll status]
    P4_Status --> P4_Check{Status?}
    P4_Check -->|needs-revision| P4_Update[Update document using user comments as guidance]
    P4_Update --> P4_Create
    P4_Check -->|approved| P4_Clean[approvals<br/>action: delete]
    P4_Clean -->|failed| P4_Status

    %% Phase 4.5: Visual Prototype Gate (conditional)
    P4_Clean -->|success| P45_Check{design.md declares<br/>UI changes?}
    P45_Check -->|No| IRG_Run
    P45_Check -->|Yes| P45_Mockup[Tasks 0.1-0.3:<br/>Stitch mockup +<br/>Playground prototype]
    P45_Mockup --> P45_Approve{User approves<br/>visual design?}
    P45_Approve -->|No| P45_Revise[Revise mockup/<br/>prototype]
    P45_Revise --> P45_Mockup
    P45_Approve -->|Yes| P45_Update[Update design.md<br/>Prototype Artifacts]
    P45_Update --> IRG_Run

    %% Phase 4.9: Implementation Readiness Gate
    IRG_Run[Cross-validate:<br/>requirements + design + tasks<br/>Save readiness-report.md] --> IRG_Approve[approvals<br/>action: request<br/>readiness-report.md]
    IRG_Approve --> IRG_Status[approvals<br/>action: status<br/>poll status]
    IRG_Status --> IRG_Result{Dashboard<br/>decision?}
    IRG_Result -->|approved| IRG_Clean[approvals<br/>action: delete]
    IRG_Clean -->|success| P5_Ready[Spec complete.<br/>Ready to implement?]
    IRG_Clean -->|failed| IRG_Status
    IRG_Result -->|concerns| IRG_Log[Log concerns to<br/>tasks.md then<br/>delete approval]
    IRG_Log --> P5_Ready
    IRG_Result -->|rejected| IRG_Fix[Fix spec documents<br/>to resolve<br/>misalignment]
    IRG_Fix --> IRG_Run

    %% Phase 5: Implementation
    P5_Ready -->|Yes| P5_Status[spec-status]
    P5_Status --> P5_Task[Edit tasks.md:<br/>Change [ ] to [-]<br/>for in-progress]
    P5_Task --> P5_Code[Dispatch subagent:<br/>Implement code]
    P5_Code --> P5_SpecReview{Spec compliance<br/>review?}
    P5_SpecReview -->|pass| P5_QualityReview{Code quality<br/>review?}
    P5_SpecReview -->|fail| P5_Code
    P5_QualityReview -->|pass| P5_Log[log-implementation<br/>Record implementation<br/>details]
    P5_QualityReview -->|fail| P5_Code
    P5_Log --> P5_Complete[Edit tasks.md:<br/>Change [-] to [x]<br/>for completed]
    P5_Complete --> P5_More{More tasks?}
    P5_More -->|Yes| P5_Task
    P5_More -->|No| P6_Start[Phase 6.1:<br/>Automated E2E]
    P6_Start --> P6_E2E[/bb-test:<br/>Browserbase/Stagehand E2E<br/>against PR preview URL]
    P6_E2E --> P6_Check{Tests pass?}
    P6_Check -->|fail| P6_Fix[Fix failing tests<br/>before QA]
    P6_Fix --> P6_E2E
    P6_Check -->|pass| P6_QA[Phase 6.2:<br/>User QA Session]
    P6_QA --> P6_QA_Present[Present preview URL<br/>Wait for user]
    P6_QA_Present --> P6_QA_Check{User reports<br/>issues?}
    P6_QA_Check -->|Yes| P6_QA_Fix[Fix issue<br/>commit + push<br/>wait for rebuild]
    P6_QA_Fix --> P6_QA_Present
    P6_QA_Check -->|QA complete| P6_Final[Phase 6.3:<br/>Docs + PR Finalization]
    P6_Final --> P6_Docs[/vault-update:<br/>Update DocVault pages<br/>on final post-QA code]
    P6_Docs --> P6_Issues[Close linked issues]
    P6_Issues --> P6_Ready[Mark PR<br/>ready for review]
    P6_Ready --> Done([Spec Complete:<br/>Hand off to /pr-resolve])

    style Start fill:#e1f5e1
    style Done fill:#e1f5e1
    style P6_Start fill:#e3f2fd
    style P6_Check fill:#fff4e6
    style P6_QA fill:#e8f5e9
    style P6_QA_Check fill:#fff4e6
    style P6_Final fill:#e3f2fd
    style P1_Check fill:#ffe6e6
    style P2_Check fill:#ffe6e6
    style P3_Check fill:#ffe6e6
    style P4_Check fill:#ffe6e6
    style P5_SpecReview fill:#ffe6e6
    style P5_QualityReview fill:#ffe6e6
    style DiscoveryChoice fill:#fff4e6
    style CheckSteering fill:#fff4e6
    style P5_More fill:#fff4e6
    style P45_Check fill:#fff4e6
    style P45_Approve fill:#ffe6e6
    style P45_Mockup fill:#e8f5e9
    style P45_Update fill:#e3f2fd
    style IRG_Run fill:#f3e5f5
    style IRG_Approve fill:#e3f2fd
    style IRG_Result fill:#ffe6e6
    style IRG_Clean fill:#e3f2fd
    style IRG_Log fill:#fff4e6
    style IRG_Fix fill:#ffe6e6
    style P5_Log fill:#e3f2fd
\`\`\`

## Spec Workflow

### Phase 1: Requirements
**Purpose**: Define what to build based on user needs. Requirements come first — they establish the problem statement that Discovery researches.

**File Operations**:
- Read steering docs: \`${wr}/steering/*.md\` (if they exist)
- Check for project override: \`${wr}/templates/requirements-template.md\`
- Read global template: \`${wr}/templates/requirements-template.md\` (if no custom template)
- Create document: \`${wr}/specs/{issue-id}-{kebab-title}/requirements.md\`

**Tools**:
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Check if \`${wr}/steering/\` exists (if yes, read product.md, tech.md, structure.md)
2. Check for project template override at \`${wr}/templates/requirements-template.md\`
3. If no project override, the global template is used automatically from \`${wr}/templates/requirements-template.md\`
4. Research market/user expectations (if web search available, current year: ${currentYear})
5. **Content boundary**: Requirements define WHAT (user stories, acceptance criteria, measurable NFRs). Do NOT include implementation details — API designs, component architecture, function signatures, code patterns belong in Phase 3 Design.
6. Generate requirements as user stories with EARS criteria
6. Create \`requirements.md\` at \`${wr}/specs/{issue-id}-{kebab-title}/requirements.md\`
7. Request approval using approvals tool with action:'request' (filePath only, never content)
8. Poll status using approvals with action:'status' until approved/needs-revision (NEVER accept verbal approval)
9. If needs-revision: update document using comments, create NEW approval, do NOT proceed
10. Once approved: use approvals with action:'delete' (must succeed) before proceeding
11. If delete fails: STOP - return to polling

### Phase 2: Discovery
**Purpose**: Research codebase, frameworks, and competing approaches AFTER knowing what to build. Optional — specs can skip this phase. Discovery is informed by the approved requirements — it researches how to solve the problem that requirements defined.

**File Operations**:
- Read approved requirements: \`${wr}/specs/{issue-id}-{kebab-title}/requirements.md\`
- Read steering docs: \`${wr}/steering/*.md\` (if they exist)
- Check for project override: \`${wr}/templates/discovery-template.md\`
- Read global template: \`${wr}/templates/discovery-template.md\` (if no custom template)
- Create document: \`${wr}/specs/{issue-id}-{kebab-title}/discovery.md\`

**Tools**:
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Read approved \`requirements.md\` — use it as the problem statement that guides research
2. Check if \`${wr}/steering/\` exists (if yes, read product.md, tech.md, structure.md for project context)
3. Check for project template override at \`${wr}/templates/discovery-template.md\`
4. If no project override, the global template is used automatically from \`${wr}/templates/discovery-template.md\`
5. Run codebase analysis (CGC, claude-context, Grep/Glob) to identify affected files and existing patterns
6. Research frameworks and libraries via Context7 for current best practices
7. Research competing approaches via web search (if available, current year: ${currentYear})
8. Propose 2-3 competing approaches with pros/cons/effort/risk
9. Create \`discovery.md\` at \`${wr}/specs/{issue-id}-{kebab-title}/discovery.md\`
10. Request approval using approvals tool with action:'request' (filePath only, never content)
11. Poll status using approvals with action:'status' until approved/needs-revision (NEVER accept verbal approval)
12. If needs-revision: update document using comments, create NEW approval, do NOT proceed
13. Once approved: use approvals with action:'delete' (must succeed) before proceeding
14. If delete fails: STOP - return to polling

### Phase 3: Design
**Purpose**: Create technical design addressing all requirements.

**File Operations**:
- Check for project override: \`${wr}/templates/design-template.md\`
- Read global template: \`${wr}/templates/design-template.md\` (if no custom template)
- Create document: \`${wr}/specs/{issue-id}-{kebab-title}/design.md\`

**Tools**:
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Check for project template override at \`${wr}/templates/design-template.md\`
2. If no project override, the global template is used automatically from \`${wr}/templates/design-template.md\`
3. Analyze codebase for patterns to reuse
4. Research technology choices (if web search available, current year: ${currentYear})
5. Generate design with all template sections6. Create \`design.md\` at \`${wr}/specs/{issue-id}-{kebab-title}/design.md\`
7. Request approval using approvals tool with action:'request'
8. Poll status using approvals with action:'status' until approved/needs-revision
9. If needs-revision: update document using comments, create NEW approval, do NOT proceed
10. Once approved: use approvals with action:'delete' (must succeed) before proceeding
11. If delete fails: STOP - return to polling

### Phase 4: Tasks
**Purpose**: Break design into atomic implementation tasks.

**File Operations**:
- Check for project override: \`${wr}/templates/tasks-template.md\`
- Read global template: \`${wr}/templates/tasks-template.md\` (if no custom template)
- Create document: \`${wr}/specs/{issue-id}-{kebab-title}/tasks.md\`

**Tools**:
- approvals: Manage approval workflow (actions: request, status, delete)

**Process**:
1. Check for project template override at \`${wr}/templates/tasks-template.md\`
2. If no project override, the global template is used automatically from \`${wr}/templates/tasks-template.md\`
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
8. Create \`tasks.md\` at \`${wr}/specs/{issue-id}-{kebab-title}/tasks.md\`
7. Request approval using approvals tool with action:'request'
8. Poll status using approvals with action:'status' until approved/needs-revision
9. If needs-revision: update document using comments, create NEW approval, do NOT proceed
10. Once approved: use approvals with action:'delete' (must succeed) before proceeding
11. If delete fails: STOP - return to polling
12. After successful cleanup: "Spec complete. Ready to implement?"

### Phase 4.5: Visual Prototype Gate (conditional)
**Purpose**: Ensure UI changes have visual approval before any implementation code is written.

**Trigger**: This phase fires automatically if design.md contains \`Has UI Changes: Yes\` AND \`Prototype Required: Yes\` in the UI Impact Assessment section.

**Skip condition**: If \`Has UI Changes: No\` or \`Prototype Required: No\`, skip to Phase 4.9.

**Process**:
1. Read design.md and check the \`UI Impact Assessment\` section
2. If UI changes are declared with prototype required:
   - Execute tasks 0.1–0.3 from tasks.md (these are the prototype gate tasks)
   - Task 0.1: Create visual mockup via \`ui-mockup\` skill (Stitch) or \`frontend-design\` skill
   - Task 0.2: Build interactive prototype via \`playground\` skill — **save to \`${wr}/specs/{spec-name}/artifacts/playground.html\`**
   - Task 0.3: Present to user, collect explicit visual approval
3. If a reference HTML/mockup file path is listed in design.md, the prototype MUST use it as the baseline — do not ignore provided prototypes
4. **Save all visual artifacts** (playground HTML, mockup screenshots, Stitch exports) to the spec's \`artifacts/\` folder
5. Update design.md \`Prototype Artifacts\` section with paths pointing to the \`artifacts/\` folder
6. **BLOCKING**: No task tagged \`ui:true\` may begin until visual approval is recorded
7. Proceed to Phase 4.9

**CRITICAL — Prototype is Source of Truth**: The approved prototype in the \`artifacts/\` folder defines the visual design for implementation. Implementers MUST source their DOM structure, class names, spacing, and layout from the prototype — not from their own interpretation of the text requirements or earlier spec documents. The spec compliance reviewer will compare implementation against the prototype file. Ignoring an approved prototype is a spec compliance failure.

### Phase 4.9: Implementation Readiness Gate
**Purpose**: Cross-validate all spec documents for internal consistency before any code is written.

**Trigger**: This phase fires automatically after Phase 4 approval (and Phase 4.5 if applicable). It runs on EVERY spec — it is not conditional.

**File Operations**:
- Read specs: \`${wr}/specs/{issue-id}-{kebab-title}/requirements.md\`, \`design.md\`, \`tasks.md\`
- Create report: \`${wr}/specs/{issue-id}-{kebab-title}/readiness-report.md\`

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
   - **Test Design Coverage**: At least one task in tasks.md covers test authoring for new behavior (matching task title/description patterns: "test", "TDD", "verify", "write tests"). If no test task found → FAIL.
   - **Release Hygiene**: Check \`${wr}/project-conventions.json\` (if exists):
     - If version lock detected: verify a task covers version bump. Missing → FAIL.
     - If changelog detected: verify a task covers changelog entry. Missing → FAIL.
     - Verify a task covers DocVault documentation update. Missing → FAIL.
     - If no conventions file exists: note "No project conventions detected — consider running convention detection" as an advisory finding (not a failure).
3. Save the report as \`readiness-report.md\` in the spec folder using the output format below.
4. Request dashboard approval using approvals tool with action:'request', filePath pointing to readiness-report.md
5. Poll status using approvals with action:'status' until responded — the user has THREE options on the dashboard:
   - **Approve (PASS)**: All checks satisfied. Proceed to Phase 5.
   - **Concerns**: Minor gaps acknowledged. Agent proceeds to Phase 5 but MUST append a \`## Readiness Concerns\` section to tasks.md with the user's noted concerns.
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

## Test Design Coverage
- Task N: "[test task title]" ✓ | [NO TEST TASK FOUND] ✗

## Release Hygiene
- Version bump task: ✓ / ✗ / N/A (no version lock)
- Changelog task: ✓ / ✗ / N/A (no changelog)
- DocVault task: ✓ / ✗

## Agent Recommendation
{Brief explanation of the recommendation — why PASS/CONCERNS/FAIL}
\`\`\`

**CRITICAL**: This gate catches the #1 cause of spec implementation failures — tasks that drift from requirements during the design-to-tasks translation. Running this check takes 30 seconds and prevents hours of rework.
**CRITICAL**: The readiness report MUST be submitted to the dashboard for human review. Verbal approval is NOT accepted. The agent's recommendation (PASS/CONCERNS/FAIL) is advisory — the human makes the final call via the dashboard.

### Phase 5: Implementation
**Purpose**: Execute tasks systematically.

**File Operations**:
- Read specs: \`${wr}/specs/{issue-id}-{kebab-title}/*.md\` (if returning to work)
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
     - If prototype gate is incomplete, STOP — complete Phase 4.5 first
     - **MANDATORY**: Include the playground file path (e.g., \`${wr}/specs/{spec-name}/artifacts/playground.html\`) in the subagent prompt so the implementer has the approved visual reference
     - Tell the implementer explicitly: "Source your visual design from the prototype file. Do NOT re-read earlier spec documents and reinvent the design. The prototype IS the approved design."
     - The spec compliance reviewer (Stage 1) will compare implementation against the prototype — visual deviations are a FAIL
   - Edit tasks.md: Change \`[ ]\` to \`[-]\` for the task you're starting
   - **CRITICAL: BEFORE implementing, search existing implementation logs**:
     - Implementation logs are in: \`${wr}/specs/{issue-id}-{kebab-title}/Implementation Logs/\`
     - **Option 1: Use grep for fast searches**:
       - \`grep -r "api\|endpoint" ${wr}/specs/{issue-id}-{kebab-title}/Implementation Logs/\` - Find API endpoints
       - \`grep -r "component" ${wr}/specs/{issue-id}-{kebab-title}/Implementation Logs/\` - Find UI components
       - \`grep -r "function" ${wr}/specs/{issue-id}-{kebab-title}/Implementation Logs/\` - Find utility functions
       - \`grep -r "integration" ${wr}/specs/{issue-id}-{kebab-title}/Implementation Logs/\` - Find integration patterns
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

**Implementer template**: See \`${wr}/templates/implementer-prompt-template.md\` for the subagent dispatch template. Paste the full task text into the subagent prompt — don't make the subagent read the plan file.

#### Two-Stage Review (after each task, BEFORE marking [x])

After the implementer subagent reports back, run two review stages before logging and marking complete:

**Stage 1 — Spec Compliance Review:**
Dispatch a reviewer subagent to verify the implementer built what was requested — nothing more, nothing less.
- Compare actual code to task requirements line by line
- Check for missing requirements, extra/unneeded work, misunderstandings
- ✅ Pass = proceed to Stage 2
- ❌ Fail = implementer fixes issues → dispatch reviewer again
- Template: \`${wr}/templates/spec-reviewer-template.md\`

**Stage 2 — Code Quality Review:**
Only dispatch AFTER Stage 1 passes. Verify the code is well-built and production-ready.
- Check: architecture, error handling, testing, security, performance
- Categorize issues: Critical (must fix) / Important (should fix) / Minor (nice to have)
- ✅ Approved = proceed to log-implementation → mark [x]
- Issues found = implementer fixes → dispatch reviewer again
- Template: \`${wr}/templates/code-quality-reviewer-template.md\`

**Review loop:** If either reviewer finds issues, the implementer subagent fixes them, then the reviewer re-reviews. Repeat until approved. Never skip re-review — "it should be fine now" is not verification.

#### Context Budget

- Session budget: ~800k tokens (~80-100 task dispatches with reviews on 1M context models)
- After 60+ agent dispatches or 70% context usage: suggest handoff to a fresh session
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

### Phase 6: Post-Implementation (E2E + QA + Docs + PR Finalization)
**Purpose**: Verify the feature, QA with the user, update documentation on final code, and finalize the PR.

Phase 6 has three stages. The spec is NOT complete until all three are done.

#### Phase 6.1: Automated Testing

**Purpose**: Run the project's test suite to verify the implementation.

**Process**:
1. Check \`${wr}/project-conventions.json\` for the project's test command and framework.
2. If conventions exist and specify a test command: run that command (e.g., \`npm test\`, \`npx vitest\`, \`pytest\`).
3. If no conventions exist: check \`package.json\` for a \`test\` script. If found, run \`npm test\`. If not found, ask the user for the test command.
4. If the project uses Browserbase/Stagehand (\`conventions.testing.hasBrowserbase\` is true):
   - Get the PR preview URL from the draft PR's deployment checks
   - Run \`/bb-test\` with the preview URL for E2E browser testing
   - This is IN ADDITION to the unit/integration tests from step 2
5. If tests fail: fix the failures before proceeding to QA. Do not skip to 5.2 with known test failures.

#### Phase 6.2: User QA Session

**Purpose**: The user manually tests the feature on the preview deployment. This is where spec gaps, visual polish issues, and edge cases get caught. Automated tests passing does NOT mean the feature is done — user QA is the final quality gate before the PR leaves draft.

**CRITICAL behavioral rules for the agent during QA:**
- **Present the preview URL and wait.** Do not suggest merging, do not suggest the work is done.
- **The agent is in service mode during QA** — the user drives, the agent fixes. This is collaborative, not adversarial.
- **Do not push back on QA findings.** If the user reports an issue, fix it. Do not argue that it "works as specced" or "passes tests." The user is the final arbiter of quality.
- **After each fix:** commit, push, wait for the preview to rebuild, then tell the user it's ready to re-check.
- **Do not ask "anything else?" after every fix** — just report what you fixed and wait. The user will tell you when they're done.
- **Exit condition:** The user explicitly says QA is complete (e.g., "QA complete", "looks good", "ready to go"). No other signal ends this phase.
- **For trivial non-UI patches** (config, typo, docs-only): the user may say "skip QA" to proceed directly to 5.3.

**Process**:
1. Present the preview URL: "Preview is live at {URL}. Ready for your QA pass — take your time, I'll fix anything you find."
2. Wait for user input. Do not proceed unprompted.
3. For each issue the user reports:
   a. Acknowledge the issue
   b. Fix it in code
   c. Commit and push
   d. Wait for preview rebuild (check Cloudflare Pages deploy status)
   e. Report: "Fixed — {brief description}. Preview should rebuild in ~1 min."
4. Repeat until the user signals QA is complete.
5. Only then proceed to Phase 6.3.

#### Phase 6.3: Docs + PR Finalization

**Purpose**: Update documentation on final post-QA code, close linked issues, mark PR ready for review, and hand off to the \`/pr-resolve\` workflow.

**Tools**:
- Skill \`vault-update\`: Updates DocVault documentation pages affected by the spec's changed files. DocVault is the central Obsidian vault at \`/Volumes/DATA/GitHub/DocVault/\` — it is the single source of truth for project and infrastructure documentation.

**Why docs run here (after QA, not before):** QA fixes change code that documentation describes. Running docs before QA means updates become stale as soon as you fix the first QA bug. Running docs after QA means it captures the final state of the code.

**Process**:
1. Run \`/vault-update\` — updates DocVault pages affected by the spec's changed files. Commit DocVault changes (DocVault commits go direct to main, not to the feature branch).
2. **Close all linked issues:**
   - **Vault**: Mark each linked vault issue as Done (update status in the issue markdown file)
   - **GitHub**: Run \`gh issue close <number>\` for each linked GitHub issue (if scope: user-facing)
   - Verify closure: \`gh issue view <number> --json state\` should show "CLOSED"
   - A spec with open issues is NOT complete — this is the most commonly forgotten step
2. **Mark the PR ready for review:**
   \`\`\`bash
   gh pr ready <PR_NUMBER>
   \`\`\`
3. **Spec is complete.** The finish line is the PR being marked ready for review. What happens next (\`/pr-resolve\`, Copilot review, merge to dev) is a separate workflow — typically in a new session.

## Workflow Rules

- Create documents directly at specified file paths
- Templates are resolved automatically: project override (${wr}/templates/) → global → bundled fallback
- Follow exact template structures
- Get explicit user approval between phases (using approvals tool with action:'request')
- Complete phases in sequence (no skipping)
- Phase 6 has three stages: 6.1 (automated E2E), 6.2 (user QA session), 6.3 (docs + PR finalization) — all three are mandatory. Docs run AFTER QA so documentation captures final post-QA code
- Phase 6.1 runs the project's test suite as detected in project-conventions.json. Browserbase/Stagehand is used additionally when the project has browser-based E2E tests.
- CRITICAL: During Phase 6.2 (User QA), the agent MUST NOT suggest merging, declare the work done, or push back on findings. The user drives QA, the agent fixes. QA ends ONLY when the user says so
- CRITICAL: The spec finish line is marking the PR ready for review (Phase 6.3), NOT passing automated tests. Automated tests passing = ready for QA, not ready to merge
- One spec at a time
- Spec names use issue prefix: {ISSUE-ID}-{kebab-title}
- Approval requests: provide filePath only, never content
- BLOCKING: Never proceed if approval delete fails
- CRITICAL: Must have approved status AND successful cleanup before next phase
- CRITICAL: Every task marked [x] MUST have a corresponding implementation log — call log-implementation BEFORE changing [-] to [x]
- CRITICAL: Every completed spec MUST have all linked issues (vault and GitHub) closed — a spec with open issues is NOT done
- CRITICAL: Specs with UI changes MUST complete Phase 4.5 (visual prototype gate) before any UI implementation task begins
- CRITICAL: If design.md references a prototype HTML file, implementers MUST source their visual design from it — ignoring a provided prototype is a spec compliance failure
- CRITICAL: All visual artifacts (playground HTML, screenshots, mockups) MUST be saved to the spec's \`artifacts/\` folder — not to project root or playground/ directories. The artifacts/ folder is the single source of visual truth for the spec
- CRITICAL: Phase 4.9 (Implementation Readiness Gate) fires on EVERY spec before Phase 5 — generates readiness-report.md, submits to dashboard for review. Three dashboard actions: Approve (proceed), Concerns (proceed with logged risks), Reject (fix and re-run). Verbal approval NOT accepted.
- CRITICAL: Verbal approval is NEVER accepted - dashboard or VS Code extension only
- NEVER proceed on user saying "approved" - check system status only
- Steering docs are optional - only create when explicitly requested

## File Structure

All specflow artifacts live in DocVault. The project root only has \`.specflow/config.json\`.

\`\`\`
${wr}/                               # DocVault/specflow/{project}/ (resolved via config.json)
├── templates/                       # Project-level overrides ONLY (not copies of globals)
├── specs/
│   └── {ISSUE-ID}-{kebab-title}/
│       ├── requirements.md
│       ├── design.md
│       ├── tasks.md
│       ├── readiness-report.md      # Phase 4.9
│       ├── artifacts/               # Visual source of truth for UI specs
│       │   ├── playground.html
│       │   └── *.png
│       └── Implementation Logs/
│           ├── task-1_timestamp_id.md
│           └── ...
├── steering/
│   ├── product.md
│   ├── tech.md
│   └── structure.md
├── approvals/                       # Approval records
└── archive/specs/                   # Archived specs
\`\`\``;
}
