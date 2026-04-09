---
name: chat
description: >
  Casual, freeform discovery mode (Phase 0 of the Spec Flow Lifecycle). Explore
  an idea without committing to code, issues, or specs. Dispatch subagents
  for research, surface past work from mem0, and build context until the idea is
  ready for an issue and formal spec. Triggers on "/chat", "/talk",
  "let's explore", "I have an idea", "what if we".
user-invocable: true
allowed-tools: >-
  Read, Glob, Grep, Agent,
  mcp__mem0__search_memories,
  mcp__claude-context__search_code,
  mcp__code-graph-context__find_code,
  mcp__code-graph-context__analyze_code_relationships,
  mcp__context7__resolve-library-id,
  mcp__context7__query-docs,
  mcp__brave-search__brave_web_search
---

# Chat — Phase 0 Discovery

Casual, no-commitment exploration of an idea. No code changes, no issue, no spec created. Just research, discussion, and context gathering.

## Rules

- **No code changes** — read-only exploration
- **No issue** — this is pre-commitment
- **No spec created** — that's `/discover` or `/spec`
- **No worktree** — nothing to branch for

## What You CAN Do

- Dispatch subagents for parallel research (Context7, web search, codebase analysis)
- Search mem0 for related past work and decisions
- Search the codebase for existing patterns and prior art
- Explore feasibility and scope
- Take notes and offer suggestions
- Ask clarifying questions
- Present trade-offs and alternatives

## Step 1: Detect Project Context

```bash
cat .claude/project.json 2>/dev/null
```

Note the project name for scoping searches.

## Step 2: Surface Prior Context

Before diving into research, check what we already know:

```
mcp__mem0__search_memories
  query: "{topic the user mentioned}"
  limit: 10
```

Present any relevant past decisions, discussions, or related work.

## Step 3: Research As Needed

Based on the conversation, dispatch research as appropriate:

### Codebase exploration (read-only)
- `mcp__claude-context__search_code` — "find code related to X"
- `mcp__code-graph-context__find_code` — structural search for functions/classes
- `Grep` / `Glob` — literal matches for identifiers

### Library/framework research
- `mcp__context7__resolve-library-id` + `mcp__context7__query-docs` — current best practices

### Web research
- `mcp__brave-search__brave_web_search` — external research, comparisons, prior art

### DocVault / wiki search
- `mcp__claude-context__search_code` with `path: ../DocVault` — search existing documentation (DocVault sits as a sibling directory next to the project)

### Parallel research
Use the Agent tool to dispatch multiple research queries in parallel when they're independent. Keep results concise — present findings, not raw dumps.

## Step 4: Conversational Loop

Engage in natural conversation. Ask questions, present findings, explore alternatives. The goal is to build enough context that the user can decide whether to proceed.

**Good questions to ask:**
- What problem does this solve for users?
- What existing functionality does this relate to?
- How big is this — quick fix, feature, or architecture change?
- Are there any constraints or non-negotiables?
- Have we tried something similar before?

## Step 5: Exit When Ready

When enough context has been gathered, suggest the next step:

### If the idea is concrete enough for a spec:
```
This sounds ready to formalize. Next steps:
1. Create an issue in DocVault: /issue create
2. Then run /discover {ISSUE-ID} for structured brainstorming
   — or /spec {ISSUE-ID} to go straight to spec creation
```

### If the idea needs more structured research:
```
There are still some open questions. I'd suggest:
1. Create an issue in DocVault to track this
2. Run /discover {ISSUE-ID} to do a structured brainstorm with a formal brief
```

### If the idea isn't worth pursuing:
```
Based on what we've found, this might not be worth the effort because [reasons].
Want to explore a different angle, or shelve this for now?
```

## What This Skill Does NOT Do

- Create files or modify code (use `/spec` or `/gsd` for that)
- Create issues (suggest it, but user creates via `/issue`)
- Create specs (that's `/discover` → `/spec`)
- Make decisions — present options, let the user decide
- Replace `/discover` — this is lighter and less structured

## Integration

**Upstream:** User starts a conversation with an idea
**Downstream:** `/discover {ISSUE-ID}` or `/spec {ISSUE-ID}` when ready
**Related:** `/discover` (structured Phase 1), `/spec` (Phase 2+), `/remember` (save insights)
