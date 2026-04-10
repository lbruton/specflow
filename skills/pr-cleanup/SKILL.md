---
name: pr-cleanup
description: >
  Post-merge branch and worktree cleanup. Prunes remote-tracking refs, deletes merged
  local branches and their worktrees, pulls main fast-forward, and reports the result.
  Run after a PR is merged, before /retro and /wrap.
  Triggers: "pr-cleanup", "clean up branches", "prune worktrees", "clean after merge".
---

# PR Cleanup

Post-merge housekeeping. Run this after a PR has been merged to main — before `/retro`
and `/wrap`. It is safe to run even if no PR was merged this session; it will just report
that nothing needed cleaning.

Run the entire flow autonomously. The user invoked `/pr-cleanup` once — that is the
permission to clean up merged state. Do NOT ask for permission between steps.

---

## When to run

- After a PR merged to main this session
- When `git worktree list` shows stale worktrees
- Anytime branches marked `[gone]` are piling up

If this session had no PR activity and no stale branches, report that briefly and exit.
Do not run the full flow unnecessarily.

---

## The Flow

### Step 1 — Snapshot current state (parallel)

```bash
git fetch --prune --all
git branch -vv                          # shows [gone] branches
git worktree list
git log --oneline @{u}..HEAD 2>/dev/null   # commits ahead of origin
git log --oneline HEAD..@{u} 2>/dev/null   # commits behind origin
gh pr list --author "@me" --state merged \
  --search "merged:>=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d 'yesterday' +%Y-%m-%d)" \
  --json number,title,headRefName,mergedAt 2>/dev/null
```

Hold all results in working memory. Do not display yet.

### Step 2 — Remove merged worktrees

For each entry in `git worktree list` (excluding the main worktree):

1. Check if the worktree's branch appears in `git branch -vv` output as `[gone]` — meaning
   the remote branch has been deleted (i.e., merged and cleaned up by GitHub).
2. If `[gone]`:
   - Check for uncommitted changes: `git -C <worktree-path> status --short`
   - If clean → remove the worktree: `git worktree remove <worktree-path> --force`
   - If dirty → **do NOT remove**. Add to warnings: "Worktree `<path>` has uncommitted
     changes — left intact. Review manually."
3. If NOT `[gone]` (branch still exists on remote) → leave it alone, no warning needed
   unless it's been open for >7 days (then add a soft note).

### Step 3 — Delete merged local branches

After worktree removal, run:

```bash
git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads \
  | awk '$2 == "[gone]" {print $1}'
```

This uses `git for-each-ref` rather than parsing `git branch -vv` — the latter outputs `*`
for the current branch, which causes `git branch -d *` to shell-expand to filenames in the
working directory. `git for-each-ref` always prints the real branch name.

For each `[gone]` branch:
- `git branch -d <branch>` (safe delete — refuses if unmerged)
- If `-d` fails, do NOT use `-D`. Add a warning: "Branch `<name>` not fully merged locally
  — skipped. Review manually."

### Step 4 — Pull main fast-forward

Switch to main if not already there:

```bash
git checkout main 2>/dev/null || true
```

Then:

```bash
git pull --ff-only
```

If `--ff-only` fails (diverged history), do NOT force-pull, do NOT rebase. Add a red
warning: "Pull failed — local main has diverged from origin/main. Resolve manually."

If already up to date, note it silently.

### Step 5 — Report

Print a compact summary:

```
## PR Cleanup

**Worktrees removed:** <N> (<list of paths>) / none
**Branches deleted:** <N> (<list of names>) / none
**Worktrees skipped (dirty):** <N> (<list>) / none
**Main:** pulled to <short SHA> / already up to date / ⚠ diverged — manual fix needed

<If nothing needed cleaning:>
Nothing to clean — no merged branches or stale worktrees detected.
```

Warnings (dirty worktrees, diverged main, unmerged branches) appear here and ONLY here.
No mid-flow interruptions.

---

## Rules

- **Never delete a worktree or branch with uncommitted changes.** Report as a warning.
- **Never force-push, force-delete, or rebase.** Fast-forward pull only.
- **Never touch the main worktree.** Only clean up worktrees created for branches.
- **Never auto-stash user work.** Dirty state becomes a warning, not an action.
- **`git branch -d` only.** If safe delete refuses, warn and skip.
- **`git pull --ff-only` only.** If it fails, warn and stop — do not attempt merge.

## What this skill does NOT do

- Rebase local branches onto main
- Merge or close open PRs
- Delete branches that are NOT marked `[gone]`
- Touch any uncommitted work
- Push anything
