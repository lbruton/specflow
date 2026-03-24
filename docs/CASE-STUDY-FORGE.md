# Case Study: Forge Build Session (2026-03-23)

## 1. Executive Summary

On March 23, 2026, a single development session took an empty Git repository to a deployed production web application in approximately three hours. The project -- **Forge** -- is a network configuration template generator built to replace Cisco DNAC's CLI template simulation workflow, which the team had been using as a glorified mail-merge tool without ever deploying configs through DNAC itself.

The session executed the full spec-workflow lifecycle twice (V1 and V1.1), dispatched roughly 30 parallel subagent tasks across two specs, produced 23 implementation tasks, 52 passing tests, and approximately 15,000 lines of production code. The final application was containerized and deployed via Portainer GitOps with an Nginx reverse proxy.

This build session serves as an end-to-end validation of the spec-workflow system -- from freeform `/chat` exploration through issue creation, spec authorship with dashboard approvals, parallel subagent dispatch, real-user QA, and production deployment.

---

## 2. Session Timeline

### Phase 0: Concept Exploration (~20 min)

The session began with `/chat` -- freeform conversation with no commitment. The user described the problem: their team uses Cisco DNAC solely for its CLI template simulation feature, pasting configs and using `$variable` substitution to generate device-specific output. They wanted a purpose-built tool that did exactly this, without the overhead of a full DNAC deployment.

