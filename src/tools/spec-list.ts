import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { SpecParser } from '../core/parser.js';
import { readdir, stat } from 'fs/promises';

export const specListTool: Tool = {
  name: 'spec-list',
  description: `Search and list specifications by issue ID or title keywords.

# Instructions
Call to find existing specs before creating new ones. Searches both active and optionally archived specs. Matches against the full directory name (both issue ID prefix and title portion).`,
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description:
          'Absolute path to the project root (optional - uses server context path if not provided)',
      },
      query: {
        type: 'string',
        description:
          'Search query — matches against spec directory name (e.g., "STAK-123" or "authentication"). Case-insensitive.',
      },
      includeArchived: {
        type: 'boolean',
        description: 'Include archived specs in results (default: false)',
      },
    },
    required: [],
  },
  annotations: {
    title: 'Spec List',
    readOnlyHint: true,
  },
};

interface SpecListEntry {
  name: string;
  currentPhase: string;
  overallStatus: string;
  taskProgress: { total: number; completed: number; pending: number };
  createdAt: string;
  lastModified: string;
  archived: boolean;
}

function determinePhaseAndStatus(spec: { phases: any; taskProgress?: any }): {
  currentPhase: string;
  overallStatus: string;
} {
  if (spec.phases.discovery?.exists && !spec.phases.discovery?.approved) {
    return { currentPhase: 'discovery', overallStatus: 'discovery-in-progress' };
  }
  if (!spec.phases.requirements.exists) {
    return { currentPhase: 'requirements', overallStatus: 'requirements-needed' };
  }
  if (!spec.phases.design.exists) {
    return { currentPhase: 'design', overallStatus: 'design-needed' };
  }
  if (!spec.phases.tasks.exists) {
    return { currentPhase: 'tasks', overallStatus: 'tasks-needed' };
  }
  if (
    spec.phases.readinessReport &&
    (!spec.phases.readinessReport.exists || !spec.phases.readinessReport.approved)
  ) {
    return { currentPhase: 'readiness-gate', overallStatus: 'readiness-gate-needed' };
  }
  if (
    spec.taskProgress &&
    spec.taskProgress.completed === spec.taskProgress.total &&
    spec.taskProgress.total > 0
  ) {
    return { currentPhase: 'completed', overallStatus: 'completed' };
  }
  if (spec.taskProgress && spec.taskProgress.pending > 0) {
    return { currentPhase: 'implementation', overallStatus: 'implementing' };
  }
  return { currentPhase: 'implementation', overallStatus: 'ready-for-implementation' };
}

export async function specListHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const projectPath = args.projectPath || context.projectPath;
  const query = args.query?.trim().toLowerCase() || '';
  const includeArchived = args.includeArchived || false;

  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required but not provided in context or arguments',
    };
  }

  try {
    const translatedPath = PathUtils.translatePath(projectPath);
    const parser = new SpecParser(translatedPath);
    const results: SpecListEntry[] = [];

    // Get active specs
    const activeSpecs = await parser.getAllSpecs();
    for (const spec of activeSpecs) {
      if (!query || spec.name.toLowerCase().includes(query)) {
        const { currentPhase, overallStatus } = determinePhaseAndStatus(spec);
        results.push({
          name: spec.name,
          currentPhase,
          overallStatus,
          taskProgress: spec.taskProgress || { total: 0, completed: 0, pending: 0 },
          createdAt: spec.createdAt,
          lastModified: spec.lastModified,
          archived: false,
        });
      }
    }

    // Get archived specs if requested
    if (includeArchived) {
      const archivePath = PathUtils.getArchiveSpecsPath(translatedPath);
      try {
        const entries = await readdir(archivePath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (!query || entry.name.toLowerCase().includes(query)) {
              const specPath = PathUtils.getArchiveSpecPath(translatedPath, entry.name);
              try {
                const stats = await stat(specPath);
                results.push({
                  name: entry.name,
                  currentPhase: 'archived',
                  overallStatus: 'archived',
                  taskProgress: { total: 0, completed: 0, pending: 0 },
                  createdAt: stats.birthtime.toISOString(),
                  lastModified: stats.mtime.toISOString(),
                  archived: true,
                });
              } catch {
                // Skip unreadable archive entries
              }
            }
          }
        }
      } catch {
        // Archive directory doesn't exist — that's fine
      }
    }

    const matchLabel = query ? ` matching "${args.query}"` : '';
    const archivedCount = results.filter((r) => r.archived).length;
    const activeCount = results.length - archivedCount;

    return {
      success: true,
      message: `Found ${results.length} spec(s)${matchLabel} (${activeCount} active${includeArchived ? `, ${archivedCount} archived` : ''})`,
      data: {
        specs: results,
        query: args.query || null,
        includeArchived,
      },
      nextSteps:
        results.length === 0
          ? ['No specs found. Use write-spec-doc to create a new specification.']
          : ['Use spec-status with a spec name for detailed phase information.'],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to list specifications: ${errorMessage}`,
      nextSteps: [
        'Verify the project path is correct',
        'Verify the workflow root has a specs/ directory',
      ],
    };
  }
}
