import { readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import type {
  GenerateOptions,
  TestChecklist,
  TestChecklistItem,
  TestResult,
  UpdateResult,
  ValidationResult,
  ModificationResult,
  TestChecklistSection,
} from '../types.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function validateFilePath(p: string): void {
  if (!p || typeof p !== 'string') throw new Error(`Invalid path: expected non-empty string`);
  const normalized = p.replace(/\\/g, '/');
  // T1: check for bare '..' components, not just '../' or '/..'
  if (normalized.split('/').some((part) => part === '..')) {
    throw new Error(`Path traversal detected: "${p}" contains ".."`);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

// ── REQ-1: generateTaskSection ────────────────────────────────────────────────

export async function generateTaskSection(options: GenerateOptions): Promise<string> {
  const { specName, taskId, taskTitle, testOutput, testFilePaths, checklistPath } = options;

  validateFilePath(checklistPath);
  testFilePaths.forEach(validateFilePath);

  const today = todayString();

  // Build hash block
  // T6/T10: store full path instead of basename to avoid collisions
  const hashLines: string[] = [];
  const fileLabels: string[] = [];
  for (const filePath of testFilePaths) {
    const hash = await sha256File(filePath);
    fileLabels.push(filePath);
    hashLines.push('- `' + filePath + '`: `sha256:' + hash + '`');
  }

  // Build checklist items — all [ ] in red phase
  const itemLines: string[] = [];
  for (const test of testOutput.tests) {
    itemLines.push('- [ ] ' + test.name + ' (`' + test.fileLocation + '`)');
  }

  // Build new section text
  const testFilesLabel = fileLabels.length > 0 ? fileLabels[0] : '';
  const sectionLines = [
    '## Task ' + taskId + ': ' + taskTitle,
    '',
    '**Status:** green-in-progress',
    '**Test Files:** `' + testFilesLabel + '`',
    '**File Hashes:**',
    ...hashLines,
    '',
    ...itemLines,
    '',
  ];
  const sectionText = sectionLines.join('\n');

  const exists = await fileExists(checklistPath);

  if (!exists) {
    // Create new file with frontmatter
    const frontmatter = [
      '---',
      'spec: ' + specName,
      'created: ' + today,
      'updated: ' + today,
      '---',
      '',
      '# Test Checklist',
      '',
    ].join('\n');
    await writeFile(checklistPath, frontmatter + sectionText, 'utf-8');
  } else {
    // T4: check if a section for this taskId already exists; if so, return unchanged
    const existing = await readFile(checklistPath, 'utf-8');
    const escapedId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const duplicateCheck = new RegExp('^## Task ' + escapedId + ':', 'm');
    if (duplicateCheck.test(existing)) {
      return checklistPath;
    }
    const separator = existing.endsWith('\n') ? '' : '\n';
    await writeFile(checklistPath, existing + separator + sectionText, 'utf-8');
  }

  return checklistPath;
}

// ── REQ-6: parseChecklist ─────────────────────────────────────────────────────

export async function parseChecklist(checklistPath: string): Promise<TestChecklist> {
  validateFilePath(checklistPath);

  const empty: TestChecklist = { specName: '', sections: [] };

  const exists = await fileExists(checklistPath);
  if (!exists) return empty;

  const content = await readFile(checklistPath, 'utf-8');
  if (!content.trim()) return empty;

  // Extract specName from YAML frontmatter
  // T5: support CRLF line endings
  let specName = '';
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (frontmatterMatch) {
    const fmBody = frontmatterMatch[1];
    const specMatch = fmBody.match(/^spec:\s*(.+)$/m);
    if (specMatch) {
      specName = specMatch[1].trim();
    }
  }

  // T11: Split into task sections by ## Task N.N: Title (dotted IDs supported)
  const sectionHeaderRegex = /^## Task ([\d.]+): (.+)$/m;
  const parts = content.split(/(?=^## Task [\d.]+:)/m);

  const sections: TestChecklistSection[] = [];

  for (const part of parts) {
    const headerMatch = part.match(sectionHeaderRegex);
    if (!headerMatch) continue;

    const taskId = headerMatch[1];
    const taskTitle = headerMatch[2].trim();

    // Parse checklist items
    // T2/T3: use greedy (.+) to avoid truncating test names containing '('
    const items: TestChecklistItem[] = [];
    const itemRegex = /^- (\[x\]|\[ \]) (.+) \(`([^`]+)`\)/gm;
    let itemMatch: RegExpExecArray | null;
    while ((itemMatch = itemRegex.exec(part)) !== null) {
      const checked = itemMatch[1] === '[x]';
      const testName = itemMatch[2].trim();
      const fileLocation = itemMatch[3];
      items.push({
        testName,
        fileLocation,
        status: checked ? 'passed' : 'pending',
      });
    }

    // Parse testFiles from File Hashes block
    const testFiles = [];
    const hashRegex = /^- `([^`]+)`: `sha256:([^`]+)`$/gm;
    let hashMatch: RegExpExecArray | null;
    while ((hashMatch = hashRegex.exec(part)) !== null) {
      testFiles.push({
        filePath: hashMatch[1],
        contentHash: hashMatch[2],
        recordedAt: '',
      });
    }

    // Derive status from items
    let status: TestChecklistSection['status'];
    if (items.length === 0) {
      status = 'red';
    } else if (items.every((i) => i.status === 'passed')) {
      status = 'green-complete';
    } else {
      status = 'green-in-progress';
    }

    sections.push({ taskId, taskTitle, status, testFiles, items });
  }

  return { specName, sections };
}

// ── REQ-3: updateChecklistProgress ───────────────────────────────────────────

export async function updateChecklistProgress(
  checklistPath: string,
  taskId: string,
  testResults: TestResult[],
): Promise<UpdateResult> {
  validateFilePath(checklistPath);

  try {
    await access(checklistPath);
  } catch {
    return { allPassed: false, updatedItems: 0 };
  }

  const content = await readFile(checklistPath, 'utf-8');

  // T12: use composite key (name@@fileLocation) to avoid same-named tests in different files colliding
  const resultMap = new Map<string, TestResult>();
  for (const r of testResults) {
    const key = r.name + '@@' + (r.fileLocation || '');
    resultMap.set(key, r);
  }

  let updatedItems = 0;
  let allPassed = true;

  // Process line by line to update the correct task section
  const lines = content.split('\n');
  let inTargetSection = false;
  // T11: support dotted task IDs in section header regex
  const sectionHeaderRegex = /^## Task ([\d.]+):/;
  // T2/T3: use greedy (.+) for test names containing '('
  const itemRegex = /^(- )(\[x\]|\[ \]) (.+) \(`([^`]+)`\)(.*)/;

  const newLines = lines.map((line) => {
    const headerMatch = line.match(sectionHeaderRegex);
    if (headerMatch) {
      inTargetSection = headerMatch[1] === taskId;
      return line;
    }

    if (!inTargetSection) return line;

    const itemMatch = line.match(itemRegex);
    if (!itemMatch) return line;

    const testName = itemMatch[3].trim();
    const fileLocation = itemMatch[4];
    // T12: look up by composite key; fall back to name-only (empty fileLocation) for backward compat
    const compositeKey = testName + '@@' + fileLocation;
    const result = resultMap.get(compositeKey) ?? resultMap.get(testName + '@@');

    if (result) {
      if (result.status === 'pass') {
        updatedItems++;
        return '- [x] ' + testName + ' (`' + fileLocation + '`)';
      } else {
        // fail — keep [ ] but append failure reason
        const failureNote = result.failureMessage ? ' — `' + result.failureMessage + '`' : '';
        allPassed = false;
        return '- [ ] ' + testName + ' (`' + fileLocation + '`)' + failureNote;
      }
    }

    // Not in results — check if still pending
    if (itemMatch[2] === '[ ]') {
      allPassed = false;
    }

    return line;
  });

  await writeFile(checklistPath, newLines.join('\n'), 'utf-8');

  return { allPassed, updatedItems };
}

// ── REQ-4: detectTestFileModification ────────────────────────────────────────

export async function detectTestFileModification(
  checklistPath: string,
  taskId: string,
  testFilePaths: string[],
): Promise<ModificationResult> {
  validateFilePath(checklistPath);
  testFilePaths.forEach(validateFilePath);

  const checklist = await parseChecklist(checklistPath);
  const section = checklist.sections.find((s) => s.taskId === taskId);

  if (!section) {
    return { modified: false, files: [], message: 'Task ' + taskId + ' not found in checklist' };
  }

  const modifiedFiles: ModificationResult['files'] = [];

  for (const filePath of testFilePaths) {
    // T6/T10: match on full path first (as stored by updated generateTaskSection);
    // fall back to basename for legacy checklists that stored basename only
    const name = basename(filePath);
    const record = section.testFiles.find((tf) => tf.filePath === filePath || tf.filePath === name);
    const originalHash = record?.contentHash ?? '';

    const exists = await fileExists(filePath);
    if (!exists) {
      modifiedFiles.push({ filePath, originalHash, currentHash: '' });
      continue;
    }

    const currentHash = await sha256File(filePath);
    if (currentHash !== originalHash) {
      modifiedFiles.push({ filePath, originalHash, currentHash });
    }
  }

  const modified = modifiedFiles.length > 0;
  return {
    modified,
    files: modifiedFiles,
    message: modified
      ? modifiedFiles.length + ' test file(s) have been modified since checklist was created'
      : 'No test file modifications detected',
  };
}

// ── REQ-5: validateTaskComplete ───────────────────────────────────────────────

export async function validateTaskComplete(
  checklistPath: string,
  taskId: string,
): Promise<ValidationResult> {
  validateFilePath(checklistPath);

  const exists = await fileExists(checklistPath);
  if (!exists) {
    return {
      valid: false,
      taskId,
      totalItems: 0,
      completedItems: 0,
      incompleteItems: [],
      message: 'Checklist not found: ' + checklistPath,
    };
  }

  const checklist = await parseChecklist(checklistPath);
  const section = checklist.sections.find((s) => s.taskId === taskId);

  if (!section) {
    return {
      valid: false,
      taskId,
      totalItems: 0,
      completedItems: 0,
      incompleteItems: [],
      message: 'Task ' + taskId + ' not found in checklist',
    };
  }

  const totalItems = section.items.length;
  const completedItems = section.items.filter((i) => i.status === 'passed').length;
  const incompleteItems = section.items.filter((i) => i.status !== 'passed');
  const valid = totalItems > 0 && incompleteItems.length === 0;

  return {
    valid,
    taskId,
    totalItems,
    completedItems,
    incompleteItems,
    message: valid
      ? 'All ' + totalItems + ' tests passed for task ' + taskId
      : totalItems === 0
        ? 'Task ' + taskId + ' checklist section has no items — cannot validate'
        : incompleteItems.length + ' of ' + totalItems + ' tests still pending for task ' + taskId,
  };
}
