import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { ProjectRegistry, generateProjectId } from '../project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../global-dir.js';

describe('ProjectRegistry worktree identity', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `spec-workflow-registry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = tempDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('stores workspace identity and workflow root separately', async () => {
    const registry = new ProjectRegistry();
    const workspacePath = '/tmp/worktrees/feature-auth';
    const workflowRootPath = '/tmp/my-repo';

    const projectId = await registry.registerProject(workspacePath, process.pid, { workflowRootPath });
    const entry = await registry.getProjectById(projectId);

    expect(entry).not.toBeNull();
    expect(entry?.projectPath).toBe(resolve(workflowRootPath));
    expect(entry?.workflowRootPath).toBe(resolve(workflowRootPath));
    expect(entry?.projectName).toBe('my-repo');
  });

  it('generates same project ID for different worktrees of same repo', async () => {
    const registry = new ProjectRegistry();
    const workflowRootPath = '/tmp/my-repo';

    const projectIdA = await registry.registerProject('/tmp/worktrees/feature-a', process.pid, { workflowRootPath });
    const projectIdB = await registry.registerProject('/tmp/worktrees/feature-b', process.pid + 1, { workflowRootPath });

    expect(projectIdA).toBe(projectIdB);
  });

  it('normalizes legacy entries without workflowRootPath', async () => {
    const workspacePath = '/tmp/my-repo';
    const projectId = generateProjectId(workspacePath);
    const registryPath = join(tempDir, 'activeProjects.json');

    const legacyData = {
      [projectId]: {
        projectId,
        projectPath: workspacePath,
        projectName: 'my-repo',
        instances: [{ pid: process.pid, registeredAt: new Date().toISOString() }]
      }
    };

    await fs.writeFile(registryPath, JSON.stringify(legacyData, null, 2), 'utf-8');

    const registry = new ProjectRegistry();
    const projects = await registry.getAllProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].workflowRootPath).toBe(resolve(workspacePath));
    expect(projects[0].projectPath).toBe(resolve(workspacePath));
  });

  it('worktree registration merges into parent entry', async () => {
    const registry = new ProjectRegistry();
    const workflowRootPath = '/tmp/my-repo';
    const worktreePath = '/tmp/worktrees/feature-x';

    // Register main repo first
    const mainId = await registry.registerProject(workflowRootPath, process.pid, { workflowRootPath });
    // Register a worktree with the same workflowRootPath
    const wtId = await registry.registerProject(worktreePath, process.pid + 1, { workflowRootPath });

    expect(mainId).toBe(wtId);

    const projects = await registry.getAllProjects();
    expect(projects).toHaveLength(1);

    const entry = await registry.getProjectById(mainId);
    expect(entry).not.toBeNull();
    expect(entry!.worktrees).toContain(resolve(worktreePath));
  });

  it('multiple worktrees share one entry', async () => {
    const registry = new ProjectRegistry();
    const workflowRootPath = '/tmp/my-repo';
    const wt1 = '/tmp/worktrees/feat-a';
    const wt2 = '/tmp/worktrees/feat-b';
    const wt3 = '/tmp/worktrees/feat-c';

    const id1 = await registry.registerProject(wt1, process.pid, { workflowRootPath });
    const id2 = await registry.registerProject(wt2, process.pid + 1, { workflowRootPath });
    const id3 = await registry.registerProject(wt3, process.pid + 2, { workflowRootPath });

    expect(id1).toBe(id2);
    expect(id2).toBe(id3);

    const projects = await registry.getAllProjects();
    expect(projects).toHaveLength(1);

    const entry = projects[0];
    expect(entry.worktrees).toContain(resolve(wt1));
    expect(entry.worktrees).toContain(resolve(wt2));
    expect(entry.worktrees).toContain(resolve(wt3));
  });

  it('migration deduplicates existing registry entries', async () => {
    const registryPath = join(tempDir, 'activeProjects.json');
    const workflowRootPath = '/tmp/my-repo';
    const resolvedRoot = resolve(workflowRootPath);

    // Two entries with DIFFERENT projectIds but the SAME workflowRootPath
    // Simulates legacy registry where worktrees were keyed by their own path
    const legacyId1 = generateProjectId('/tmp/worktrees/feat-a');
    const legacyId2 = generateProjectId('/tmp/worktrees/feat-b');

    const legacyData: Record<string, any> = {
      [legacyId1]: {
        projectId: legacyId1,
        projectPath: '/tmp/worktrees/feat-a',
        workflowRootPath,
        projectName: 'my-repo · feat-a',
        instances: [{ pid: 99990, registeredAt: new Date().toISOString() }],
        worktrees: ['/tmp/worktrees/feat-a']
      },
      [legacyId2]: {
        projectId: legacyId2,
        projectPath: '/tmp/worktrees/feat-b',
        workflowRootPath,
        projectName: 'my-repo · feat-b',
        instances: [{ pid: 99991, registeredAt: new Date().toISOString() }],
        worktrees: ['/tmp/worktrees/feat-b']
      }
    };

    await fs.writeFile(registryPath, JSON.stringify(legacyData, null, 2), 'utf-8');

    const registry = new ProjectRegistry();
    // cleanupStaleProjects triggers migrateDeduplicateEntries internally
    await registry.cleanupStaleProjects();

    const projects = await registry.getAllProjects();
    expect(projects).toHaveLength(1);

    const entry = projects[0];
    expect(entry.projectId).toBe(generateProjectId(resolvedRoot));
    expect(entry.workflowRootPath).toBe(resolvedRoot);
    expect(entry.projectName).toBe('my-repo');
  });

  it('legacy entries without worktrees field default to empty array', async () => {
    const registryPath = join(tempDir, 'activeProjects.json');
    const workspacePath = '/tmp/my-repo';
    const projectId = generateProjectId(workspacePath);

    const legacyData = {
      [projectId]: {
        projectId,
        projectPath: workspacePath,
        workflowRootPath: workspacePath,
        projectName: 'my-repo',
        instances: [{ pid: process.pid, registeredAt: new Date().toISOString() }]
        // No worktrees field
      }
    };

    await fs.writeFile(registryPath, JSON.stringify(legacyData, null, 2), 'utf-8');

    const registry = new ProjectRegistry();
    const entry = await registry.getProjectById(projectId);

    expect(entry).not.toBeNull();
    expect(entry!.worktrees).toEqual([]);
  });

  it('unregistering a worktree removes it from worktrees array', async () => {
    const registry = new ProjectRegistry();
    const workflowRootPath = '/tmp/my-repo';
    const worktreePath = '/tmp/worktrees/feat-x';
    const mainPid = process.pid;
    const wtPid = process.pid + 1;

    // Register main + worktree
    await registry.registerProject(workflowRootPath, mainPid, { workflowRootPath });
    await registry.registerProject(worktreePath, wtPid, { workflowRootPath });

    // Verify worktree is tracked
    let entry = await registry.getProject(workflowRootPath);
    expect(entry!.worktrees).toContain(resolve(worktreePath));

    // Unregister the worktree by its path and PID
    await registry.unregisterProject(worktreePath, wtPid);

    // Project should still exist (main PID alive) but worktree path removed
    entry = await registry.getProject(workflowRootPath);
    expect(entry).not.toBeNull();
    expect(entry!.worktrees).not.toContain(resolve(worktreePath));
  });

  it('getProject finds project via worktree path', async () => {
    const registry = new ProjectRegistry();
    const workflowRootPath = '/tmp/my-repo';
    const worktreePath = '/tmp/worktrees/feat-y';

    await registry.registerProject(worktreePath, process.pid, { workflowRootPath });

    // Look up by worktree path — should return the parent project
    const entry = await registry.getProject(worktreePath);
    expect(entry).not.toBeNull();
    expect(entry!.workflowRootPath).toBe(resolve(workflowRootPath));
    expect(entry!.worktrees).toContain(resolve(worktreePath));
  });

  it('isProjectRegistered returns true for worktree path', async () => {
    const registry = new ProjectRegistry();
    const workflowRootPath = '/tmp/my-repo';
    const worktreePath = '/tmp/worktrees/feat-z';

    await registry.registerProject(worktreePath, process.pid, { workflowRootPath });

    // Both the root and the worktree path should be recognized
    expect(await registry.isProjectRegistered(workflowRootPath)).toBe(true);
    expect(await registry.isProjectRegistered(worktreePath)).toBe(true);

    // An unrelated path should not
    expect(await registry.isProjectRegistered('/tmp/other-repo')).toBe(false);
  });
});
