import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { validatePhaseGates } from '../core/phase-gates.js';
import { PathUtils, validateProjectPath } from '../core/path-utils.js';
import { mkdir, writeFile } from 'fs/promises';
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
        enum: ['requirements', 'discovery', 'design', 'tasks'],
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
    documentType: 'requirements' | 'discovery' | 'design' | 'tasks';
    content: string;
    projectPath?: string;
  },
  context: ToolContext,
): Promise<ToolResponse> {
  const { specName, documentType, content } = args;
  const projectPath = args.projectPath || context.projectPath;

  const validDocTypes = ['requirements', 'discovery', 'design', 'tasks'];
  if (!validDocTypes.includes(documentType)) {
    return {
      success: false,
      message: `documentType must be one of: ${validDocTypes.join(', ')}`,
    };
  }

  if (
    !specName ||
    specName.includes('..') ||
    specName.includes('/') ||
    specName.includes('\\') ||
    specName.startsWith('/')
  ) {
    return {
      success: false,
      message: `Invalid specName: must not contain "..", "/", or "\\"`,
    };
  }

  await validateProjectPath(projectPath);
  const workflowRoot = PathUtils.getWorkflowRoot(projectPath);

  // Run phase gates
  const gateResult = await validatePhaseGates({
    specName,
    documentType,
    workflowRoot,
  });

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
    await writeFile(filePath, content, 'utf-8');
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
