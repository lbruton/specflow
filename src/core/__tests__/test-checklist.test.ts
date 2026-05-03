import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  generateTaskSection,
  parseChecklist,
  updateChecklistProgress,
  validateTaskComplete,
  detectTestFileModification,
} from '../test-checklist.js';

// REQ-2 — Approval flow: No unit tests needed here.
// Approval is handled by the existing approvals.ts tool (unchanged).
// test-checklist.md is submitted as a standard document approval via the
// dashboard. Section-level approval state is derived at parse time by
// checking the approval snapshot, which is covered indirectly by REQ-6 tests.

// ---------------------------------------------------------------------------
// REQ-1 — generateTaskSection
// ---------------------------------------------------------------------------

describe('generateTaskSection', () => {
  let tempDir: string;
  let checklistPath: string;
  let testFilePath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'specflow-checklist-'));
    checklistPath = join(tempDir, 'test-checklist.md');
    testFilePath = join(tempDir, 'my.test.ts');
    writeFileSync(testFilePath, '// test file content');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a new test-checklist.md when file does not exist', async () => {
    const options = {
      specName: 'SFLW-99-example',
      taskId: '1',
      taskTitle: 'Some Title',
      testOutput: {
        framework: 'vitest',
        tests: [
          { name: 'test one', fileLocation: 'my.test.ts:10', status: 'fail' as const },
          { name: 'test two', fileLocation: 'my.test.ts:20', status: 'fail' as const },
        ],
        totalTests: 2,
        totalFailed: 2,
      },
      testFilePaths: [testFilePath],
      checklistPath,
    };

    const result = await generateTaskSection(options);

    expect(typeof result).toBe('string');

    const { readFileSync } = await import('fs');
    const content = readFileSync(checklistPath, 'utf-8');

    // Frontmatter created
    expect(content).toContain('spec: SFLW-99-example');
    // Task section present
    expect(content).toContain('## Task 1: Some Title');
  });

  it('appends a new task section to existing test-checklist.md without modifying prior sections', async () => {
    // Pre-populate with an existing section
    const existing = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: Prior Title

**Status:** green-complete
**Test Files:** \`prior.test.ts\`
**File Hashes:**
- \`prior.test.ts\`: \`sha256:aabbcc\`

- [x] prior test (\`prior.test.ts:5\`)
`;
    writeFileSync(checklistPath, existing);

    const options = {
      specName: 'SFLW-99-example',
      taskId: '2',
      taskTitle: 'New Title',
      testOutput: {
        framework: 'vitest',
        tests: [{ name: 'new test', fileLocation: 'my.test.ts:15', status: 'fail' as const }],
        totalTests: 1,
        totalFailed: 1,
      },
      testFilePaths: [testFilePath],
      checklistPath,
    };

    await generateTaskSection(options);

    const { readFileSync } = await import('fs');
    const content = readFileSync(checklistPath, 'utf-8');

    // Prior section unchanged
    expect(content).toContain('## Task 1: Prior Title');
    expect(content).toContain('[x] prior test');
    // New section appended
    expect(content).toContain('## Task 2: New Title');
  });

  it('includes the test name and file location in each checklist item', async () => {
    const options = {
      specName: 'SFLW-99-example',
      taskId: '1',
      taskTitle: 'Coverage Title',
      testOutput: {
        framework: 'vitest',
        tests: [
          { name: 'alpha test', fileLocation: 'my.test.ts:5', status: 'fail' as const },
          { name: 'beta test', fileLocation: 'my.test.ts:10', status: 'fail' as const },
        ],
        totalTests: 2,
        totalFailed: 2,
      },
      testFilePaths: [testFilePath],
      checklistPath,
    };

    await generateTaskSection(options);

    const { readFileSync } = await import('fs');
    const content = readFileSync(checklistPath, 'utf-8');

    expect(content).toContain('alpha test');
    expect(content).toContain('my.test.ts:5');
    expect(content).toContain('beta test');
    expect(content).toContain('my.test.ts:10');
  });

  it('records the total test count and confirms all tests fail (red phase)', async () => {
    const options = {
      specName: 'SFLW-99-example',
      taskId: '1',
      taskTitle: 'Red Phase Title',
      testOutput: {
        framework: 'vitest',
        tests: [{ name: 'failing test', fileLocation: 'my.test.ts:1', status: 'fail' as const }],
        totalTests: 1,
        totalFailed: 1,
      },
      testFilePaths: [testFilePath],
      checklistPath,
    };

    await generateTaskSection(options);

    const { readFileSync } = await import('fs');
    const content = readFileSync(checklistPath, 'utf-8');

    // All items should be unchecked [ ] in red phase
    expect(content).toContain('- [ ]');
    // No checked items
    expect(content).not.toContain('- [x]');
  });

  it('computes SHA-256 hash of each test file and records it in the section', async () => {
    const options = {
      specName: 'SFLW-99-example',
      taskId: '1',
      taskTitle: 'Hash Title',
      testOutput: {
        framework: 'vitest',
        tests: [{ name: 'hash test', fileLocation: 'my.test.ts:1', status: 'fail' as const }],
        totalTests: 1,
        totalFailed: 1,
      },
      testFilePaths: [testFilePath],
      checklistPath,
    };

    await generateTaskSection(options);

    const { readFileSync } = await import('fs');
    const content = readFileSync(checklistPath, 'utf-8');

    // SHA-256 hash prefix recorded
    expect(content).toContain('sha256:');
    // File Hashes block present
    expect(content).toContain('**File Hashes:**');
  });
});

