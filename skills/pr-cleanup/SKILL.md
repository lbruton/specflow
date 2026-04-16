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

### Step 3 — Update main WITHOUT switching branches

**NEVER run `git checkout main`.** Switching branches can delete gitignored files on the
working branch if the target branch tracks those same files — this has caused real data
loss (CLAUDE.md deleted when main tracked it but dev had gitignored it).

Instead, fast-forward main in-place:

```bash
# Only fast-forward main if not currently on it
if [ "$(git branch --show-current)" != "main" ]; then
  git fetch origin main:main
fi
```

If this fails with "not a fast-forward", add a red warning:
"Pull failed — local main has diverged from origin/main. Resolve manually."

If successful (or already up to date), note the new SHA silently.

**This step must happen before branch deletion** so that `git branch -d` has an up-to-date
main to check ancestry against (regular merges only — squash merges still require separate
handling, see Step 4).

### Step 3b — Pull current branch if behind

If the current branch (typically `dev`) is behind its upstream, fast-forward it:

```bash
git pull --ff-only
```

If `--ff-only` fails (diverged), add a warning: "Current branch has diverged from remote —
pull manually." Do NOT switch branches or force anything.

### Step 4 — Delete merged local branches

After main is current, run:

```bash
git for-each-ref --format='%(refname:short) %(upstream:track)' refs/heads \
  | awk '$2 == "[gone]" {print $1}'
```

This uses `git for-each-ref` rather than parsing `git branch -vv` — the latter outputs `*`
for the current branch, which causes `git branch -d *` to shell-expand to filenames in the
working directory. `git for-each-ref` always prints the real branch name.

For each `[gone]` branch:

1. Try `git branch -d <branch>` (safe delete).
2. If `-d` succeeds → done.
3. If `-d` fails → **squash-merge check**: GitHub squash merges create a new commit whose
   ancestry never includes the feature branch tip, so `-d` always refuses for squash-merged
   branches even after main is current. Cross-reference the branch name against the merged
   PR list fetched in Step 1 (`gh pr list --state merged ... --json headRefName`):
   - **Branch name matches a merged PR's `headRefName`** → confirmed squash-merged by
     GitHub. Use `git branch -D <branch>` (force delete is safe — remote is already gone
     and the PR merge is confirmed).
   - **Branch name NOT in merged PR list** → genuinely unmerged or deleted without merging.
     Add a warning: "Branch `<name>` not fully merged and not found in recent merged PRs —
     skipped. Review manually." Do NOT use `-D`.

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
- **`git branch -d` first; `git branch -D` only as squash-merge fallback.** Force-delete is
  permitted exclusively when: (a) `git branch -d` refused, AND (b) the branch name matches
  a confirmed merged PR in `gh pr list --state merged`. All other refusals → warn and skip.
- **`git pull --ff-only` only.** If it fails, warn and stop — do not attempt merge.
- **NEVER `git checkout main`.** Use `git fetch origin main:main` (guarded — skip if already on main) to update main in-place.
  Branch switching can silently delete gitignored files when the two branches have different
  tracking state for the same file — this has caused real data loss.

## What this skill does NOT do

- Rebase local branches onto main
- Merge or close open PRs
- Delete branches that are NOT marked `[gone]`
- Touch any uncommitted work
- Push anything
