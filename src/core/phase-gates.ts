import { access, readFile } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

export interface GateResult {
  passed: boolean;
  gate: string;
  message: string;
}

export interface PhaseGateOptions {
  specName: string;
  documentType: 'requirements' | 'discovery' | 'design' | 'tasks';
  workflowRoot: string;
}

/**
 * Check whether an approval snapshot exists for a given document type
 * and whether the latest snapshot has trigger === "approved".
 *
 * `exists` reflects whether the metadata.json file is present on disk,
 * NOT whether the spec document itself exists.
 */
export async function checkApprovalStatus(
  workflowRoot: string,
  specName: string,
  docType: string,
): Promise<{ exists: boolean; approved: boolean }> {
  const metadataPath = join(
    workflowRoot,
    'approvals',
    specName,
    '.snapshots',
    `${docType}.md`,
    'metadata.json',
  );

  let raw: string;
  try {
    raw = await readFile(metadataPath, 'utf-8');
  } catch {
    // metadata.json does not exist
    return { exists: false, approved: false };
  }

  // File exists — parse it
  try {
    const metadata = JSON.parse(raw);
    const snapshots: unknown[] = metadata.snapshots || [];
    const latest = snapshots[snapshots.length - 1] as { trigger?: string } | undefined;
    return { exists: true, approved: latest?.trigger === 'approved' };
  } catch {
    // Malformed JSON
    return { exists: true, approved: false };
  }
}

/**
 * Check whether a spec document file exists on disk.
 */
async function specFileExists(
  workflowRoot: string,
  specName: string,
  docType: string,
): Promise<boolean> {
  const docPath = join(workflowRoot, 'specs', specName, `${docType}.md`);
  try {
    await access(docPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate phase gates for spec document creation.
 *
 * Gate ordering:
 *   requirements → G1 (issue ID pattern)
 *   discovery    → G2 (requirements must be approved)
 *   design       → G3 (requirements approved; if discovery exists on disk, it must also be approved)
 *   tasks        → G4 (design must be approved)
 */
export async function validatePhaseGates(options: PhaseGateOptions): Promise<GateResult> {
  const { specName, documentType, workflowRoot } = options;

  // --- G1: Issue ID pattern (requirements only) ---
  if (documentType === 'requirements') {
    const issueIdPattern = /^[A-Z]+-\d+-/;
    if (!issueIdPattern.test(specName)) {
      return {
        passed: false,
        gate: 'G1',
        message:
          `PHASE GATE: Cannot create requirements — specName "${specName}" does not start with an issue ID. ` +
          `Expected format: {ISSUE-ID}-{kebab-title} (e.g., STAK-123-user-authentication). ` +
          `Create an issue first, then use its ID as the spec name prefix.`,
      };
    }
    return {
      passed: true,
      gate: 'none',
      message: 'G1 passed — specName has a valid issue ID prefix.',
    };
  }

  // --- G2: Discovery requires approved requirements ---
  if (documentType === 'discovery') {
    const reqFileExists = await specFileExists(workflowRoot, specName, 'requirements');
    const requirements = await checkApprovalStatus(workflowRoot, specName, 'requirements');
    if (!reqFileExists || !requirements.approved) {
      return {
        passed: false,
        gate: 'G2',
        message:
          `PHASE GATE: Cannot create discovery — Requirements ${reqFileExists ? 'has not been approved yet' : 'document does not exist yet'}. ` +
          `You must create and get approval for requirements.md before proceeding to discovery.`,
      };
    }
    return {
      passed: true,
      gate: 'none',
      message: 'G2 passed — requirements.md is approved; discovery can proceed.',
    };
  }

  // --- G3: Design requires approved requirements (and approved discovery if it exists on disk) ---
  if (documentType === 'design') {
    const requirements = await checkApprovalStatus(workflowRoot, specName, 'requirements');
    const reqFileExists = await specFileExists(workflowRoot, specName, 'requirements');
    if (!reqFileExists || !requirements.approved) {
      return {
        passed: false,
        gate: 'G3',
        message:
          `PHASE GATE: Cannot create design — Requirements ${reqFileExists ? 'has not been approved yet' : 'document does not exist yet'}. ` +
          `You must create and get approval for requirements.md before proceeding to design.`,
      };
    }

    // If discovery.md exists on disk, it must also be approved
    const discoveryFileExists = await specFileExists(workflowRoot, specName, 'discovery');
    if (discoveryFileExists) {
      const discovery = await checkApprovalStatus(workflowRoot, specName, 'discovery');
      if (!discovery.approved) {
        return {
          passed: false,
          gate: 'G3',
          message:
            `PHASE GATE: Cannot create design — Discovery has not been approved yet. ` +
            `The discovery.md document exists but has no approval record. ` +
            `Submit it for approval first, then wait for approval before creating design.`,
        };
      }
    }

    return {
      passed: true,
      gate: 'none',
      message: 'G3 passed — all prerequisites approved; design can proceed.',
    };
  }

  // --- G4: Tasks requires approved design ---
  if (documentType === 'tasks') {
    const design = await checkApprovalStatus(workflowRoot, specName, 'design');
    const designFileExists = await specFileExists(workflowRoot, specName, 'design');
    if (!designFileExists || !design.approved) {
      return {
        passed: false,
        gate: 'G4',
        message:
          `PHASE GATE: Cannot create tasks — Design ${designFileExists ? 'has not been approved yet' : 'document does not exist yet'}. ` +
          `You must create and get approval for design.md before proceeding to tasks.`,
      };
    }
    return {
      passed: true,
      gate: 'none',
      message: 'G4 passed — design.md is approved; tasks can proceed.',
    };
  }

  // Fallback — reject unknown document types as a defense-in-depth measure
  return {
    passed: false,
    gate: 'G1',
    message: `PHASE GATE: Unknown document type "${documentType}". Must be one of: requirements, discovery, design, tasks.`,
  };
}