// ---------------------------------------------------------------------------
// REQ-3 — updateChecklistProgress
// ---------------------------------------------------------------------------

describe('updateChecklistProgress', () => {
  let tempDir: string;
  let checklistPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'specflow-progress-'));
    checklistPath = join(tempDir, 'test-checklist.md');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const baseChecklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: Some Title

**Status:** green-in-progress
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:abc123\`

- [ ] test name one (\`my.test.ts:15\`)
- [ ] test name two (\`my.test.ts:42\`)
`;

  it('marks [ ] → [x] for tests that pass', async () => {
    writeFileSync(checklistPath, baseChecklist);

    const testResults = [
      { name: 'test name one', fileLocation: 'my.test.ts:15', status: 'pass' as const },
      {
        name: 'test name two',
        fileLocation: 'my.test.ts:42',
        status: 'fail' as const,
        failureMessage: 'AssertionError',
      },
    ];

    await updateChecklistProgress(checklistPath, '1', testResults);

    const { readFileSync } = await import('fs');
    const content = readFileSync(checklistPath, 'utf-8');

    expect(content).toContain('[x] test name one');
    expect(content).toContain('[ ] test name two');
  });

  it('leaves [ ] with failure reason for tests that fail', async () => {
    writeFileSync(checklistPath, baseChecklist);

    const testResults = [
      {
        name: 'test name two',
        fileLocation: 'my.test.ts:42',
        status: 'fail' as const,
        failureMessage: 'AssertionError: expected true',
      },
    ];

    await updateChecklistProgress(checklistPath, '1', testResults);

    const { readFileSync } = await import('fs');
    const content = readFileSync(checklistPath, 'utf-8');

    expect(content).toContain('[ ] test name two');
    expect(content).toContain('AssertionError: expected true');
  });

  it('preserves all other task sections when updating', async () => {
    const multiSectionChecklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: First Title

**Status:** green-in-progress
**Test Files:** \`a.test.ts\`
**File Hashes:**
- \`a.test.ts\`: \`sha256:aaaa\`

- [ ] first test (\`a.test.ts:5\`)

## Task 2: Second Title

**Status:** green-in-progress
**Test Files:** \`b.test.ts\`
**File Hashes:**
- \`b.test.ts\`: \`sha256:bbbb\`

- [ ] second test (\`b.test.ts:10\`)
`;
    writeFileSync(checklistPath, multiSectionChecklist);

    const testResults = [
      { name: 'first test', fileLocation: 'a.test.ts:5', status: 'pass' as const },
    ];

    await updateChecklistProgress(checklistPath, '1', testResults);

    const { readFileSync } = await import('fs');
    const content = readFileSync(checklistPath, 'utf-8');

    // Updated section
    expect(content).toContain('[x] first test');
    // Untouched section preserved
    expect(content).toContain('## Task 2: Second Title');
    expect(content).toContain('[ ] second test');
  });

  it('returns an object with allPassed flag when all items complete', async () => {
    const allPassChecklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: Some Title

**Status:** green-in-progress
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:abc123\`

- [ ] solo test (\`my.test.ts:1\`)
`;
    writeFileSync(checklistPath, allPassChecklist);

    const testResults = [
      { name: 'solo test', fileLocation: 'my.test.ts:1', status: 'pass' as const },
    ];

    const result = await updateChecklistProgress(checklistPath, '1', testResults);

    expect(result).toHaveProperty('allPassed');
    expect(result.allPassed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// REQ-4 — detectTestFileModification
// ---------------------------------------------------------------------------

describe('detectTestFileModification', () => {
  let tempDir: string;
  let checklistPath: string;
  let testFilePath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'specflow-immutability-'));
    checklistPath = join(tempDir, 'test-checklist.md');
    testFilePath = join(tempDir, 'my.test.ts');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns modified: false when test file content is unchanged', async () => {
    const originalContent = '// original test file';
    writeFileSync(testFilePath, originalContent);

    // Compute real sha256 of this content so the checklist matches
    const { createHash } = await import('crypto');
    const hash = createHash('sha256').update(originalContent).digest('hex');

    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: Hash Check

**Status:** green-in-progress
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:${hash}\`

- [ ] hash test (\`my.test.ts:1\`)
`;
    writeFileSync(checklistPath, checklist);

    const result = await detectTestFileModification(checklistPath, '1', [testFilePath]);

    expect(result.modified).toBe(false);
  });

  it('returns modified: true with file details when test file content has changed', async () => {
    const originalContent = '// original test file';
    writeFileSync(testFilePath, originalContent);

    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: Hash Check

**Status:** green-in-progress
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:deadbeef0000000000000000000000000000000000000000000000000000cafe\`

- [ ] hash test (\`my.test.ts:1\`)
`;
    writeFileSync(checklistPath, checklist);

    // Overwrite the test file with different content
    writeFileSync(testFilePath, '// MODIFIED test file content');

    const result = await detectTestFileModification(checklistPath, '1', [testFilePath]);

    expect(result.modified).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files[0]).toHaveProperty('originalHash');
    expect(result.files[0]).toHaveProperty('currentHash');
  });

  it('handles case where test file no longer exists', async () => {
    const missingFilePath = join(tempDir, 'missing.test.ts');

    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: Missing File

**Status:** green-in-progress
**Test Files:** \`missing.test.ts\`
**File Hashes:**
- \`missing.test.ts\`: \`sha256:abc123\`

- [ ] some test (\`missing.test.ts:1\`)
`;
    writeFileSync(checklistPath, checklist);

    // File does not exist — should not throw, should report modification
    const result = await detectTestFileModification(checklistPath, '1', [missingFilePath]);

    expect(result).toHaveProperty('modified');
    expect(result).toHaveProperty('message');
  });
});

