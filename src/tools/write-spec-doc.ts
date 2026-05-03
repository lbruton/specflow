import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { validatePhaseGates } from '../core/phase-gates.js';
import { PathUtils, validateProjectPath } from '../core/path-utils.js';
import { mkdir, rename, writeFile } from 'fs/promises';
import { join } from 'path';

export const writeSpecDocTool: Tool = {
  name: 'write-spec-doc',
  description:
    'Validate phase gates and write a spec document. Use instead of Write for spec files.',
  inputSchema: {
    type: 'object',
    properties: {
      specName: {
        type: 'string',
        description: 'Spec name: {ISSUE-ID}-{kebab-title}',
      },
      documentType: {
        type: 'string',
        enum: ['requirements', 'discovery', 'design', 'tasks', 'test-checklist'],
        description: 'Type of spec document to write',
      },
      content: {
        type: 'string',
        description: 'Full markdown content of the document',
      },
      projectPath: {
        type: 'string',
        description: 'Project root path (optional, uses server context if omitted)',
      },
    },
    required: ['specName', 'documentType', 'content'],
  },
};

export async function writeSpecDocHandler(
  args: {
    specName: string;
    documentType: 'requirements' | 'discovery' | 'design' | 'tasks' | 'test-checklist';
    content: string;
    projectPath?: string;
  },
  context: ToolContext,
): Promise<ToolResponse> {
  const { specName, documentType, content } = args;
  const projectPath = args.projectPath || context.projectPath;

  const validDocTypes = ['requirements', 'discovery', 'design', 'tasks', 'test-checklist'];
  if (!validDocTypes.includes(documentType)) {
    return {
      success: false,
      message: `documentType must be one of: ${validDocTypes.join(', ')}`,
    };
  }

  if (
    !specName ||
    specName === '.' ||
    specName.includes('..') ||
    specName.includes('/') ||
    specName.includes('\\')
  ) {
    return {
      success: false,
      message: `Invalid specName: must not be "." and must not contain "..", "/", or "\\"`,
    };
  }

  let workflowRoot: string;
  try {
    await validateProjectPath(projectPath);
    workflowRoot = PathUtils.getWorkflowRoot(projectPath);
  } catch (error: any) {
    return {
      success: false,
      message: `Project path validation failed: ${error.message}`,
    };
  }

  // Run phase gates
  let gateResult;
  try {
    gateResult = await validatePhaseGates({
      specName,
      documentType,
      workflowRoot,
    });
  } catch (error: any) {
    return {
      success: false,
      message: `Phase gate validation failed: ${error.message}`,
    };
  }

  if (!gateResult.passed) {
    return {
      success: false,
      message: `${gateResult.gate}: ${gateResult.message}`,
      data: { gate: gateResult.gate },
    };
  }

  // Write the document
  const specDir = join(workflowRoot, 'specs', specName);
  const filePath = join(specDir, `${documentType}.md`);

  try {
    await mkdir(specDir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, filePath);
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to write document: ${error.message}`,
    };
  }

  return {
    success: true,
    message: `${documentType} document written successfully`,
    data: { filePath, specDir },
    nextSteps: ['Request approval using mcp__specflow__approvals'],
  };
}
