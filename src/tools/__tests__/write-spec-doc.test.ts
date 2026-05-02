import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeSpecDocHandler } from '../../tools/write-spec-doc.js';

vi.mock('../../core/phase-gates.js', () => ({
  validatePhaseGates: vi.fn(),
}));

vi.mock('../../core/path-utils.js', () => ({
  PathUtils: {
    getWorkflowRoot: vi.fn(() => '/tmp/mock-workflow-root'),
  },
  validateProjectPath: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { validatePhaseGates } from '../../core/phase-gates.js';
import { writeFile, mkdir } from 'fs/promises';

const mockedValidatePhaseGates = vi.mocked(validatePhaseGates);
const mockedWriteFile = vi.mocked(writeFile);
const mockedMkdir = vi.mocked(mkdir);

describe('writeSpecDocHandler', () => {
  const defaultArgs = {
    specName: 'STAK-123-feature',
    documentType: 'requirements' as const,
    content: '# Requirements\n\nTest content',
  };

  const defaultContext = {
    projectPath: '/test/project',
    dashboardUrl: 'http://localhost:5051',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedMkdir.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);
  });

  it('returns error when gate validation fails', async () => {
    mockedValidatePhaseGates.mockResolvedValue({
      passed: false,
      gate: 'G2',
      message: 'Requirements must be approved before writing discovery',
    });

    const result = await writeSpecDocHandler(defaultArgs, defaultContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain('G2');
  });

  it('writes file when gate validation passes', async () => {
    mockedValidatePhaseGates.mockResolvedValue({
      passed: true,
      gate: 'G1',
      message: 'All gates passed',
    });

    const result = await writeSpecDocHandler(defaultArgs, defaultContext);

    expect(result.success).toBe(true);
    expect(mockedWriteFile).toHaveBeenCalled();
  });

  it('creates spec directory with recursive option', async () => {
    mockedValidatePhaseGates.mockResolvedValue({
      passed: true,
      gate: 'G1',
      message: 'All gates passed',
    });

    await writeSpecDocHandler(defaultArgs, defaultContext);

    expect(mockedMkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it('returns correct filePath in response data', async () => {
    mockedValidatePhaseGates.mockResolvedValue({
      passed: true,
      gate: 'G1',
      message: 'All gates passed',
    });

    const result = await writeSpecDocHandler(defaultArgs, defaultContext);

    expect(result.data).toBeDefined();
    expect(result.data?.filePath).toContain('STAK-123-feature');
    expect(result.data?.filePath).toContain('requirements.md');
  });

  it('returns nextSteps with approval instruction', async () => {
    mockedValidatePhaseGates.mockResolvedValue({
      passed: true,
      gate: 'G1',
      message: 'All gates passed',
    });

    const result = await writeSpecDocHandler(defaultArgs, defaultContext);

    expect(result.nextSteps).toBeDefined();
    expect(result.nextSteps!.some((step: string) => /approv/i.test(step))).toBe(true);
  });

  it('handles file write errors gracefully', async () => {
    mockedValidatePhaseGates.mockResolvedValue({
      passed: true,
      gate: 'G1',
      message: 'All gates passed',
    });
    mockedWriteFile.mockRejectedValue(new Error('EACCES: permission denied'));

    const result = await writeSpecDocHandler(defaultArgs, defaultContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain('EACCES');
  });
});
