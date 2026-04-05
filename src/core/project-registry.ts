import { join } from 'path';
import { promises as fs } from 'fs';
import { basename, resolve } from 'path';
import { createHash } from 'crypto';
import { getGlobalDir, getPermissionErrorHelp } from './global-dir.js';

export interface ProjectInstance {
  pid: number;
  registeredAt: string;
}

export interface ProjectRegistryEntry {
  projectId: string;
  projectPath: string;       // Canonical repo root (workflowRootPath)
  workflowRootPath: string;  // Path where .spec-workflow is stored (shared root)
  projectName: string;
  instances: ProjectInstance[];
  worktrees: string[];       // Active worktree workspace paths
}

export interface RegisterProjectOptions {
  workflowRootPath?: string;
  projectName?: string;
}

/**
 * Generate a stable projectId from an absolute path
 * Uses SHA-1 hash encoded as base64url
 */
export function generateProjectId(absolutePath: string): string {
  const hash = createHash('sha1').update(absolutePath).digest('base64url');
  // Take first 16 characters for readability
  return hash.substring(0, 16);
}

/**
 * Build display name for a workspace.
 * - Main repo: "repo"
 * - Worktree: "repo · worktree"
 */
export function generateProjectDisplayName(workspacePath: string, workflowRootPath: string): string {
  const workspaceName = basename(workspacePath);
  const repoName = basename(workflowRootPath);

  if (workspacePath === workflowRootPath) {
    return repoName;
  }

  return `${repoName} · ${workspaceName}`;
}

export class ProjectRegistry {
  private registryPath: string;
  private registryDir: string;
  private needsInitialization: boolean = false;

  constructor() {
    this.registryDir = getGlobalDir();
    this.registryPath = join(this.registryDir, 'activeProjects.json');
  }

  /**
   * Ensure the registry directory exists
   */
  private async ensureRegistryDir(): Promise<void> {
    try {
      await fs.mkdir(this.registryDir, { recursive: true });
    } catch (error: any) {
      // Directory might already exist, ignore EEXIST errors
      if (error.code === 'EEXIST') {
        return;
      }
      // For permission errors, provide helpful guidance
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.error(getPermissionErrorHelp('create directory', this.registryDir));
        throw error;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Read the registry file with atomic operations
   * Returns a map keyed by projectId
   */
  private async readRegistry(): Promise<Map<string, ProjectRegistryEntry>> {
    await this.ensureRegistryDir();

    try {
      const content = await fs.readFile(this.registryPath, 'utf-8');
      // Handle empty or whitespace-only files
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        console.error(`[ProjectRegistry] Warning: ${this.registryPath} is empty, initializing with empty registry`);
        // Mark that we need to write the file
        this.needsInitialization = true;
        return new Map();
      }
      const data = JSON.parse(trimmedContent) as Record<string, ProjectRegistryEntry>;
      const registry = new Map<string, ProjectRegistryEntry>();

      // Ensure backward compatibility with older formats:
      // - instances may be missing
      // - workflowRootPath may be missing
      for (const [projectId, entry] of Object.entries(data)) {
        const normalizedProjectPath = resolve(entry.projectPath);
        const normalizedWorkflowRootPath = resolve(entry.workflowRootPath || entry.projectPath);

        registry.set(projectId, {
          ...entry,
          projectPath: normalizedProjectPath,
          workflowRootPath: normalizedWorkflowRootPath,
          projectName: entry.projectName || generateProjectDisplayName(normalizedProjectPath, normalizedWorkflowRootPath),
          instances: Array.isArray(entry.instances) ? entry.instances : [],
          worktrees: Array.isArray(entry.worktrees) ? entry.worktrees : []
        });
      }

      return registry;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty map
        this.needsInitialization = true;
        return new Map();
      }
      if (error instanceof SyntaxError) {
        // JSON parsing error - file is corrupted or invalid
        console.error(`[ProjectRegistry] Error: Failed to parse ${this.registryPath}: ${error.message}`);
        console.error(`[ProjectRegistry] The file may be corrupted. Initializing with empty registry.`);
        // Back up the corrupted file
        try {
          const backupPath = `${this.registryPath}.corrupted.${Date.now()}`;
          await fs.copyFile(this.registryPath, backupPath);
          console.error(`[ProjectRegistry] Corrupted file backed up to: ${backupPath}`);
        } catch (backupError) {
          // Ignore backup errors
        }
        this.needsInitialization = true;
        return new Map();
      }
      throw error;
    }
  }