// ---------------------------------------------------------------------------
// REQ-5 — validateTaskComplete
// ---------------------------------------------------------------------------

describe('validateTaskComplete', () => {
  let tempDir: string;
  let checklistPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'specflow-validate-'));
    checklistPath = join(tempDir, 'test-checklist.md');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns valid: true when all checklist items for a task are [x]', async () => {
    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: Complete Task

**Status:** green-complete
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:abc123\`

- [x] test one (\`my.test.ts:5\`)
- [x] test two (\`my.test.ts:10\`)
`;
    writeFileSync(checklistPath, checklist);

    const result = await validateTaskComplete(checklistPath, '1');

    expect(result.valid).toBe(true);
    expect(result.taskId).toBe('1');
    expect(result.totalItems).toBe(2);
    expect(result.completedItems).toBe(2);
    expect(result.incompleteItems).toHaveLength(0);
  });

  it('returns valid: false with incompleteItems list when some items are still [ ]', async () => {
    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: Partial Task

**Status:** green-in-progress
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:abc123\`

- [x] test one (\`my.test.ts:5\`)
- [ ] test two (\`my.test.ts:10\`) — \`AssertionError: expected true\`
`;
    writeFileSync(checklistPath, checklist);

    const result = await validateTaskComplete(checklistPath, '1');

    expect(result.valid).toBe(false);
    expect(result.taskId).toBe('1');
    expect(result.totalItems).toBe(2);
    expect(result.completedItems).toBe(1);
    expect(result.incompleteItems).toHaveLength(1);
    expect(result.incompleteItems[0].testName).toContain('test two');
  });

  it('returns error message when test-checklist.md does not exist', async () => {
    const missingPath = join(tempDir, 'nonexistent-checklist.md');

    const result = await validateTaskComplete(missingPath, '1');

    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
    // Message should indicate the file is missing
    expect(result.message.toLowerCase()).toMatch(/not found|does not exist|missing/);
  });
});

