---
name: retro
description: >
  End-of-session retrospective that extracts prescriptive lessons from the current
  conversation and saves them to mem0 as structured retro-learning memories. Unlike
  a session digest (descriptive — what happened), retro is prescriptive — what to do
  differently next time. Triggers: "/retro", "retro", "session retro", "what did we learn",
  "lessons learned".
---

# Retro

Conduct a structured retrospective on the current session and save concrete, actionable
lessons to mem0 so future sessions don't repeat the same mistakes.

## The Core Distinction

- **Session digest** → descriptive: "Today we did X, worked on Y, finished Z"
- **Retro** → prescriptive: "Next time, do X before Y" / "Never edit A without checking B"

Retro is called automatically by `/wrap` Phase 4.1. It can also be run standalone at any
point in a session when you want to capture lessons without closing out the session.

## Step 1: Detect current project

```bash
repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -n "$repo_root" ]; then
  basename "$repo_root"
fi
```

Lowercase the result to use as the project tag (e.g., `StakTrakr` → `staktrakr`). If the
command produces no output (not inside a git repo), prompt the user for a project tag or
fall back to `global`.

## Step 2: Reflect on the conversation

Scan the full conversation for:

- Mistakes that cost time or required backtracking
- Assumptions that turned out to be wrong
- Approaches that worked particularly well
- Things the user explicitly liked or pushed back on
- Gotchas or edge cases discovered in the codebase
- Process steps that were done in the wrong order
- Tools or patterns that solved problems cleanly

**Target:** 3–8 high-signal lessons. Skip anything obvious or trivial. If nothing meets
the bar, it's fine to save zero lessons — do not pad.

## Step 3: Classify and write each lesson to mem0

For each lesson, call `mcp__mem0__add_memory` with:

```
mcp__mem0__add_memory(
  text: "<single prescriptive sentence — action verb or 'When X, do Y' format>",
  user_id: "<your mem0 user id — environment-specific, do not hardcode>",
  agent_id: "<project tag>",
  metadata: {
    "type": "retro-learning",
    "category": "<see categories below>",
    "source": "retro",
    "project": "<project tag>"
  }
)
```

**Important:** Always set `metadata.project: "<tag>"` — the top-level `agent_id` parameter
is accepted by mem0 v1 but not always persisted as a queryable field. Setting both is fine;
`metadata.project` is what makes the record reliably findable across sessions.

Always use the `text=` parameter (a single string), not `messages=[{role: "user", ...}]` —
the messages form triggers mem0's conversational parser and can produce placeholder names
instead of saving the literal lesson.

### Categories

| Category | Use when | Example |
|---|---|---|
| `error` | A mistake that cost time or caused a bug | "When editing events.js, always check api.js for duplicate definitions first." |
| `pattern` | A successful approach worth repeating | "Use the context-percentage-usable widget, not context-percentage — it's buffer-corrected." |
| `preference` | Something the user explicitly liked or rejected | "This user prefers 2–3 row statusline layouts over 5+ row verbose layouts." |
| `improvement` | A process step that should change order or method | "Run the DocVault update BEFORE pushing — committing docs after PR creation orphans the changes." |
| `warning` | A codebase gotcha or anti-pattern | "Never edit runtime JS files on the protected main worktree — always create a worktree branch first." |
| `win` | Something that worked really well and should be repeated | "Custom status-line widgets work cleanly via the `block-bar` pattern — reuse for future widgets." |

### Writing style rules

- Start with an action verb or "When [condition],"
- Be concrete and specific — include file names, tool names, command names
- One lesson per memory call — do NOT batch multiple lessons into one memory
- 1–2 sentences max per memory
- **Actor attribution:** always use explicit subjects. Never leave the actor ambiguous:
  - Things the **user** did or prefers → use their name/handle when known, otherwise "this user ..." or "the user ..." (e.g., "This user prefers 2–3 row layouts")
  - Things the **agent** did or should do → use "Claude should ..." / "When Claude ..." / "The agent should ..."
  - Codebase facts → use passive voice or name the component (e.g., "The events.js file contains duplicate definitions")
  - **NEVER** use generic placeholder names like "User", "Alice", or "Bob". When the user's real name/handle is unknown, "this user" / "the user" is the acceptable fallback.

## Step 4: Present summary

After all mem0 writes complete, show a formatted summary:

```
## Session Retro — <project> (<YYYY-MM-DD>)

Saved <N> lessons to mem0:

🔴 errors (<count>)
  • <lesson text>

🟡 warnings (<count>)
  • <lesson text>

🟢 wins (<count>)
  • <lesson text>

🔵 patterns (<count>)
  • <lesson text>

⚙️  improvements (<count>)
  • <lesson text>

💜 preferences (<count>)
  • <lesson text>
```

Only show categories that have at least one entry. If zero lessons were saved, say so
plainly rather than producing an empty report.

## When to run

- At natural session end before closing the terminal (called automatically by `/wrap`)
- After a spec completes (capture implementation lessons)
- After a debugging session that required backtracking
- Anytime you find yourself thinking "I should remember this for next time"

## Integration

Retro learnings are intended to be surfaced at the start of future sessions. The recommended
pattern is a session-start hook that searches recent mem0 entries tagged
`type: retro-learning` for the current project and prepends the top results to the
conversation. A PreToolUse hook can also surface relevant retro lessons before skill
execution. Hook scripts are not shipped with the plugin — users are expected to wire these
up themselves using Claude Code's standard hooks system (SessionStart, PreToolUse).
