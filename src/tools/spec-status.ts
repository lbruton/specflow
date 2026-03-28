import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { SpecParser } from '../core/parser.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';

export const specStatusTool: Tool = {
  name: 'spec-status',
  description: `Display comprehensive specification progress overview.

# Instructions
Call when resuming work on a spec or checking overall completion status. Shows which phases are complete and task implementation progress. After viewing status, read tasks.md directly to see all tasks and their status markers ([ ] pending, [-] in-progress, [x] completed).`,
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project root (optional - uses server context path if not provided)'
      },
      specName: {
        type: 'string',
        description: 'Name of the specification'
      }
    },
    required: ['specName']
  },
  annotations: {
    title: 'Spec Status',
    readOnlyHint: true,
  }
};

export async function specStatusHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName } = args;
  
  // Use context projectPath as default, allow override via args
  const projectPath = args.projectPath || context.projectPath;
  
  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required but not provided in context or arguments'
    };
  }

  try {
    // Translate path at tool entry point (components expect pre-translated paths)
    const translatedPath = PathUtils.translatePath(projectPath);
    const parser = new SpecParser(translatedPath);
    const spec = await parser.getSpec(specName);
    
    if (!spec) {
      return {
        success: false,
        message: `Specification '${specName}' not found`,
        nextSteps: [
          'Check spec name',
          'Use spec-list tool to search available specs',
          'Create spec with create-spec-doc'
        ]
      };
    }

    // Determine current phase and overall status
    let currentPhase = 'not-started';
    let overallStatus = 'not-started';
    
    if (!spec.phases.requirements.exists) {
      currentPhase = 'requirements';
      overallStatus = 'requirements-needed';
    } else if (!spec.phases.design.exists) {
      currentPhase = 'design';
      overallStatus = 'design-needed';
    } else if (!spec.phases.tasks.exists) {
      currentPhase = 'tasks';
      overallStatus = 'tasks-needed';
    } else if (!spec.phases.readinessReport.exists) {
      currentPhase = 'readiness-gate';
      overallStatus = 'readiness-gate-needed';
    } else if (spec.taskProgress && spec.taskProgress.pending > 0) {
      currentPhase = 'implementation';
      overallStatus = 'implementing';
    } else if (spec.taskProgress && spec.taskProgress.total > 0 && spec.taskProgress.completed === spec.taskProgress.total) {
      currentPhase = 'post-implementation';
      overallStatus = 'post-implementation';
    } else {
      currentPhase = 'implementation';
      overallStatus = 'ready-for-implementation';
    }

    // Phase details
    const phaseDetails = [
      {
        name: 'Requirements',
        status: spec.phases.requirements.exists ? (spec.phases.requirements.approved ? 'approved' : 'created') : 'missing',
        lastModified: spec.phases.requirements.lastModified
      },
      {
        name: 'Design',
        status: spec.phases.design.exists ? (spec.phases.design.approved ? 'approved' : 'created') : 'missing',
        lastModified: spec.phases.design.lastModified
      },
      {
        name: 'Tasks',
        status: spec.phases.tasks.exists ? (spec.phases.tasks.approved ? 'approved' : 'created') : 'missing',
        lastModified: spec.phases.tasks.lastModified
      },
      {
        name: 'Readiness Gate',
        status: spec.phases.readinessReport.exists ? 'completed' : (spec.phases.tasks.exists ? 'pending' : 'not-started'),
        lastModified: spec.phases.readinessReport.lastModified
      },
      {
        name: 'Implementation',
        status: spec.phases.implementation.exists ? 'in-progress' : 'not-started',
        progress: spec.taskProgress
      },
      {
        name: 'Post-Implementation',
        status: currentPhase === 'post-implementation' ? 'action-required' : 'not-started',
        checklist: currentPhase === 'post-implementation' ? [
          'DocVault updated (/vault-update)',
          'E2E tests run (/bb-test)',
          'Vault issues closed (mark Done)',
          'GitHub issues closed (gh issue close)',
          'Spec archived'
        ] : undefined
      }
    ];

    // Next steps based on current phase
    const nextSteps = [];
    switch (currentPhase) {
      case 'requirements':
        nextSteps.push('Read template: .spec-workflow/templates/requirements-template-v*.md');
        nextSteps.push('Create: .spec-workflow/specs/{name}/requirements.md');
        nextSteps.push('Request approval');
        break;
      case 'design':
        nextSteps.push('Read template: .spec-workflow/templates/design-template-v*.md');
        nextSteps.push('Create: .spec-workflow/specs/{name}/design.md');
        nextSteps.push('Request approval');
        break;
      case 'tasks':
        nextSteps.push('Read template: .spec-workflow/templates/tasks-template-v*.md');
        nextSteps.push('Create: .spec-workflow/specs/{name}/tasks.md');
        nextSteps.push('Request approval');
        break;
      case 'readiness-gate':
        nextSteps.push('Phase 3.9: Implementation Readiness Gate required before implementation');
        nextSteps.push('Cross-validate requirements.md + design.md + tasks.md for consistency');
        nextSteps.push(`Create: .spec-workflow/specs/${specName}/readiness-report.md`);
        nextSteps.push('Submit readiness-report.md for dashboard approval (NOT tasks.md)');
        nextSteps.push('Dashboard options: Approve (PASS), Concerns (proceed with risks), Reject (fix and re-run)');
        break;
      case 'implementation':
        if (spec.taskProgress && spec.taskProgress.pending > 0) {
          nextSteps.push(`Read tasks: .spec-workflow/specs/${specName}/tasks.md`);
          nextSteps.push('Edit tasks.md: Change [ ] to [-] for task you start');
          nextSteps.push('Implement the task code');
          nextSteps.push('Edit tasks.md: Change [-] to [x] when completed');
        } else {
          nextSteps.push(`Read tasks: .spec-workflow/specs/${specName}/tasks.md`);
          nextSteps.push('Begin implementation by marking first task [-]');
        }
        break;
      case 'post-implementation':
        nextSteps.push('All tasks completed (marked [x]) — Phase 5 required before spec is done');
        nextSteps.push('1. Run /vault-update to update affected DocVault documentation');
        nextSteps.push('2. Commit DocVault changes (DocVault commits go direct to main)');
        nextSteps.push('3. Run /bb-test against PR preview URL for E2E verification');
        nextSteps.push('4. CLOSE all linked vault issues (mark status as Done in the issue markdown file)');
        nextSteps.push('5. CLOSE the linked GitHub issue if one exists (gh issue close)');
        nextSteps.push('6. Archive the spec after all issues are closed');
        break;
    }

    // Implementation log audit: check for completed tasks without logs
    let unloggedTasks: string[] = [];
    try {
      const specPath = PathUtils.getSpecPath(translatedPath, specName);
      const tasksFile = `${specPath}/tasks.md`;
      const { promises: fs } = await import('fs');
      const tasksContent = await fs.readFile(tasksFile, 'utf-8');
      const parseResult = parseTasksFromMarkdown(tasksContent);
      const completedTasks = parseResult.tasks
        .filter(t => t.status === 'completed')
        .map(t => t.id);

      if (completedTasks.length > 0) {
        const logManager = new ImplementationLogManager(specPath);
        const allLogs = await logManager.getAllLogs();
        const loggedTaskIds = new Set(allLogs.map(l => l.taskId));
        unloggedTasks = completedTasks.filter(id => !loggedTaskIds.has(id));
      }
    } catch {
      // If we can't read tasks or logs, skip the audit silently
    }

    // Add unlogged task warnings to nextSteps
    if (unloggedTasks.length > 0) {
      nextSteps.unshift(
        `⚠️ UNLOGGED TASKS: ${unloggedTasks.length} task(s) marked [x] without implementation logs: ${unloggedTasks.join(', ')}`,
        'Run log-implementation for each unlogged task BEFORE considering them complete'
      );
    }

    return {
      success: true,
      message: `Specification '${specName}' status: ${overallStatus}`,
      data: {
        name: specName,
        description: spec.description,
        currentPhase,
        overallStatus,
        createdAt: spec.createdAt,
        lastModified: spec.lastModified,
        phases: phaseDetails,
        taskProgress: spec.taskProgress || {
          total: 0,
          completed: 0,
          pending: 0
        },
        unloggedTasks: unloggedTasks.length > 0 ? unloggedTasks : undefined
      },
      nextSteps,
      projectContext: {
        projectPath,
        workflowRoot: PathUtils.getWorkflowRoot(projectPath),
        currentPhase,
        dashboardUrl: context.dashboardUrl
      }
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to get specification status: ${errorMessage}`,
      nextSteps: [
        'Check if the specification exists',
        'Verify the project path',
        'List directory .spec-workflow/specs/ to see available specifications'
      ]
    };
  }
}