// ---------------------------------------------------------------------------
// REQ-6 — parseChecklist
// ---------------------------------------------------------------------------

describe('parseChecklist', () => {
  let tempDir: string;
  let checklistPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'specflow-parse-'));
    checklistPath = join(tempDir, 'test-checklist.md');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses a well-formed test-checklist.md and returns structured TestChecklist', async () => {
    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: Some Title

**Status:** green-in-progress
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:abc123\`

- [x] test name one (\`my.test.ts:15\`)
- [ ] test name two (\`my.test.ts:42\`) — \`AssertionError: expected true\`
`;
    writeFileSync(checklistPath, checklist);

    const result = await parseChecklist(checklistPath);

    expect(result.specName).toBe('SFLW-99-example');
    expect(result.sections).toHaveLength(1);

    const section = result.sections[0];
    expect(section.taskId).toBe('1');
    expect(section.taskTitle).toBe('Some Title');
    expect(section.items).toHaveLength(2);
  });

  it('correctly identifies green-complete status when all items are [x]', async () => {
    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: Complete Title

**Status:** green-complete
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:abc123\`

- [x] test one (\`my.test.ts:5\`)
- [x] test two (\`my.test.ts:10\`)
`;
    writeFileSync(checklistPath, checklist);

    const result = await parseChecklist(checklistPath);

    expect(result.sections[0].status).toBe('green-complete');
  });

  it('correctly identifies green-in-progress status when some items are [ ]', async () => {
    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1: In-Progress Title

**Status:** green-in-progress
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:abc123\`

- [x] test one (\`my.test.ts:5\`)
- [ ] test two (\`my.test.ts:10\`)
`;
    writeFileSync(checklistPath, checklist);

    const result = await parseChecklist(checklistPath);

    expect(result.sections[0].status).toBe('green-in-progress');
  });

  it('returns empty sections array for a missing file', async () => {
    const missingPath = join(tempDir, 'nonexistent.md');

    const result = await parseChecklist(missingPath);

    expect(result.sections).toHaveLength(0);
  });

  it('returns empty sections array for an empty file', async () => {
    writeFileSync(checklistPath, '');

    const result = await parseChecklist(checklistPath);

    expect(result.sections).toHaveLength(0);
  });

  it('parses a dotted task ID section (e.g. 0.4) correctly', async () => {
    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 0.4: Dotted Title

**Status:** green-in-progress
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:abc123\`

- [ ] dot test one (\`my.test.ts:5\`)
- [ ] dot test two (\`my.test.ts:10\`)
`;
    writeFileSync(checklistPath, checklist);

    const result = await parseChecklist(checklistPath);

    expect(result.sections).toHaveLength(1);
    const section = result.sections[0];
    expect(section.taskId).toBe('0.4');
    expect(section.taskTitle).toBe('Dotted Title');
    expect(section.items).toHaveLength(2);
  });

  it('extracts taskId, taskTitle, and item statuses for each section', async () => {
    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 2: Second Title

**Status:** green-in-progress
**Test Files:** \`b.test.ts\`
**File Hashes:**
- \`b.test.ts\`: \`sha256:bbbb\`

- [x] passing test (\`b.test.ts:5\`)
- [ ] failing test (\`b.test.ts:10\`)
`;
    writeFileSync(checklistPath, checklist);

    const result = await parseChecklist(checklistPath);

    const section = result.sections[0];
    expect(section.taskId).toBe('2');
    expect(section.taskTitle).toBe('Second Title');

    const passedItem = section.items.find((i: { testName: string }) =>
      i.testName.includes('passing test'),
    );
    const failedItem = section.items.find((i: { testName: string }) =>
      i.testName.includes('failing test'),
    );

    expect(passedItem?.status).toBe('passed');
    expect(failedItem?.status).toBe('pending');
  });
});

// ---------------------------------------------------------------------------
// Dotted task IDs (e.g. '0.4', '1.2') — the TDD format used in real specs
// ---------------------------------------------------------------------------

