---
tags: [readiness, spec]
created: {{YYYY-MM-DD}}
updated: {{YYYY-MM-DD}}
---

# Implementation Readiness Report — {{ISSUE-ID}}

## References

- **Issue:** {{ISSUE-ID}}
- **Spec Path:** `specs/{{spec-name}}/`
- **Generated:** {{YYYY-MM-DD}}

---

## Cross-Validation Summary

**Status:** [PASS | CONCERNS | FAIL] — [one-line rationale]

[2-3 sentence summary of the cross-validation. State the scope of the spec and whether coverage is complete, partial, or has gaps.]

---

## Requirements → Tasks Traceability

| Requirement | Acceptance Criteria Coverage | Tasks | Coverage |
|-------------|------------------------------|-------|----------|
| REQ-1 [title] | [list ACs covered] | [task numbers] | [Complete / Partial / Missing] |
| REQ-2 [title] | [list ACs covered] | [task numbers] | [Complete / Partial / Missing] |

### Manual verification notes

- [For each requirement, explain HOW the tasks cover the ACs — not just that they do]
- [Call out any indirect coverage (e.g., "Task 3 covers AC5 because the restriction forbids changing the key")]

**Verdict:** [All requirements covered / N orphaned requirements found]

---

## Design → Tasks Alignment

| Design Decision | Task Reference | Status |
|-----------------|----------------|--------|
| [Decision from design.md] | [Task N] | [Covered / Missing] |
| [Decision from design.md] | [Task N] | [Covered / Missing] |

### Manual verification notes

- [Explain how the task structure preserves the design's constraints]
- [Note any "do not touch" boundaries from design that are enforced via task restrictions]

**Verdict:** [No missing design elements / N design elements lack implementing tasks]

---

## Contradictions

[None found | List contradictions between requirements, design, and tasks]

### Manual verification notes

- [For each potential contradiction area, explain why the documents are consistent]
- [If contradictions exist, cite the specific conflicting statements with document:section references]

**Verdict:** [Documents are consistent / N contradictions found requiring resolution]

---

## Prototype Consistency

[N/A — no prototype required | Verified — prototype artifacts present in tasks | MISSING — prototype required but not in task leverage]

[If applicable, verify that design.md `Prototype Required` field matches the presence/absence of Phase 3.5 tasks (0.1-0.3) and that artifact paths appear in relevant task `_Leverage` fields.]

---

## File Touch Map Validation

| File or Area Mentioned in Tasks | In File Touch Map? | Status |
|---------------------------------|--------------------|--------|
| [file path from task N] | [Yes / No] | [Accurate / Missing] |
| [file path from task N] | [Yes / No] | [Accurate / Missing] |

### Manual verification notes

- [Confirm the blast radius is accurately represented]
- [Note any closing-task artifacts (verification.md, etc.) that are acceptably absent from the map]
- [Flag any hidden file changes implied by task prompts but not in the map]

**Verdict:** [File Touch Map is accurate / N files missing from map]

---

## Test Design Coverage

| Test Intent | Task Reference | Status |
|-------------|----------------|--------|
| Establish test baseline before changes | Task 0.4 | [Covered / Missing] |
| Write failing tests for new behavior (TDD) | Task 0.5 | [Covered / Missing] |
| Full test suite pass after implementation | Task N | [Covered / Missing] |
| Requirement-to-code verification with evidence | Task N+3 | [Covered / Missing] |

### Manual verification notes

- [Confirm TDD red-green flow is correctly sequenced: baseline → failing tests → implementation → green suite]
- [List the specific test scenarios from Task 0.5 and confirm they map to acceptance criteria]
- [Note any additional verification layers beyond automated tests]

**Verdict:** [Test design is present and correctly sequenced / NO TEST TASK FOUND — FAIL]

---

## Release Hygiene

| Hygiene Item | Coverage | Status |
|--------------|----------|--------|
| Version lock / worktree gate | [VERSION CHECKOUT GATE in tasks.md / N/A — no version lock] | [Covered / Missing / N/A] |
| Version bump | [task or workflow that handles it] | [Covered / Missing / N/A] |
| Changelog update | [task or workflow that handles it] | [Covered / Missing / N/A] |
| DocVault update | [task reference] | [Covered / Missing] |

### Manual verification notes

- [Explain how the project's release workflow covers version/changelog if not explicit tasks]
- [Confirm DocVault update is in a closing task, not just assumed]

**Verdict:** [Release hygiene accounted for / N gaps found]

---

## Agent Recommendation

### Recommendation: [PASS | CONCERNS | FAIL]

[2-3 sentences on why this recommendation.]

### Why this is [ready / has concerns / not ready]

- [Bullet points supporting the recommendation]
- [Reference specific findings from sections above]

### Residual risk

- [Low/Medium/High]: [describe the main implementation hazard and how tasks mitigate it]

### Next step if approved

[If PASS: proceed to Phase 4 with execution-choice menu.]
[If CONCERNS: proceed to Phase 4 but log concerns in tasks.md.]
[If FAIL: list specific documents to fix and re-run readiness gate.]
