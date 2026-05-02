import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { PromptDefinition } from './types.js';
import { ToolContext } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { access, readFile } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

const prompt: Prompt = {
  name: 'create-spec',
  title: 'Create Specification Document',
  description:
    'Guide for creating spec documents directly in the file system. Shows how to use templates and create requirements, design, or tasks documents at the correct paths.',
  arguments: [
    {
      name: 'specName',
      description:
        'Spec name with issue prefix: {ISSUE-ID}-{kebab-title} (e.g., STAK-123-user-authentication). Must start with an issue ID pattern like STAK-123-.',
      required: true,
    },
    {
      name: 'documentType',
      description: 'Type of document to create: requirements, discovery, design, or tasks',
      required: true,
    },
    {
      name: 'description',
      description: 'Brief description of what this spec should accomplish',
      required: false,
    },
  ],
};

async function handler(args: Record<string, any>, context: ToolContext): Promise<PromptMessage[]> {
  const { specName, documentType, description } = args;

  if (!specName || !documentType) {
    throw new Error('specName and documentType are required arguments');
  }

  const validDocTypes = ['requirements', 'discovery', 'design', 'tasks'];
  if (!validDocTypes.includes(documentType)) {
    throw new Error(`documentType must be one of: ${validDocTypes.join(', ')}`);
  }

  // --- HARD GATE G1: Validate issue ID format for requirements ---
  if (documentType === 'requirements') {
    const issueIdPattern = /^[A-Z]+-\d+-/;
    if (!issueIdPattern.test(specName)) {
      throw new Error(
        `PHASE GATE: Cannot create requirements — specName "${specName}" does not start with an issue ID.\n` +
          `Expected format: {ISSUE-ID}-{kebab-title} (e.g., STAK-123-user-authentication).\n` +
          `Create an issue first, then use its ID as the spec name prefix.`,
      );
    }
  }

  // Resolve paths through PathUtils (DocVault-aware)
  const workflowRoot = PathUtils.getWorkflowRoot(context.projectPath);
  const templatesDir = `${workflowRoot}/templates`;
  const specDir = `${workflowRoot}/specs/${specName}`;

  // --- HARD GATES G2-G4: Enforce phase ordering ---
  // Phase ordering: Requirements → Discovery (optional) → Design → Tasks
  // discovery requires approved requirements (G2)
  // design requires approved discovery if it exists, else approved requirements (G3)
  // tasks requires approved design (G4)
  const prerequisites: Record<string, { requires: string; label: string }> = {
    discovery: { requires: 'requirements', label: 'Requirements' },
    design: { requires: 'requirements', label: 'Requirements' },
    tasks: { requires: 'design', label: 'Design' },
  };

  const prereq = prerequisites[documentType];
  if (prereq) {
    // Helper: check if a document exists and has an approved snapshot
    const checkPrereq = async (
      docName: string,
    ): Promise<{ exists: boolean; approved: boolean }> => {
      const docPath = join(specDir, `${docName}.md`);
      let exists = false;
      try {
        await access(docPath, constants.F_OK);
        exists = true;
      } catch {
        // file doesn't exist
      }
      if (!exists) return { exists: false, approved: false };

      const snapshotDir = join(workflowRoot, 'approvals', specName, '.snapshots', `${docName}.md`);
      let approved = false;
      try {
        await access(snapshotDir, constants.F_OK);
        const metadataPath = join(snapshotDir, 'metadata.json');
        const metadata = JSON.parse(await readFile(metadataPath, 'utf-8'));
        const snapshots = metadata.snapshots || [];
        const latest = snapshots[snapshots.length - 1];
        approved = latest?.trigger === 'approved';
      } catch {
        // No snapshots found
      }
      return { exists, approved };
    };

    // Gate G3 special case: design checks discovery first (if it exists), then requirements
    if (documentType === 'design') {
      const discovery = await checkPrereq('discovery');
      if (discovery.exists && !discovery.approved) {
        throw new Error(
          `PHASE GATE: Cannot create design — Discovery has not been approved yet.\n` +
            `The discovery.md document exists but has no approval record.\n` +
            `Submit it for approval first: use the approvals tool with action:"request" for discovery.md,\n` +
            `then wait for approval before creating design.`,
        );
      }
    }

    // Standard prerequisite check (applies to all gated types)
    const result = await checkPrereq(prereq.requires);

    if (!result.exists) {
      throw new Error(
        `PHASE GATE: Cannot create ${documentType} — ${prereq.label} document does not exist yet.\n` +
          `Expected: ${join(specDir, `${prereq.requires}.md`)}\n` +
          `You must create and get approval for ${prereq.requires}.md before proceeding to ${documentType}.`,
      );
    }

    if (!result.approved) {
      throw new Error(
        `PHASE GATE: Cannot create ${documentType} — ${prereq.label} has not been approved yet.\n` +
          `The ${prereq.requires}.md document exists but has no approval record.\n` +
          `Submit it for approval first: use the approvals tool with action:"request" for ${prereq.requires}.md,\n` +
          `then wait for approval before creating ${documentType}.`,
      );
    }
  }

  // Build context-aware messages
  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Create a ${documentType} document for the "${specName}" feature using the spec-workflow methodology.

**Context:**
- Project: ${context.projectPath}
- Feature: ${specName}
- Document type: ${documentType}
${description ? `- Description: ${description}` : ''}
${context.dashboardUrl ? `- Dashboard: ${context.dashboardUrl}` : ''}

**Instructions:**
1. First, read the template at: ${templatesDir}/${documentType}-template.md
2. Follow the template structure exactly - this ensures consistency across the project
3. Create comprehensive content that follows spec-driven development best practices
4. Include all required sections from the template
5. Use clear, actionable language
6. Create the document at: ${specDir}/${documentType}.md
7. After creating, use approvals tool with action:'request' to get user approval

**File Paths:**
- Template location: ${templatesDir}/${documentType}-template.md
- Document destination: ${specDir}/${documentType}.md

**Workflow Guidelines:**
- Requirements documents define WHAT needs to be built
- Design documents define HOW it will be built
- Tasks documents break down implementation into actionable steps
- Each document builds upon the previous one in sequence
- Templates are automatically updated on server start

${
  documentType === 'requirements'
    ? `
**Content Boundary — Requirements define WHAT, not HOW:**
- DO include: user stories, acceptance criteria (EARS format), measurable NFR targets, open questions
- Do NOT include: API designs, component architecture, function signatures, code examples, implementation patterns, database schemas, technology choices
- These implementation details belong in the Design document (Phase 2)
- If you find yourself writing function names, class hierarchies, or architecture diagrams, you have crossed into design territory — stop and move that content to design.md
`
    : ''
}
${
  documentType === 'tasks'
    ? `
**Special Instructions for Tasks Document:**
- For each task, generate a _Prompt field with structured AI guidance
- Format: _Prompt: Role: [role] | Task: [description] | Restrictions: [constraints] | Success: [criteria]
- Make prompts specific to the project context and requirements
- Include _Leverage fields pointing to existing code to reuse
- Include _Requirements fields showing which requirements each task implements
- Tasks should be atomic (1-3 files each) and in logical order

**Implementation Logging:**
- When implementing tasks, developers will use the log-implementation tool to record what was done
- Implementation logs appear in the dashboard's "Logs" tab for easy reference
- These logs prevent implementation details from being lost in chat history
- Good task descriptions help developers write better implementation summaries
`
    : ''
}

Please read the ${documentType} template and create the comprehensive document at the specified path.`,
      },
    },
  ];

  return messages;
}

export const createSpecPrompt: PromptDefinition = {
  prompt,
  handler,
};