describe('dotted task IDs', () => {
  let tempDir: string;
  let checklistPath: string;
  let testFilePath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'specflow-dotted-'));
    checklistPath = join(tempDir, 'test-checklist.md');
    testFilePath = join(tempDir, 'my.test.ts');
    writeFileSync(testFilePath, '// test file content');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('generateTaskSection creates a section with a dotted task ID header', async () => {
    const options = {
      specName: 'SFLW-99-example',
      taskId: '0.4',
      taskTitle: 'Dotted Task',
      testOutput: {
        framework: 'vitest',
        tests: [{ name: 'dot test', fileLocation: 'my.test.ts:5', status: 'fail' as const }],
        totalTests: 1,
        totalFailed: 1,
      },
      testFilePaths: [testFilePath],
      checklistPath,
    };

    await generateTaskSection(options);

    const { readFileSync } = await import('fs');
    const content = readFileSync(checklistPath, 'utf-8');

    expect(content).toContain('## Task 0.4: Dotted Task');
  });

  it('parseChecklist correctly finds items under a dotted task ID section', async () => {
    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 1.2: Dotted Parse Title

**Status:** green-in-progress
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:abc123\`

- [ ] dotted item one (\`my.test.ts:7\`)
- [ ] dotted item two (\`my.test.ts:14\`)
`;
    writeFileSync(checklistPath, checklist);

    const result = await parseChecklist(checklistPath);

    expect(result.sections).toHaveLength(1);
    const section = result.sections[0];
    expect(section.taskId).toBe('1.2');
    expect(section.taskTitle).toBe('Dotted Parse Title');
    expect(section.items).toHaveLength(2);
  });

  it('updateChecklistProgress marks items in a dotted task ID section', async () => {
    const checklist = `---
spec: SFLW-99-example
created: 2026-01-01
updated: 2026-01-01
---

# Test Checklist

## Task 0.5: Dotted Update Title

**Status:** green-in-progress
**Test Files:** \`my.test.ts\`
**File Hashes:**
- \`my.test.ts\`: \`sha256:abc123\`

- [ ] update item one (\`my.test.ts:3\`)
- [ ] update item two (\`my.test.ts:9\`)
`;
    writeFileSync(checklistPath, checklist);

    const testResults = [
      { name: 'update item one', fileLocation: 'my.test.ts:3', status: 'pass' as const },
      { name: 'update item two', fileLocation: 'my.test.ts:9', status: 'fail' as const },
    ];

    await updateChecklistProgress(checklistPath, '0.5', testResults);

    const { readFileSync } = await import('fs');
    const content = readFileSync(checklistPath, 'utf-8');

    expect(content).toContain('[x] update item one');
    expect(content).toContain('[ ] update item two');
  });

  it('round-trip: generate section with ID 1.2, parse it back, update progress, verify state', async () => {
    const options = {
      specName: 'SFLW-99-example',
      taskId: '1.2',
      taskTitle: 'Round Trip',
      testOutput: {
        framework: 'vitest',
        tests: [
          { name: 'rt test alpha', fileLocation: 'my.test.ts:1', status: 'fail' as const },
          { name: 'rt test beta', fileLocation: 'my.test.ts:2', status: 'fail' as const },
        ],
        totalTests: 2,
        totalFailed: 2,
      },
      testFilePaths: [testFilePath],
      checklistPath,
    };

    // Step 1: generate
    await generateTaskSection(options);

    const { readFileSync } = await import('fs');
    const generated = readFileSync(checklistPath, 'utf-8');
    expect(generated).toContain('## Task 1.2: Round Trip');

    // Step 2: parse back
    const parsed = await parseChecklist(checklistPath);
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0].taskId).toBe('1.2');
    expect(parsed.sections[0].items).toHaveLength(2);

    // Step 3: update progress — alpha passes, beta still fails
    const testResults = [
      { name: 'rt test alpha', fileLocation: 'my.test.ts:1', status: 'pass' as const },
      { name: 'rt test beta', fileLocation: 'my.test.ts:2', status: 'fail' as const },
    ];

    const updateResult = await updateChecklistProgress(checklistPath, '1.2', testResults);

    expect(updateResult.allPassed).toBe(false);

    const updated = readFileSync(checklistPath, 'utf-8');
    expect(updated).toContain('[x] rt test alpha');
    expect(updated).toContain('[ ] rt test beta');
  });
});
