/**
 * One-time migration of existing `.specflow/` content to DocVault.
 *
 * Copies (never moves) migratable subdirectories from the local `.specflow/`
 * folder to the corresponding DocVault location defined in ResolvedConfig.
 * Skips destinations that already contain files to prevent data loss.
 */

import { readdir, cp, access, rm } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';
import type { ResolvedConfig } from './config-loader.js';
import { ensureDirectoryExists } from './path-utils.js';

export interface MigrationResult {
  migratedDirs: string[];
  skippedDirs: string[];
  errors: string[];
}

/**
 * Migration source-to-destination mapping.
 * Keys are local `.specflow/` subdirectory names.
 * Values are the corresponding subdirectory names under `config.specflowRoot`.
 * Note: `user-templates/` is renamed to `templates/` in DocVault.
 */
const MIGRATION_MAP: Record<string, string> = {
  'steering': 'steering',
  'specs': 'specs',
  'user-templates': 'templates',
  'approvals': 'approvals',
  'archive': 'archive',
};

/**
 * Check whether the local `.specflow/` directory contains any content
 * that should be migrated to DocVault.
 */
export async function needsMigration(
  projectPath: string,
  _config: ResolvedConfig,
): Promise<boolean> {
  const localRoot = join(projectPath, '.specflow');

  for (const srcDir of Object.keys(MIGRATION_MAP)) {
    const srcPath = join(localRoot, srcDir);
    if (await dirHasFiles(srcPath)) {
      return true;
    }
  }

  // Also check for legacy dirs that need cleanup (e.g., templates/)
  const legacyDirs = ['templates'];
  for (const dir of legacyDirs) {
    try {
      await access(join(localRoot, dir), constants.F_OK);
      return true; // Legacy dir exists and needs cleanup
    } catch {
      // Doesn't exist
    }
  }

  return false;
}

/**
 * Copy migratable content from `.specflow/` to DocVault.
 *
 * For each mapping in MIGRATION_MAP:
 * - If the source directory doesn't exist or is empty, skip silently.
 * - If the destination directory already has files, skip with a warning.
 * - Otherwise, copy recursively.
 *
 * Originals are left in place (copy, not move).
 */
export async function migrateToDocVault(
  projectPath: string,
  config: ResolvedConfig,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    migratedDirs: [],
    skippedDirs: [],
    errors: [],
  };

  const localRoot = join(projectPath, '.specflow');

  for (const [srcDir, destDir] of Object.entries(MIGRATION_MAP)) {
    const srcPath = join(localRoot, srcDir);
    const destPath = join(config.specflowRoot, destDir);

    try {
      // Skip if source doesn't exist or is empty
      if (!(await dirHasFiles(srcPath))) {
        continue;
      }

      // Safety: never overwrite existing content (ignore scaffolding artifacts)
      if (await dirHasMeaningfulContent(destPath)) {
        const msg = `Skipping ${srcDir}/ — destination already has content: ${destPath}`;
        console.error(`[migration] ${msg}`);
        result.skippedDirs.push(srcDir);
        continue;
      }

      // Ensure destination parent exists
      await ensureDirectoryExists(destPath);

      // Copy recursively
      await cp(srcPath, destPath, { recursive: true });
      console.error(`[migration] Copied ${srcDir}/ → ${destPath}`);
      result.migratedDirs.push(srcDir);

      // Clean up local source after successful copy
      await rm(srcPath, { recursive: true });
      console.error(`[migration] Cleaned up local ${srcDir}/`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[migration] Error migrating ${srcDir}/: ${msg}`);
      result.errors.push(`${srcDir}: ${msg}`);
    }
  }

  // Clean up legacy local directories that are no longer needed
  // These were auto-created by old WorkspaceInitializer but are now in DocVault
  const legacyCleanup = ['templates'];
  for (const dir of legacyCleanup) {
    const dirPath = join(localRoot, dir);
    try {
      await access(dirPath, constants.F_OK);
      await rm(dirPath, { recursive: true });
      console.error(`[migration] Cleaned up legacy local ${dir}/`);
    } catch {
      // Doesn't exist, nothing to clean
    }
  }

  return result;
}

/**
 * Check whether a directory exists and contains at least one regular file
 * (recursively). Empty subdirectories (e.g., scaffolded by WorkspaceInitializer)
 * do not count as "content" — only actual files do.
 */
async function dirHasFiles(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath, constants.F_OK);
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) return true;
      if (entry.isDirectory()) {
        if (await dirHasFiles(join(dirPath, entry.name))) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Scaffolding artifacts that don't count as "existing content" when deciding
 * whether to skip migration for a destination directory.
 */
const SCAFFOLDING_ARTIFACTS = new Set(['_Index.md', '.DS_Store']);

/**
 * Check whether a destination directory has meaningful content beyond
 * scaffolding artifacts (_Index.md, .DS_Store) and empty subdirectories.
 * Used for destination checks only — source checks use dirHasFiles().
 */
async function dirHasMeaningfulContent(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath, constants.F_OK);
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && !SCAFFOLDING_ARTIFACTS.has(entry.name)) return true;
      if (entry.isDirectory()) {
        if (await dirHasMeaningfulContent(join(dirPath, entry.name))) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
