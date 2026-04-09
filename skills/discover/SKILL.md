---
name: discover
description: >
  Structured brainstorm and research phase (Phase 1 of the Spec Flow Lifecycle).
  Takes an issue ID, dispatches research agents, runs codebase analysis,
  and produces a Discovery Brief with all open questions resolved. Bridges the
  gap between casual exploration (/chat) and formal spec creation (/spec).
  Triggers on "/discover", "/brainstorm", "research this issue", "explore this
  before we spec it".
user-invocable: true
allowed-tools: >-
  Bash, Read, Write, Glob, Grep, Agent,
  mcp__mem0__search_memories,
  mcp__mem0__add_memory,
  mcp__claude-context__search_code,
  mcp__code-graph-context__find_code,
  mcp__code-graph-context__find_callers,
  mcp__code-graph-context__analyze_code_relationships,
  mcp__context7__resolve-library-id,
  mcp__context7__query-docs,
  mcp__brave-search__brave_web_search,
  mcp__infisical__get-secret,
  mcp__plugin_specflow_specflow__spec-list
---

# Discover — Phase 1 Structured Brainstorm

Structured research and design exploration for an issue. Produces a **Discovery Brief** with all open questions resolved, then hands off to `/spec` for formal specification.

**Does NOT:** create spec documents (that's `/spec`).
**Does NOT:** write code or create worktrees.
**Does NOT:** skip the issue requirement — issue ID is mandatory.

> **Path convention:** This skill assumes DocVault sits as a sibling directory to the current project. All DocVault paths are written as `../DocVault/...` relative to the project root.

---

## Step 0: Parse Arguments

**Argument:** `{ISSUE-ID}` (issue ID, required). If not provided, stop and ask.

If the user passes a topic instead of an issue ID:
```
An issue is required before structured brainstorming.
Would you like to:
1. Create one now: create an issue in DocVault
2. Explore casually first: /chat
```

### Project detection

```bash
cat .claude/project.json 2>/dev/null
```

Extract `issuePrefix` and `name`.

### Fetch issue from vault

Read the issue file from DocVault:

```bash
cat ../DocVault/Projects/{project}/Issues/{ISSUE-ID}.md 2>/dev/null || \
cat ../DocVault/Projects/{project}/Issues/Closed/{ISSUE-ID}.md
```

### Check for existing spec

```
mcp__plugin_specflow_specflow__spec-list
```

If a spec already exists for this issue, inform the user and suggest `/spec {ISSUE-ID} --resume` instead.

---

## Step 1: Surface Prior Context

Run these in parallel:

### mem0 search
```
mcp__mem0__search_memories
  query: "{issue title} {key terms from description}"
  limit: 10
```

### DocVault search
```
mcp__claude-context__search_code
  query: "{topic}"
  path: "../DocVault"
```

Present any relevant past decisions, related work, or prior discussions.

---

## Step 2: Codebase Impact Research

Run the codebase search tier protocol (minimum tiers 1-2):

### Tier 1: CGC — Structural
```
mcp__code-graph-context__find_code
  query: "{key functions, components, or modules related to this issue}"
```

```
mcp__code-graph-context__analyze_code_relationships
  query: "{affected area}"
```

### Tier 2: Claude-Context — Semantic
```
mcp__claude-context__search_code
  query: "{feature domain}"
```

Run 2-3 queries covering:
1. The feature/domain being planned
2. Existing patterns that should be reused
3. Integration points and dependencies

### Tier 3: Grep/Glob — Literal
As needed for specific identifiers, storage keys, constants.

### Produce Impact Summary

```
### Impact Summary

**Files likely affected:**
- `path/to/file.ts:XX-YY` — [why]

**Existing patterns to follow:**
- [Pattern name]: [file:line] — [description]

**Integration points:**
- [System/API]: [how this connects]

**Potential risks:**
- [Risk]: [mitigation]
```

---

## Step 3: External Research (If Needed)

For features involving libraries, APIs, or platform capabilities:

### Context7 — Library docs
```
mcp__context7__resolve-library-id  topic: "{library name}"
mcp__context7__query-docs  libraryId: "{id}"  topic: "{specific feature}"
```

### Web search — Prior art
```
mcp__brave-search__brave_web_search  query: "{topic} best practices 2025 2026"
```

---

## Step 4: Open Questions

Compile a list of every unresolved question. Categorize them:

```
### Open Questions

**Must resolve before spec (blocking):**
1. [Question] — [why it matters]
2. [Question] — [who can answer]

**Nice to resolve (non-blocking):**
3. [Question] — [can defer to design phase]

**Answered during research:**
4. ~~[Question]~~ — [answer found: source]
```

### Resolution Loop

For each blocking question:
1. Can we answer it from codebase research? → answer it
2. Can we answer it from docs/web search? → answer it
3. Need user input? → ask the user directly

<HARD-GATE>
All blocking open questions must be resolved before producing the Discovery Brief.
Non-blocking questions can carry forward to the spec's Open Questions section.
</HARD-GATE>

---

## Step 5: Design Exploration

With context gathered and questions answered, explore approaches:

### Present 2-3 approaches

For each approach:
- **Summary**: one-sentence description
- **Pros**: why this might be best
- **Cons**: downsides and risks
- **Effort estimate**: small / medium / large
- **Codebase fit**: how well it aligns with existing patterns

### Discuss with user

Get the user's reaction. They may:
- Pick an approach → note as the recommended approach
- Want to explore further → dig deeper on specific aspects
- Combine approaches → synthesize a hybrid
- Reject all → brainstorm alternatives

---

## Step 6: Produce Discovery Brief

Write a concise brief to the conversation (NOT to a file):

```
## Discovery Brief: {ISSUE-ID} — {title}

### Problem Statement
[What problem this solves, who it affects, why it matters]

### Research Findings
[Key findings from codebase analysis, mem0, and external research]

### Recommended Approach
[The approach the user selected or the strongest option]

### Files Affected
[From Impact Summary]

### Patterns to Follow
[Existing patterns to reuse]

### Remaining Open Questions
[Any non-blocking questions that should be noted in the spec]

### Estimated Scope
[small / medium / large — with justification]
```

---

## Step 7: Hand Off

### Save discovery context to mem0

```
mcp__mem0__add_memory(
  text: "Discovery brief for {ISSUE-ID}: {one-sentence summary of recommended approach}. Key files: {top 3 files}. Scope: {size}.",
  user_id: "<your mem0 user id — environment-specific, do not hardcode>",
  agent_id: "<project tag>",
  metadata: {
    "type": "discovery",
    "project": "{project}",
    "issue": "{ISSUE-ID}",
    "category": "architecture"
  }
)
```

### Suggest next step

```
Discovery complete for {ISSUE-ID}.

Ready to formalize? Run:
  /spec {ISSUE-ID}

The spec skill will pick up this context from mem0 and use the
recommended approach as the starting point for requirements.
```

---

## Integration

**Upstream:**
- `/chat` → when exploration identifies a concrete idea → create issue → `/discover`
- User directly: `/discover PROJ-123`

**Downstream:**
- `/spec {ISSUE-ID}` — formal spec creation using discovery findings
- The spec skill's Step 2 searches mem0 and will find the discovery brief

**Related:**
- `/chat` (Phase 0 — lighter, no issue)
- `/spec` (Phase 2+ — formal specification)
- `codebase-search` (tier protocol used in Step 2)
- `/remember` (save/recall insights)
