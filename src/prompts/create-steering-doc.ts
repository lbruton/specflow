import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { PromptDefinition } from './types.js';
import { ToolContext } from '../types.js';
import { PathUtils } from '../core/path-utils.js';

const prompt: Prompt = {
  name: 'create-steering-doc',
  title: 'Create Steering Document',
  description: 'Guide for creating project steering documents (product, tech, structure) directly in the file system. These provide high-level project guidance.',
  arguments: [
    {
      name: 'docType',
      description: 'Type of steering document: product, tech, or structure',
      required: true
    },
    {
      name: 'scope',
      description: 'Scope of the steering document (e.g., frontend, backend, full-stack)',
      required: false
    }
  ]
};

async function handler(args: Record<string, any>, context: ToolContext): Promise<PromptMessage[]> {
  const { docType, scope } = args;
  
  if (!docType) {
    throw new Error('docType is a required argument');
  }

  const validDocTypes = ['product', 'tech', 'structure'];
  if (!validDocTypes.includes(docType)) {
    throw new Error(`docType must be one of: ${validDocTypes.join(', ')}`);
  }

  // Resolve paths through PathUtils (DocVault-aware)
  const workflowRoot = PathUtils.getWorkflowRoot(context.projectPath);
  const templatesDir = `${workflowRoot}/templates`;
  const steeringDir = `${workflowRoot}/steering`;

  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Create a ${docType} steering document for the project.

**Context:**
- Project: ${context.projectPath}
- Steering document type: ${docType}
${scope ? `- Scope: ${scope}` : ''}
${context.dashboardUrl ? `- Dashboard: ${context.dashboardUrl}` : ''}

**Instructions:**
1. First, read the template at: ${templatesDir}/${docType}-template.md
2. Check if steering docs exist at: ${steeringDir}/
3. Create comprehensive content following the template structure
4. Create the document at: ${steeringDir}/${docType}.md
5. After creating, use approvals tool with action:'request' to get user approval

**File Paths:**
- Template location: ${templatesDir}/${docType}-template.md
- Document destination: ${steeringDir}/${docType}.md

**Steering Document Types:**
- **product**: Defines project vision, goals, and user outcomes
- **tech**: Documents technology decisions and architecture patterns
- **structure**: Maps codebase organization and conventions

**Key Principles:**
- Be specific and actionable
- Include examples where helpful
- Consider both technical and business requirements
- Provide clear guidance for future development
- Templates are automatically updated on server start

Please read the ${docType} template and create a comprehensive steering document at the specified path.`
      }
    }
  ];

  return messages;
}

export const createSteeringDocPrompt: PromptDefinition = {
  prompt,
  handler
};