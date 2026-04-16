import { execSync, ExecSyncOptionsWithStringEncoding } from 'child_process';
import { resolve } from 'path';

export const SPEC_WORKFLOW_SHARED_ROOT_ENV = 'SPEC_WORKFLOW_SHARED_ROOT';
const GIT_EXEC_OPTIONS: ExecSyncOptionsWithStringEncoding = {
  encoding: 'utf-8',
  stdio: ['pipe', 'pipe', 'pipe'],
  timeout: 5000,
};

/**
 * Resolves the git workspace root directory.
 * For repositories and worktrees, this returns the top-level checked-out directory.
 *
 * @param projectPath - Any path inside the workspace
 * @returns Workspace root path, or original path when git is unavailable
 */
export function resolveGitWorkspaceRoot(projectPath: string): string {
  try {
    const rawOutput = execSync('git rev-parse --show-toplevel', {
      cwd: projectPath,
      ...GIT_EXEC_OPTIONS,
    }).trim();

    // Resolve to canonical absolute path and verify it's a real directory prefix
    const workspaceRoot = resolve(rawOutput);
    if (!workspaceRoot.startsWith('/')) {
      return projectPath;
    }
    return workspaceRoot;
  } catch {
    return projectPath;
  }
}

/**
 * Resolves the git root directory for storing shared specs.
 * In worktrees, this returns the main repository path so all worktrees share specs.
 *
 * @param projectPath - The current project/worktree path
 * @returns The resolved path (main repo for worktrees, or original path)
 */
export function resolveGitRoot(projectPath: string): string {
  // Check for explicit override first
  const explicitRoot = process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV]?.trim();
  if (explicitRoot) {
    return explicitRoot;
  }

  try {
    // Get the git common directory (main repo's .git folder)
    const gitCommonDirRaw = execSync('git rev-parse --git-common-dir', {
      cwd: projectPath,
      ...GIT_EXEC_OPTIONS,
    }).trim();

    // In main repo, returns ".git" - no change needed
    if (gitCommonDirRaw === '.git') {
      return projectPath;
    }

    // In worktree or subdirectory, returns path like "/main/.git", "/main/.git/worktrees/name",
    // or relative path like "../../.git" when run from a subdirectory.
    // Extract the main repo path (parent of .git) and resolve to absolute path.
    const gitIndex = gitCommonDirRaw.lastIndexOf('.git');
    if (gitIndex > 0) {
      const mainRepoPath = gitCommonDirRaw.substring(0, gitIndex - 1);
      // Resolve to canonical absolute path — breaks taint chain from execSync
      const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(mainRepoPath);
      const isUnixAbsolute = mainRepoPath.startsWith('/');
      // Windows absolute paths: return directly (resolve() mangles them on Unix)
      // Unix absolute paths: normalize via resolve()
      // Relative paths: resolve against projectPath
      let resolvedPath: string;
      if (isWindowsAbsolute) {
        resolvedPath = mainRepoPath;
      } else {
        resolvedPath = isUnixAbsolute ? resolve(mainRepoPath) : resolve(projectPath, mainRepoPath);
      }
      if (!resolvedPath.startsWith('/') && !isWindowsAbsolute) {
        return projectPath;
      }
      return resolvedPath;
    }

    return projectPath;
  } catch {
    // Not a git repo or git unavailable - use original path
    return projectPath;
  }
}

/**
 * Checks if the current directory is a git worktree (not the main repo).
 *
 * @param projectPath - The path to check
 * @returns true if in a worktree, false if main repo or not a git repo
 */
export function isGitWorktree(projectPath: string): boolean {
  try {
    const gitCommonDir = execSync('git rev-parse --git-common-dir', {
      cwd: projectPath,
      ...GIT_EXEC_OPTIONS,
    }).trim();
    return gitCommonDir !== '.git';
  } catch {
    return false;
  }
}