  /**
   * Write the registry file atomically
   */
  private async writeRegistry(registry: Map<string, ProjectRegistryEntry>): Promise<void> {
    await this.ensureRegistryDir();

    const data = Object.fromEntries(registry);
    const content = JSON.stringify(data, null, 2);

    // Write to temporary file first, then rename for atomic operation
    const tempPath = `${this.registryPath}.tmp`;
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, this.registryPath);
  }

  /**
   * Check if a process is still running
   * Note: When running in Docker with path translation, we can't check host PIDs,
   * so we assume processes are alive if path translation is enabled.
   */
  private isProcessAlive(pid: number): boolean {
    // If path translation is enabled, we're in Docker and can't check host PIDs
    const hostPrefix = process.env.SPEC_WORKFLOW_HOST_PATH_PREFIX;
    const containerPrefix = process.env.SPEC_WORKFLOW_CONTAINER_PATH_PREFIX;
    if (hostPrefix && containerPrefix) {
      // Can't verify host PIDs from inside Docker, assume alive
      return true;
    }

    try {
      // Sending signal 0 checks if process exists without actually sending a signal
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a path is under one of the configured project roots.
   * SPEC_WORKFLOW_PROJECT_ROOT accepts colon-separated paths.
   * Returns true (allow) when no root is configured.
   */
  private isUnderProjectRoot(absolutePath: string): boolean {
    const rootEnv = process.env.SPEC_WORKFLOW_PROJECT_ROOT;
    if (!rootEnv) return true;

    const roots = rootEnv.split(':').map(r => resolve(r.trim())).filter(Boolean);
    return roots.some(root => absolutePath.startsWith(root));
  }

  /**
   * Register a project in the global registry
   * Self-healing: If a project exists with dead PIDs, cleans them up and adds new PID
   * Multi-instance: Allows unlimited MCP server instances per project
   */
  async registerProject(projectPath: string, pid: number, options: RegisterProjectOptions = {}): Promise<string> {
    const workspacePath = resolve(projectPath);
    const workflowRootPath = resolve(options.workflowRootPath || projectPath);

    // Skip registration for paths outside configured project root(s)
    if (!this.isUnderProjectRoot(workflowRootPath)) {
      return generateProjectId(workflowRootPath);
    }

    const registry = await this.readRegistry();
    const projectId = generateProjectId(workflowRootPath);
    const projectName = options.projectName || basename(workflowRootPath);

    const existing = registry.get(projectId);

    if (existing) {
      // Self-healing: Filter out dead PIDs
      const liveInstances = existing.instances.filter(i => this.isProcessAlive(i.pid));

      // Check if this PID is already registered (avoid duplicates)
      if (!liveInstances.some(i => i.pid === pid)) {
        liveInstances.push({ pid, registeredAt: new Date().toISOString() });
      }

      // Track worktree paths (deduped)
      if (workspacePath !== workflowRootPath && !existing.worktrees.includes(workspacePath)) {
        existing.worktrees.push(workspacePath);
      }

      // Update with live instances (no limit on number of instances)
      existing.projectPath = workflowRootPath;
      existing.workflowRootPath = workflowRootPath;
      existing.projectName = projectName;
      existing.instances = liveInstances;
      registry.set(projectId, existing);
    } else {
      // New project
      const worktrees: string[] = [];
      if (workspacePath !== workflowRootPath) {
        worktrees.push(workspacePath);
      }

      const entry: ProjectRegistryEntry = {
        projectId,
        projectPath: workflowRootPath,
        workflowRootPath,
        projectName,
        worktrees,
        instances: [{ pid, registeredAt: new Date().toISOString() }]
      };
      registry.set(projectId, entry);
    }

    await this.writeRegistry(registry);
    return projectId;
  }

  /**
   * Unregister a project from the global registry by path
   * If pid is provided, only removes that specific instance
   * If no pid provided, removes the entire project (backwards compat)
   */
  async unregisterProject(projectPath: string, pid?: number): Promise<void> {
    const registry = await this.readRegistry();
    const absolutePath = resolve(projectPath);

    // Try direct lookup first (path is the workflowRootPath)
    let projectId = generateProjectId(absolutePath);
    let entry = registry.get(projectId);

    // If not found, the path might be a worktree — scan entries for a worktree match
    if (!entry) {
      for (const [id, e] of registry.entries()) {
        if (e.worktrees.includes(absolutePath)) {
          projectId = id;
          entry = e;
          break;
        }
      }
    }

    if (!entry) return;

    if (pid !== undefined) {
      // Remove only this PID's instance
      entry.instances = entry.instances.filter(i => i.pid !== pid);

      // Also remove the worktree path if present
      entry.worktrees = entry.worktrees.filter(w => w !== absolutePath);

      if (entry.instances.length === 0) {
        registry.delete(projectId);
      } else {
        registry.set(projectId, entry);
      }
    } else {
      // Remove entire project (backwards compat)
      registry.delete(projectId);
    }

    await this.writeRegistry(registry);
  }

  /**
   * Unregister a project by projectId
   */
  async unregisterProjectById(projectId: string): Promise<void> {
    const registry = await this.readRegistry();
    registry.delete(projectId);
    await this.writeRegistry(registry);
  }

  /**
   * Get all active projects from the registry
   */
  async getAllProjects(): Promise<ProjectRegistryEntry[]> {
    const registry = await this.readRegistry();
    return Array.from(registry.values());
  }

  /**
   * Get a specific project by path
   */
  async getProject(projectPath: string): Promise<ProjectRegistryEntry | null> {
    const registry = await this.readRegistry();
    const absolutePath = resolve(projectPath);

    // Try direct lookup (path is the workflowRootPath)
    const projectId = generateProjectId(absolutePath);
    const direct = registry.get(projectId);
    if (direct) return direct;

    // Scan for worktree match
    for (const entry of registry.values()) {
      if (entry.worktrees.includes(absolutePath)) {
        return entry;
      }
    }

    return null;
  }

  /**
   * Get a specific project by projectId
   */
  async getProjectById(projectId: string): Promise<ProjectRegistryEntry | null> {
    const registry = await this.readRegistry();
    return registry.get(projectId) || null;
  }

  /**
   * Migrate legacy registry entries that were created before worktree-aware keying.
   * Groups entries by workflowRootPath and merges duplicates into a single canonical entry.
   * Idempotent — returns false if no changes were made.
   */
  private async migrateDeduplicateEntries(registry: Map<string, ProjectRegistryEntry>): Promise<boolean> {
    // Group entries by workflowRootPath
    const groups = new Map<string, string[]>(); // workflowRootPath -> projectId[]
    for (const [projectId, entry] of registry.entries()) {
      const key = entry.workflowRootPath;
      const existing = groups.get(key);
      if (existing) {
        existing.push(projectId);
      } else {
        groups.set(key, [projectId]);
      }
    }

    let merged = false;

    for (const [workflowRootPath, projectIds] of groups.entries()) {
      if (projectIds.length <= 1) continue;

      // Find the canonical entry — the one whose projectId matches the workflowRootPath hash
      const canonicalId = generateProjectId(workflowRootPath);
      let canonicalEntry = registry.get(canonicalId);

      if (!canonicalEntry) {
        // No correctly-keyed entry exists — create one from the first duplicate
        const firstEntry = registry.get(projectIds[0])!;
        canonicalEntry = {
          projectId: canonicalId,
          projectPath: workflowRootPath,
          workflowRootPath,
          projectName: basename(workflowRootPath),
          instances: [],
          worktrees: []
        };
        registry.set(canonicalId, canonicalEntry);
      }

      // Merge all duplicate entries into the canonical one
      const seenPids = new Set(canonicalEntry.instances.map(i => i.pid));
      const seenWorktrees = new Set(canonicalEntry.worktrees);

      for (const dupId of projectIds) {
        if (dupId === canonicalId) continue;

        const dupEntry = registry.get(dupId)!;

        // Merge instances (dedup by PID)
        for (const instance of dupEntry.instances) {
          if (!seenPids.has(instance.pid)) {
            seenPids.add(instance.pid);
            canonicalEntry.instances.push(instance);
          }
        }

        // Merge worktrees (dedup)
        for (const wt of dupEntry.worktrees) {
          if (!seenWorktrees.has(wt)) {
            seenWorktrees.add(wt);
            canonicalEntry.worktrees.push(wt);
          }
        }

        // Delete the non-canonical entry
        registry.delete(dupId);
      }

      // Ensure canonical metadata is correct
      canonicalEntry.projectPath = workflowRootPath;
      canonicalEntry.projectName = basename(workflowRootPath);

      console.error(`[ProjectRegistry] Migration: merged ${projectIds.length} entries for ${workflowRootPath}`);
      merged = true;
    }

    return merged;
  }

  /**
   * Clean up stale instances (where the process is no longer running)
   * Projects with no live instances are removed entirely
   * Returns the count of removed instances
   */
  async cleanupStaleProjects(): Promise<number> {
    const registry = await this.readRegistry();
    let removedInstanceCount = 0;
    let needsWrite = this.needsInitialization; // Write if file needs initialization

    for (const [projectId, entry] of registry.entries()) {
      const liveInstances = entry.instances.filter(i => this.isProcessAlive(i.pid));
      const deadCount = entry.instances.length - liveInstances.length;

      if (deadCount > 0) {
        removedInstanceCount += deadCount;
        needsWrite = true;

        // Keep project record even when all instances die — project data (specs, steering)
        // persists on disk and the dashboard should still be able to browse it offline.
        // Only clear the dead instance entries; never delete the project itself.
        entry.instances = liveInstances;
        registry.set(projectId, entry);
      }
    }

    // Deduplicate legacy entries that were keyed by worktree path instead of workflowRootPath
    if (await this.migrateDeduplicateEntries(registry)) {
      needsWrite = true;
    }

    if (needsWrite) {
      await this.writeRegistry(registry);
      this.needsInitialization = false; // Reset flag after successful write
    }

    return removedInstanceCount;
  }

  /**
   * Check if a project is registered by path
   */
  async isProjectRegistered(projectPath: string): Promise<boolean> {
    const registry = await this.readRegistry();
    const absolutePath = resolve(projectPath);

    // Direct lookup
    const projectId = generateProjectId(absolutePath);
    if (registry.has(projectId)) return true;

    // Worktree scan
    for (const entry of registry.values()) {
      if (entry.worktrees.includes(absolutePath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the registry file path for watching
   */
  getRegistryPath(): string {
    return this.registryPath;
  }
}
