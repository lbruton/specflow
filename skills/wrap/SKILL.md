---
name: wrap
description: >
  End-of-session orchestrator — verifies work complete, cleans worktrees, updates DocVault,
  captures retro lessons to mem0, writes session digest. Replaces /goodnight and /digest-session.
  Triggers: "wrap", "wrap up", "close session", "end of session", "done for the night",
  "finish up", "closing time".
---

# Wrap Session

Wrap up this session. Follow each phase in order — do not skip phases unless explicitly noted.

## Arguments

- **skipCleanup**: Pass `--skip-cleanup` if this session had no code changes (chat-only, research, etc.)

---

## Phase 1: Status Check

Gather the current state before making any changes. Run ALL of these in parallel:

```bash
# Git state
git status --short
git branch --show-current
git stash list

# Open worktrees
git worktree list

# Check for open PRs from this repo
gh pr list --state open --json number,title,headRefName,state,mergeStateStatus
```

Also check spec-workflow state if the project uses it:
- If `.spec-workflow/specs/` exists, use the **spec-status** tool to check for in-progress tasks
- Look for any tasks marked `[-]` (in-progress) that need to be completed or reverted

**Report the status** before proceeding. If there are blockers (uncommitted files, unmerged PRs, in-progress tasks), present them and ask what to do.

---

## Phase 2: Cleanup Gate

If `--skip-cleanup` was passed, skip to Phase 3.

Work through each item. **Do not proceed to Phase 3 until all gates pass.**

### 2.1: Uncommitted Changes
If `git status` shows dirty files:
- Present the list and ask: **commit, stash, or discard?**
- If commit: stage relevant files and commit with a descriptive message
- If stash: `git stash push -m "wrap: uncommitted work from session"`
- If discard: confirm with user before running `git checkout -- .`

### 2.2: Implementation Logging
If spec-workflow is active and tasks were completed this session:
- Check that **log-implementation** was called for every task marked `[x]` during this session
- If any task was marked complete WITHOUT a log entry, run log-implementation NOW
- This is a **hard gate** — the most commonly skipped step in the workflow

### 2.3: PR Status
For each open PR from this session:
- If **merged**: note it, proceed to worktree cleanup
- If **open, checks passing**: ask user — merge now or leave for review?
- If **open, checks failing**: flag it, ask user how to proceed
- If **draft**: leave it, note it in the session summary

### 2.4: Version Bump
If the project has `devops/version.lock`:
- Check if runtime code was changed this session (check git log for non-chore commits)
- If runtime changes exist and no version bump commit is present, flag it:
  "Runtime code changed but no version bump detected. Run /release patch before merging."

### 2.5: Worktree Cleanup
For each worktree listed in `git worktree list`:
- If the branch was **merged**: remove the worktree (`git worktree remove <path>`) and delete the branch (`git branch -d <branch>`)
- If the branch is **unmerged with no uncommitted changes**: ask user — delete or keep?
- If the branch has **uncommitted changes**: flag it, do not auto-delete

After cleanup, verify main/dev branch is clean:
```bash
git checkout <main-branch>
git pull origin <main-branch>
git status --short
```

---

## Phase 3: Documentation

### 3.1: DocVault Updates
If code was changed this session, update relevant DocVault documentation:
- Identify which DocVault pages are affected by the changes (architecture, API, features, etc.)
- Read each affected page to check if it needs updates
- Update pages with current information
- Commit DocVault changes directly to main (DocVault uses direct commits, no PR needed)

The DocVault lives at `/Volumes/DATA/GitHub/DocVault/`. Use the project name to find the right subdirectory under `Projects/`.

### 3.2: Issue Updates
If the session was driven by an issue (DocVault or GitHub):
- If work is **complete**: update the issue status to `done` and add a completion note with PR/commit references
- If work is **partially complete**: update the issue with progress notes and remaining work
- If work is **blocked**: update the issue with blocker details

### 3.3: Spec Status
If spec-workflow specs were involved:
- Update spec phase status if all tasks are complete
- Check for pending approvals that should be resolved

---

## Phase 4: Knowledge Capture

This is the most important phase — it's what makes the next session productive. Run steps 4.1 and 4.2 sequentially (retro first, then digest), but 4.3 can run in parallel with 4.2.

### 4.1: Retrospective (prescriptive lessons)

Scan the current conversation for high-signal lessons. Look for:
- **Mistakes** that cost time or caused rework
- **Wrong assumptions** that led you astray
- **Successful approaches** worth repeating
- **User preferences** expressed during the session
- **Codebase gotchas** discovered (tricky code, hidden dependencies, surprising behavior)
- **Process improvements** — things that should be done differently next time

For each lesson (target 3-8), save to mem0:

```
mcp__mem0__add_memory(
  text: "<single prescriptive sentence — action verb or 'When X, do Y' format>",
  user_id: "lbruton",
  agent_id: "<project-tag from project.json>",
  metadata: {
    "type": "retro-learning",
    "category": "<error|pattern|preference|improvement|warning|win>",
    "source": "retro",
    "project": "<project-name>"
  }
)
```

**Categories:**
- **error**: Mistake that cost time — "Always check X before Y"
- **pattern**: Reusable approach — "When doing X, use Y"
- **preference**: User preference — "lbruton prefers X over Y"
- **improvement**: Process improvement — "Next time, do X first"
- **warning**: Gotcha or risk — "Watch out for X when touching Y"
- **win**: Successful approach — "X worked well for Y"

**Actor attribution rules (strict):**
- Things lbruton did: "lbruton prefers/uses/instructs..."
- Things Claude did: "Claude should..."
- Codebase facts: passive voice or component name

**Critical:** Always set BOTH `user_id` AND `agent_id`. Without `agent_id`, mem0 creates placeholder entity names.

### 4.2: Session Digest (human-readable report for DocVault)

Write a session digest entry to the DocVault daily digest file. This is the human-readable record of what happened.

**Path:** `/Volumes/DATA/GitHub/DocVault/Daily Digests/<ProjectFolder>/<YYYY-MM-DD>.md`

Where `<ProjectFolder>` maps to the project name (e.g., StakTrakr, HexTrackr, Infrastructure, SpecFlow).

**If the file doesn't exist**, create it with this format:
```markdown
---
date: <YYYY-MM-DD>
project: <ProjectName>
tags: [daily-digest, <project-tag>]
---

# Daily Digest — <ProjectName> (<YYYY-MM-DD>)

## <HH:MM AM/PM>

<session summary>
```

**If the file exists**, append a new `## <HH:MM AM/PM>` section.

**Session summary content** (200-300 words, flowing prose):
- What was the goal of this session?
- What was accomplished? (specific: commits, PRs, issues closed, features shipped)
- What problems were encountered and how were they resolved?
- What decisions were made and why?
- What's the current state? (branch, version, open work)
- What should happen next?

Include **concrete anchors**: commit hashes, issue IDs, version numbers, file paths. These make the digest searchable and verifiable.

Commit the digest to DocVault:
```bash
cd /Volumes/DATA/GitHub/DocVault && git add "Daily Digests/" && git commit -m "digest: <project> session <date>" && git push origin main
```

### 4.3: Curated Session Summary (mem0 — machine-readable)

Write ONE concise mem0 entry summarizing this session. This is what the startup hook and /prime will retrieve next session.

```
mcp__mem0__add_memory(
  text: "[<ProjectName> | <branch> | <date>] <2-3 sentence summary of what was accomplished, key decisions, and current state. Include commit hashes, issue IDs, and version numbers as anchors.>",
  user_id: "lbruton",
  agent_id: "<project-tag>",
  metadata: {
    "category": "session-summary",
    "type": "session-digest",
    "source": "wrap",
    "date": "<YYYY-MM-DD>",
    "project": "<ProjectName>"
  }
)
```

**Quality bar for this entry:**
- Would this be useful if it showed up in 5 search results next session? If not, make it more specific.
- Does it contain at least one concrete anchor (commit, issue ID, version)?
- Does it say what CHANGED, not just what was "worked on"?
- Is it different enough from the retro lessons to avoid redundancy?

---

## Phase 5: Final Verification

Run these checks and present the results:

```bash
# Confirm repo is clean
git status --short
git worktree list

# Confirm we're on the right branch
git branch --show-current
```

### Session Recap

Present a compact summary:

```
## Session Complete

**Shipped:** <list PRs merged, issues closed, versions bumped>
**Pending:** <list open PRs, unfinished work, blockers>
**Lessons:** <count> retro entries saved to mem0
**Digest:** Written to DocVault/Daily Digests/<path>
**Cleanup:** <worktrees removed, branches deleted>

Next session: <1-2 sentence suggestion for what to work on>
```

---

## Rules

- **Sequential phases**: Do not skip ahead. Phase 2 must complete before Phase 3.
- **Ask, don't assume**: At every decision point (commit/stash/discard, merge/wait), ask the user.
- **No Haiku agents**: All summaries and digests are written by YOU (the current in-context model). Never dispatch a subagent for summarization.
- **Idempotent**: Running /wrap twice should be safe. Check if retro/digest already ran before duplicating.
- **mem0 writes require both user_id and agent_id**: Missing agent_id causes entity tracking issues.
- **DocVault commits go direct to main**: No PR needed for documentation updates.
- **Never auto-delete uncommitted work**: Always ask first.
- **The session isn't over until Phase 5 prints the recap.**