Key decisions made during chat:
- **React + Vite + Tailwind** over vanilla JS (component model maps well to the UI)
- **Zustand** for state management (lightweight, built-in localStorage middleware)
- **Web Crypto API** for encryption (browser-native, zero dependencies)
- **View > Vendor > Model > Variant** hierarchy (inspired by Semaphore's project structure)
- **DNAC-compatible `$variable` syntax** (zero learning curve for the team)
- **No backend** -- fully static, browser-only, localStorage persistence

### Project Scaffolding (~15 min)

Once the concept solidified, the infrastructure was established:
- GitHub repository created
- `CLAUDE.md` authored with project context and steering docs
- DocVault project pages created
- Spec-workflow registered for the Forge project
- Branding guide established (dark theme, slate backgrounds, amber accent, Inter + JetBrains Mono)

### FORGE-1 Spec: Requirements, Design, Tasks (~15 min)

The first issue (FORGE-1) was created with detailed acceptance criteria covering all 11 requirements. The spec-workflow then drove three phases with dashboard approvals at each gate:

1. **Requirements** (Phase 1) -- 11 formal requirements with user stories and acceptance criteria, covering navigation hierarchy, template paste import, variable management, live preview, section-based output, interface builder, multi-format support, encrypted export, browser storage, seed data, and dark theme branding.

2. **Design** (Phase 2) -- Architecture decisions, data models, component hierarchy, engine specifications. Key design choices: custom syntax highlighter (not Monaco/CodeMirror since the preview is read-only), `.stvault` encrypted export format with AES-256-GCM and PBKDF2 key derivation, and a File Touch Map identifying all files to be created.

3. **Tasks** (Phase 3) -- 16 implementation tasks with a UI Prototype Gate (Tasks 0.1-0.3) blocking all UI work. Each task included a detailed agent prompt with role, task description, restrictions, and success criteria.

4. **Readiness Gate** (Phase 3.9) -- Cross-validation report confirming all requirements traced to tasks, no file conflicts in the touch map, and the prototype gate was properly sequenced.

### FORGE-1 Implementation: 16 Tasks in 3 Parallel Batches (~40 min)

Implementation used the parallel subagent dispatch pattern, with tasks grouped by file independence:

**Batch 1 -- Scaffolding + Mockup (2 agents)**
- Task 1: Vite + React + Tailwind + TypeScript project scaffolding, type definitions
- Task 0.1: Visual mockup via `frontend-design` skill

**Batch 2 -- Engines + Prototype (5 agents, after scaffolding complete)**
- Task 2: Storage service + Zustand store with localStorage persistence
- Task 3: Template parser engine (variable detection, section splitting, type inference)
- Task 4: Substitution engine + syntax highlighter (CLI, XML, JSON, YAML)
- Task 5: Vault engine (AES-256-GCM encryption/decryption)
- Task 0.2: Interactive playground prototype (single-file HTML)

**Prototype Gate (Phase 3.5)**
After Batch 2, the interactive prototype was presented for visual approval. The user reviewed the playground HTML file covering sidebar navigation, config preview, variable forms, section tabs, and the terminal-style output area. Approval was granted before any UI component code was written.

**Batch 3 -- UI Components (6 agents, after prototype gate approval)**
- Task 6: App shell + sidebar navigation (tree view, CRUD modals)
- Task 7: Template editor + paste flow (auto-detect variables and sections)
- Task 8: Config generator + preview (variable form, live substitution, section tabs, copy)
- Task 9: Interface builder (port count selector, template chooser)
- Task 10: Vault import/export UI (encrypt/decrypt modal with conflict resolution)
- Task 11: Welcome screen + seed template ("The forge is cold. Add a template to light it.")

**Integration (2 agents, after UI batch complete)**
- Task 12: Docker container (multi-stage build, nginx:alpine, SPA routing, security headers)
- Task 13: Integration testing + polish (end-to-end flow verification, all 11 requirements)

The V1 build passed on first compilation with no integration fixes required -- a direct result of the File Touch Map analysis ensuring zero file overlap between parallel agents.

### V1 QA: User Testing (~15 min)

The user tested V1 with real production templates. This surfaced issues that unit tests could not:

- **Tab overflow** -- too many section tabs crowded the UI. Fixed with tab wrapping.
- **Seed data exposure** -- the seed template contained a config with real IP addresses and credential patterns. Required immediate removal and replacement with sanitized placeholder data.

### FORGE-2+3 Combined Spec (~10 min)

Two issues created during QA were combined into a single spec:
- **FORGE-2**: Section boundary format improvements (START/END markers, duplicate name handling, editor polish, sidebar sticky button, PWA support)
- **FORGE-3**: Generated config history (save outputs with metadata, audit trail, sidebar sub-folders)

The spec cycle was fast because the issues were already detailed with acceptance criteria from the QA session. Requirements, design, and tasks were authored and approved through the dashboard in approximately 10 minutes.

### FORGE-2+3 Implementation: 7 Tasks in 2 Parallel Batches (~25 min)

**Group A (3 agents)**
- Task 1: Parser enhancements (START/END markers, duplicate naming, `cleanUpSections()`)
- Task 2: Types + store extensions (GeneratedConfig data model, CRUD actions, vault integration)
- Task 6: PWA support (favicon, web manifest, theme color)

**Group B (3 agents, after Group A types landed)**
- Task 3: Template editor polish (panel reorder, guidance text, Clean Up button, variable highlighting)
- Task 4: Sidebar enhancements (Templates/Generated sub-folders, sticky Add View button)
- Task 5: Generated config save modal + viewer (SaveGeneratedModal, GeneratedConfigViewer)

**Integration (1 agent)**
- Task 7: Build verification, test suite, end-to-end validation

### Bug Fixes (~20 min)

Real-world testing after V1.1 deployment uncovered several integration bugs:

1. **Duplicate sections from `cleanUpSections`** -- The function added START/END markers alongside legacy dividers instead of replacing them. Re-parsing the cleaned text produced doubled sections. Required understanding the full round-trip: transform, re-parse, verify.

2. **Variable highlighting overlay** -- Initial implementation placed the overlay behind the textarea with a semi-transparent background, making it invisible. Fixed by layering the overlay above the textarea with `pointer-events: none` and matching scroll position.

3. **Save modal input reset** -- `useEffect` dependency array included `variableValues`, causing the name input field to reset on every keystroke as the effect re-ran. Fixed with ref-based value capture instead of state dependency.

4. **Section content duplication** -- START/END markers were being included in section content during re-parsing, creating progressively longer sections on each save cycle. Fixed by stripping marker lines during section content extraction.

5. **MDX compatibility in task prompts** -- Curly braces, angle brackets, and HTML comments in spec-workflow task prompt text broke the dashboard's MDX rendering. Required multiple iterations to escape or replace code syntax with plain English descriptions.

### Deployment (~5 min)

- Docker image built (multi-stage: node:20-alpine build, nginx:alpine serve)
- Stack deployed via Portainer GitOps webhook (auto-redeploy on push to main)
- Reverse proxy configured for HTTPS
- Remote access via Cloudflare tunnel

### Documentation + Retro (~10 min)

- Two additional issues created capturing future backlog items
- Session retro conducted capturing lessons learned

---

## 3. Spec Workflow Lifecycle in Action

The Forge build session exercised every phase of the spec-workflow system:

### /chat (Phase 0) -- Freeform Exploration

No commitment, no issue, no spec. Pure conversation exploring the problem space. This is where "should we use React or vanilla JS?" and "what does the navigation hierarchy look like?" were resolved. The chat phase prevented premature commitment -- several ideas were explored and discarded before the concept stabilized.

### Issue Creation

FORGE-1 was created with structured frontmatter, detailed description, and acceptance criteria. The issue served as the contract between the chat phase and the spec phase.

### /spec (Phases 1-4) -- Requirements, Design, Tasks, Implementation

Each phase produced a formal document in `.spec-workflow/specs/`:

- **requirements.md** -- 11 requirements with WHEN/THEN acceptance criteria, open questions (all resolved before approval), and non-functional requirements (performance, security, reliability, usability)
- **design.md** -- Architecture decisions, data models, engine specifications, component hierarchy, File Touch Map
- **tasks.md** -- 16 tasks with File Touch Map, prototype gate, and detailed agent prompts

### Dashboard Approvals

Every phase transition required explicit approval through the spec-workflow dashboard:
- Requirements approved before design could begin
- Design approved before tasks could be written
- Tasks approved before implementation could start
- Readiness gate (Phase 3.9) cross-validated requirements-to-tasks traceability

This created 8 total approval gates across both specs (4 per spec).

### Prototype Gate (Phase 3.5)

A critical innovation: before any UI component code was written, the prototype gate required:
1. A visual mockup
2. An interactive playground (single-file HTML demonstrating all interactions)
3. Explicit user approval of the visual design

This caught branding inconsistencies and layout issues before six parallel agents started writing React components. Without the gate, those issues would have required expensive cross-agent coordination after the fact.

### Readiness Gate (Phase 3.9)

A cross-validation step before implementation dispatch:
- Every requirement traced to at least one task
- File Touch Map showed no conflicts between parallel tasks
- Prototype gate was confirmed complete
- All blocking open questions resolved

### Subagent Dispatch

Implementation used the parallel subagent dispatch pattern:
1. Analyze File Touch Map for independence
2. Group tasks into batches with zero file overlap
3. Dispatch each batch simultaneously
4. Wait for batch completion before starting dependent batches
5. Integration task at the end to wire components and verify

### Implementation Logging

Every completed task was logged via the `log-implementation` tool before being marked complete. This created an artifact trail: which files were created/modified, what decisions were made, and any deviations from the task prompt.

### Post-Implementation

Bug fixes from real-user QA were handled outside the spec flow -- direct fixes with commit messages referencing the original issues. This is appropriate for the bug fast path: no spec needed for fixes discovered during the same session.

---

## 4. Parallel Subagent Dispatch -- What Worked

The parallel dispatch pattern was the single biggest force multiplier in this session. Here is what made it effective:

### File Touch Map Analysis

The tasks document included an explicit File Touch Map showing every file each task would create or modify. This made independence analysis trivial -- if two tasks touched no overlapping files, they could run simultaneously.

For FORGE-1, the engine tasks (parser, substitution, vault, storage) each created their own isolated files under `src/lib/` and `src/__tests__/`. No overlap. The UI tasks each owned their component files under `src/components/`. No overlap. Only the integration task touched files from other tasks.

### Batched Dispatch with Dependency Gates

Tasks were not all dispatched at once. The batching was intentional:

1. **Scaffolding first** -- Task 1 (project setup, types) had to complete before anything else could import from `src/types/`
2. **Engines second** -- Tasks 2-5 could run in parallel because they only depended on types
3. **Prototype gate** -- Visual approval before UI work began
4. **UI components third** -- Tasks 6-11 could run in parallel because each owned distinct component files
5. **Integration last** -- Task 13 verified the whole system

### Zero File Conflicts

Across approximately 30 subagent dispatches (both specs combined), there were zero file conflicts requiring manual resolution. This was not luck -- it was engineered through the File Touch Map and batching strategy.

### Build Success on First Try

The V1 build compiled successfully on the first attempt after all agents completed. Every agent had the same type definitions (from Task 1), the same store interface (from Task 2), and the same engine APIs (from Tasks 3-5). The integration task found no wiring issues.

### What Made This Possible

- **Explicit interfaces** -- TypeScript interfaces defined in Task 1 served as contracts between agents
- **Store as integration point** -- Zustand store defined in Task 2 was the shared state layer; UI components only needed to import actions and selectors
- **Engine isolation** -- Each engine (parser, substitution, vault, highlighter) was a pure-function module with no side effects
- **Prototype as visual contract** -- UI agents referenced the approved playground HTML for layout, not each other's code

---

## 5. What Didn't Work / Lessons Learned

### Confidential Data in Seed Template

The initial seed template was a production config containing real IP addresses, SNMP community strings, and TACACS keys. This was committed to the repository before anyone noticed. The fix required replacing the seed data with fully sanitized placeholder content.

**Lesson:** Never commit real configs. Always use sanitized placeholders from the start. The excitement of "let me paste my actual config to test" is a security trap.

### MDX Compatibility in Task Prompts

The spec-workflow dashboard renders task prompts using MDX. Task prompts containing curly braces (`${variable}`), angle brackets (`<Component>`), and HTML comments (`<!-- -->`) broke the dashboard rendering. This required multiple fix iterations -- escaping syntax, replacing code with plain English descriptions, and testing each change against the dashboard.

**Lesson:** Task prompts are prose, not code. Use plain English descriptions of patterns instead of literal code syntax. The dashboard is not a code renderer.

### cleanUpSections Duplicating Content

The `cleanUpSections()` function was designed to inject START/END markers around detected section boundaries. However, it added markers alongside existing legacy dividers instead of replacing them. When the cleaned text was re-parsed, both the legacy dividers and the new START/END markers were detected as section boundaries, creating doubled sections.

The fix required understanding the full round-trip: raw text enters the parser, markers are injected, the result is saved, and on next load it is re-parsed. Every transformation must be idempotent -- applying it twice should produce the same result as applying it once.

**Lesson:** Any text transformation function must be tested for idempotency. Parse, transform, re-parse, and verify the result matches.

### Textarea Overlay Highlighting

Variable highlighting in the template editor used a transparent overlay div positioned over the textarea. The initial implementation placed the overlay behind the textarea -- completely invisible because the textarea's opaque background covered it.

The fix swapped the layering: overlay on top with `pointer-events: none` (so clicks pass through to the textarea), matched font metrics and scroll position, and used `background: transparent` on the textarea itself.

**Lesson:** Textarea overlay highlighting is a well-known browser technique with specific requirements -- the overlay must be above, pointer events disabled, fonts and padding exactly matched, and scroll position synchronized.

### useEffect Dependency Causing Input Reset

The SaveGeneratedModal component included `variableValues` in a `useEffect` dependency array that also set the suggested name. Every keystroke in the name field triggered a store update, which changed `variableValues` (or its reference), which re-ran the effect, which reset the name field.

The fix used `useRef` to capture the initial suggested name on mount, removing `variableValues` from the dependency array entirely.

**Lesson:** `useEffect` dependencies that include frequently-changing store values will cause re-render loops. Use refs for initial-value capture.

### Spec-Workflow Project Registration

When the Forge project was created, it was not automatically available in the spec-workflow dashboard dropdown. The MCP server's auto-registration only works when the server starts from within the project directory. Since the session started from the root workspace, manual registration was required.

**Lesson:** New projects need explicit registration in the spec-workflow dashboard. Consider adding a registration step to the project scaffolding checklist.

---

## 6. Architecture Decisions Made

### React + Vite + Tailwind (not vanilla JS)

The component model maps naturally to Forge's UI: sidebar, tree nodes, modals, form inputs, preview panels, and section tabs are all distinct, reusable components. Vanilla JS would have required a custom component system or spaghetti DOM manipulation. Vite provides fast HMR during development and optimized production builds. Tailwind with design tokens from the branding guide ensures visual consistency.

### Zustand for State Management (not Redux, not Context)

Zustand was chosen for three reasons: minimal boilerplate (no actions/reducers/dispatchers), built-in `persist` middleware that handles localStorage serialization automatically, and a simple selector API that prevents unnecessary re-renders. The entire store fits in a single file with clear action functions.

### Custom Syntax Highlighter (not Monaco/CodeMirror)

The config preview is read-only -- users never edit text in the preview pane. Monaco and CodeMirror are full editors with massive bundle sizes (Monaco alone is 2MB+). A custom tokenizer that recognizes CLI keywords, IP addresses, interface names, and comments produces the same visual result at a fraction of the cost.

### Web Crypto API (not node-forge or CryptoJS)

Browser-native cryptography eliminates a dependency and its associated supply-chain risk. AES-256-GCM with PBKDF2 key derivation (100,000 iterations) provides strong encryption for the export format. Available in all modern browsers, handles key derivation and encryption asynchronously without blocking the main thread.

---

## 7. Metrics

| Metric | Value |
|--------|-------|
| Total implementation tasks | 23 (16 V1 + 7 V1.1) |
| Total tests | 52 (all passing) |
| Total lines of code | ~15,000 |
| JS bundle size | 285 KB (gzip: 84 KB) |
| CSS bundle size | 33 KB (gzip: 7 KB) |
| Docker image size | 92 MB (nginx:alpine) |
| Subagent dispatches | ~30 across both specs |
| Dashboard approvals | 8 (requirements, design, tasks, readiness x 2 specs) |
| Bug fixes during QA | 5 |
| Issues created | 5 (FORGE-1 through FORGE-5) |
| Time from empty repo to deployed | ~3 hours |
| Formal requirements written | 17 (11 V1 + 6 V1.1) |

---

## 8. Conclusions

### The spec-workflow system scales to greenfield projects

Forge went from "I have an idea" to "it's deployed and my team can use it" in a single session. The workflow provided structure without overhead -- each phase produced a concrete artifact that the next phase consumed. The dashboard approvals prevented premature implementation and ensured alignment at every stage.

### Parallel subagent dispatch is the biggest force multiplier

Five to six independent components built simultaneously, with zero file conflicts, completing in roughly 40 minutes what sequential development would have taken 3-4 hours. The File Touch Map was the enabling analysis -- without explicit file ownership, parallel dispatch would risk merge conflicts and inconsistent interfaces.

### The prototype gate caught issues before they multiplied

By requiring visual approval before UI implementation began, the prototype gate ensured all six UI agents worked from the same approved design. Without it, each agent would have made independent visual decisions, requiring expensive cross-agent coordination after the fact.

### Real-world user testing found bugs that unit tests cannot

The five bugs discovered during QA all involved integration between components or interaction patterns that unit tests do not cover. Testing with real-world data -- the actual use case -- was essential.

### The workflow accelerates on the second pass

FORGE-2+3's spec cycle took roughly 10 minutes compared to FORGE-1's 15 minutes. Implementation took 25 minutes compared to 40 minutes. The patterns were established, the architecture was stable, and the team (human + agents) had shared context. This suggests the workflow's value compounds -- the first spec builds the foundation, subsequent specs build on it with increasing velocity.

### Session statistics tell the story

Three hours. Twenty-three tasks. Fifty-two tests. Fifteen thousand lines. Five issues documenting the full backlog. One deployed production application. The spec-workflow system did exactly what it was designed to do: turn ideas into shipped software with structure, speed, and quality.
