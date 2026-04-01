---
description: "End-of-session orchestrator. Verifies work is complete, cleans worktrees, updates docs, captures retro lessons to mem0, writes session digest. Replaces /goodnight and /digest-session."
argument-hint: "[--skip-cleanup]"
---

$ARGUMENTS

Wrap up this session. Follow each phase in order — do not skip phases unless explicitly noted.

Skip cleanup: only if arguments contain "--skip-cleanup" (use when wrapping a session with no code changes).

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
- If `.spec-workflow/specs/` exists, use the **spec-status** MCP tool to check for in-progress tasks
- Look for any tasks marked `[-]` (in-progress) that need to be completed or reverted

**Report the status** before proceeding. If there are blockers (uncommitted files, unmerged PRs, in-progress tasks), present them and ask what to do.

---

## Phase 2: Cleanup Gate

If --skip-cleanup, skip to Phase 3.

### 2.1: Uncommitted Changes
If `git status` shows dirty files:
- Present the list and ask: **commit, stash, or discard?**

### 2.2: Implementation Logging
If spec-workflow is active and tasks were completed this session:
- Check that **log-implementation** was called for every task marked `[x]` during this session
- If any task was marked complete WITHOUT a log entry, run log-implementation NOW
- This is a **hard gate**

### 2.3: PR Status
For each open PR from this session:
- If **merged**: note it, proceed to worktree cleanup
- If **open, checks passing**: ask user — merge now or leave for review?
- If **open, checks failing**: flag it, ask user how to proceed
- If **draft**: leave it, note it in the session summary

### 2.4: Version Bump
If the project has `devops/version.lock`:
- Check if runtime code was changed this session
- If runtime changes exist and no version bump commit is present, flag it

### 2.5: Worktree Cleanup
For each worktree:
- If branch was **merged**: remove worktree and delete branch
- If branch is **unmerged with no uncommitted changes**: ask user
- If branch has **uncommitted changes**: flag it, do not auto-delete

### 2.6: Stale Remote Branch Pruning
Check for remote branches whose PRs have been merged (squash-merge leaves branches that `git branch -r --merged` misses):
```bash
# List all non-main remote branches
git branch -r | grep -v 'origin/main\|origin/HEAD' | sed 's|origin/||' | tr -d ' '
```
For each branch, check if its PR was merged: `gh pr list --head "<branch>" --state merged`
- If PR was **merged**: delete with `git push origin --delete <branch>`
- If **no PR found** or PR is **open**: leave it, note it in the recap
- After deletions, run `git fetch --prune`

This catches branches from prior sessions that accumulated via GitHub squash-merge.

---

## Phase 3: Documentation

### 3.1: DocVault Updates
If code was changed this session, update relevant DocVault documentation:
- Identify affected pages, read them, update with current information
- Commit directly to main (DocVault uses direct commits)

### 3.2: Issue Updates
If the session was driven by an issue:
- Complete: update status to `done` with PR/commit references
- Partial: update with progress notes and remaining work
- Blocked: update with blocker details

### 3.3: Spec Status
If spec-workflow specs were involved:
- Update spec phase status if all tasks are complete
- Check for pending approvals that should be resolved

---

## Phase 4: Knowledge Capture

### 4.1: Retrospective (prescriptive lessons)

Scan the conversation for high-signal lessons (3-8 entries):
- Mistakes that cost time
- Wrong assumptions
- Successful approaches worth repeating
- User preferences
- Codebase gotchas
- Process improvements

Save each to mem0 with:
- `user_id: "lbruton"`, `agent_id: "<project-tag>"`
- `metadata.type: "retro-learning"`, `metadata.category: "<error|pattern|preference|improvement|warning|win>"`

### 4.2: Session Digest (DocVault)

Write to: `/Volumes/DATA/GitHub/DocVault/Daily Digests/<ProjectFolder>/<YYYY-MM-DD>.md`

If file exists, append a new `## <HH:MM AM/PM>` section. Content (200-300 words):
- What was the goal? What was accomplished?
- Problems encountered and how resolved?
- Decisions made and why?
- Current state and what should happen next?
- Include concrete anchors: commit hashes, issue IDs, version numbers

Commit the digest to DocVault.

### 4.3: Curated Session Summary (mem0)

Write ONE concise mem0 entry summarizing this session with `metadata.type: "session-digest"`.

---

## Phase 5: Final Verification

```bash
git status --short
git worktree list
git branch --show-current
```

### Session Recap

```
## Session Complete

**Shipped:** <PRs merged, issues closed, versions bumped>
**Pending:** <open PRs, unfinished work, blockers>
**Lessons:** <count> retro entries saved to mem0
**Digest:** Written to DocVault/Daily Digests/<path>
**Cleanup:** <worktrees removed, branches deleted>

Next session: <1-2 sentence suggestion>
```

---

## Rules

- **Sequential phases**: Do not skip ahead. Phase 2 must complete before Phase 3.
- **Ask, don't assume**: At every decision point, ask the user.
- **No Haiku agents**: All summaries written by the current model.
- **Idempotent**: Running /wrap twice should be safe.
- **mem0 writes require both user_id and agent_id**.
- **DocVault commits go direct to main**.
- **Never auto-delete uncommitted work**: Always ask first.
- **The session isn't over until Phase 5 prints the recap.**
