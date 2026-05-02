import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { validatePhaseGates, checkApprovalStatus } from '../phase-gates.js';

describe('validatePhaseGates', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'specflow-gates-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('G1 — issue ID pattern', () => {
    it('rejects specName without issue ID pattern', async () => {
      const result = await validatePhaseGates({
        specName: 'no-issue-prefix',
        documentType: 'requirements',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(false);
      expect(result.gate).toBe('G1');
    });

    it('accepts valid specName with issue ID for requirements', async () => {
      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'requirements',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('G2 — discovery requires approved requirements', () => {
    it('rejects discovery when requirements.md is missing', async () => {
      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'discovery',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(false);
      expect(result.gate).toBe('G2');
    });

    it('rejects discovery when requirements.md exists but unapproved', async () => {
      // Create spec dir with requirements but no approval snapshot
      const specDir = join(tempDir, 'specs', 'STAK-123-feature');
      mkdirSync(specDir, { recursive: true });
      writeFileSync(join(specDir, 'requirements.md'), '# Requirements\n');

      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'discovery',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(false);
      expect(result.gate).toBe('G2');
    });

    it('allows discovery when requirements.md is approved', async () => {
      // Create the spec document file
      const specDir = join(tempDir, 'specs', 'STAK-123-feature');
      mkdirSync(specDir, { recursive: true });
      writeFileSync(join(specDir, 'requirements.md'), '# Requirements');

      // Create approved requirements snapshot
      const snapshotDir = join(
        tempDir,
        'approvals',
        'STAK-123-feature',
        '.snapshots',
        'requirements.md',
      );
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(
        join(snapshotDir, 'metadata.json'),
        JSON.stringify({
          filePath: 'specs/STAK-123-feature/requirements.md',
          currentVersion: 1,
          snapshots: [
            {
              version: 1,
              filename: 'snapshot-001.json',
              timestamp: '2026-01-01T00:00:00Z',
              trigger: 'approved',
              approvalId: 'test',
              approvalTitle: 'test',
            },
          ],
        }),
      );

      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'discovery',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('G3 — design requires approved requirements (and discovery if present)', () => {
    it('rejects design when requirements.md is missing', async () => {
      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'design',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(false);
      expect(result.gate).toBe('G3');
    });

    it('rejects design when requirements.md exists but unapproved', async () => {
      const specDir = join(tempDir, 'specs', 'STAK-123-feature');
      mkdirSync(specDir, { recursive: true });
      writeFileSync(join(specDir, 'requirements.md'), '# Requirements\n');

      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'design',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(false);
      expect(result.gate).toBe('G3');
    });

    it('rejects design when discovery.md exists but is unapproved', async () => {
      // Approved requirements
      const reqSnapshotDir = join(
        tempDir,
        'approvals',
        'STAK-123-feature',
        '.snapshots',
        'requirements.md',
      );
      mkdirSync(reqSnapshotDir, { recursive: true });
      writeFileSync(
        join(reqSnapshotDir, 'metadata.json'),
        JSON.stringify({
          filePath: 'specs/STAK-123-feature/requirements.md',
          currentVersion: 1,
          snapshots: [
            {
              version: 1,
              filename: 'snapshot-001.json',
              timestamp: '2026-01-01T00:00:00Z',
              trigger: 'approved',
              approvalId: 'test',
              approvalTitle: 'test',
            },
          ],
        }),
      );

      // Unapproved discovery — exists on disk but no approval snapshot
      const specDir = join(tempDir, 'specs', 'STAK-123-feature');
      mkdirSync(specDir, { recursive: true });
      writeFileSync(join(specDir, 'discovery.md'), '# Discovery\n');

      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'design',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(false);
      expect(result.gate).toBe('G3');
    });

    it('allows design when requirements.md is approved and no discovery exists', async () => {
      // Create the spec document file
      const specDir = join(tempDir, 'specs', 'STAK-123-feature');
      mkdirSync(specDir, { recursive: true });
      writeFileSync(join(specDir, 'requirements.md'), '# Requirements');

      const reqSnapshotDir = join(
        tempDir,
        'approvals',
        'STAK-123-feature',
        '.snapshots',
        'requirements.md',
      );
      mkdirSync(reqSnapshotDir, { recursive: true });
      writeFileSync(
        join(reqSnapshotDir, 'metadata.json'),
        JSON.stringify({
          filePath: 'specs/STAK-123-feature/requirements.md',
          currentVersion: 1,
          snapshots: [
            {
              version: 1,
              filename: 'snapshot-001.json',
              timestamp: '2026-01-01T00:00:00Z',
              trigger: 'approved',
              approvalId: 'test',
              approvalTitle: 'test',
            },
          ],
        }),
      );

      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'design',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(true);
    });

    it('allows design when both requirements and discovery are approved', async () => {
      // Create the spec document files
      const specDir = join(tempDir, 'specs', 'STAK-123-feature');
      mkdirSync(specDir, { recursive: true });
      writeFileSync(join(specDir, 'requirements.md'), '# Requirements');
      writeFileSync(join(specDir, 'discovery.md'), '# Discovery');

      // Approved requirements
      const reqSnapshotDir = join(
        tempDir,
        'approvals',
        'STAK-123-feature',
        '.snapshots',
        'requirements.md',
      );
      mkdirSync(reqSnapshotDir, { recursive: true });
      writeFileSync(
        join(reqSnapshotDir, 'metadata.json'),
        JSON.stringify({
          filePath: 'specs/STAK-123-feature/requirements.md',
          currentVersion: 1,
          snapshots: [
            {
              version: 1,
              filename: 'snapshot-001.json',
              timestamp: '2026-01-01T00:00:00Z',
              trigger: 'approved',
              approvalId: 'test',
              approvalTitle: 'test',
            },
          ],
        }),
      );

      // Approved discovery
      const discSnapshotDir = join(
        tempDir,
        'approvals',
        'STAK-123-feature',
        '.snapshots',
        'discovery.md',
      );
      mkdirSync(discSnapshotDir, { recursive: true });
      writeFileSync(
        join(discSnapshotDir, 'metadata.json'),
        JSON.stringify({
          filePath: 'specs/STAK-123-feature/discovery.md',
          currentVersion: 1,
          snapshots: [
            {
              version: 1,
              filename: 'snapshot-001.json',
              timestamp: '2026-01-01T00:00:00Z',
              trigger: 'approved',
              approvalId: 'test',
              approvalTitle: 'test',
            },
          ],
        }),
      );

      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'design',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('G4 — tasks requires approved design', () => {
    it('rejects tasks when design.md is unapproved', async () => {
      // Approved requirements (prerequisite)
      const reqSnapshotDir = join(
        tempDir,
        'approvals',
        'STAK-123-feature',
        '.snapshots',
        'requirements.md',
      );
      mkdirSync(reqSnapshotDir, { recursive: true });
      writeFileSync(
        join(reqSnapshotDir, 'metadata.json'),
        JSON.stringify({
          filePath: 'specs/STAK-123-feature/requirements.md',
          currentVersion: 1,
          snapshots: [
            {
              version: 1,
              filename: 'snapshot-001.json',
              timestamp: '2026-01-01T00:00:00Z',
              trigger: 'approved',
              approvalId: 'test',
              approvalTitle: 'test',
            },
          ],
        }),
      );

      // Unapproved design — on disk but no snapshot
      const specDir = join(tempDir, 'specs', 'STAK-123-feature');
      mkdirSync(specDir, { recursive: true });
      writeFileSync(join(specDir, 'design.md'), '# Design\n');

      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'tasks',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(false);
      expect(result.gate).toBe('G4');
    });

    it('allows tasks when design.md is approved', async () => {
      // Create the spec document files
      const specDir = join(tempDir, 'specs', 'STAK-123-feature');
      mkdirSync(specDir, { recursive: true });
      writeFileSync(join(specDir, 'requirements.md'), '# Requirements');
      writeFileSync(join(specDir, 'design.md'), '# Design');

      // Approved requirements
      const reqSnapshotDir = join(
        tempDir,
        'approvals',
        'STAK-123-feature',
        '.snapshots',
        'requirements.md',
      );
      mkdirSync(reqSnapshotDir, { recursive: true });
      writeFileSync(
        join(reqSnapshotDir, 'metadata.json'),
        JSON.stringify({
          filePath: 'specs/STAK-123-feature/requirements.md',
          currentVersion: 1,
          snapshots: [
            {
              version: 1,
              filename: 'snapshot-001.json',
              timestamp: '2026-01-01T00:00:00Z',
              trigger: 'approved',
              approvalId: 'test',
              approvalTitle: 'test',
            },
          ],
        }),
      );

      // Approved design
      const designSnapshotDir = join(
        tempDir,
        'approvals',
        'STAK-123-feature',
        '.snapshots',
        'design.md',
      );
      mkdirSync(designSnapshotDir, { recursive: true });
      writeFileSync(
        join(designSnapshotDir, 'metadata.json'),
        JSON.stringify({
          filePath: 'specs/STAK-123-feature/design.md',
          currentVersion: 1,
          snapshots: [
            {
              version: 1,
              filename: 'snapshot-001.json',
              timestamp: '2026-01-01T00:00:00Z',
              trigger: 'approved',
              approvalId: 'test',
              approvalTitle: 'test',
            },
          ],
        }),
      );

      const result = await validatePhaseGates({
        specName: 'STAK-123-feature',
        documentType: 'tasks',
        workflowRoot: tempDir,
      });

      expect(result.passed).toBe(true);
    });
  });
});

describe('checkApprovalStatus', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'specflow-approval-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('handles malformed metadata.json gracefully', async () => {
    const snapshotDir = join(
      tempDir,
      'approvals',
      'STAK-123-feature',
      '.snapshots',
      'requirements.md',
    );
    mkdirSync(snapshotDir, { recursive: true });
    writeFileSync(join(snapshotDir, 'metadata.json'), '{not valid json!!!');

    const result = await checkApprovalStatus(tempDir, 'STAK-123-feature', 'requirements');

    expect(result.exists).toBe(true);
    expect(result.approved).toBe(false);
  });
});
