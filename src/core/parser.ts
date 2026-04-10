import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import { PathUtils } from './path-utils.js';
import { SpecData, SteeringStatus, PhaseStatus } from '../types.js';
import { parseTaskProgress } from './task-parser.js';

export class SpecParser {
  constructor(private projectPath: string) {}

  async getAllSpecs(): Promise<SpecData[]> {
    const specs: SpecData[] = [];
    const specsPath = PathUtils.getSpecPath(this.projectPath, '');
    
    try {
      const entries = await readdir(specsPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const spec = await this.getSpec(entry.name);
          if (spec) {
            specs.push(spec);
          }
        }
      }
    } catch (error) {
      // Directory doesn't exist yet
      return [];
    }
    
    return specs;
  }

  async getSpec(name: string): Promise<SpecData | null> {
    const specPath = PathUtils.getSpecPath(this.projectPath, name);
    
    try {
      const stats = await stat(specPath);
      if (!stats.isDirectory()) {
        return null;
      }
      
      // Read all phase files
      const discovery = await this.getPhaseStatus(specPath, 'discovery.md');
      const requirements = await this.getPhaseStatus(specPath, 'requirements.md');
      const design = await this.getPhaseStatus(specPath, 'design.md');
      const tasks = await this.getPhaseStatus(specPath, 'tasks.md');
      const readinessReport = await this.getPhaseStatus(specPath, 'readiness-report.md');

      // Parse task progress using unified parser
      let taskProgress = undefined;
      if (tasks.exists) {
        try {
          const tasksContent = await readFile(join(specPath, 'tasks.md'), 'utf-8');
          taskProgress = parseTaskProgress(tasksContent);
        } catch {
          // Error reading tasks file
        }
      }

      return {
        name,
        createdAt: stats.birthtime.toISOString(),
        lastModified: stats.mtime.toISOString(),
        phases: {
          discovery,
          requirements,
          design,
          tasks,
          readinessReport,
          implementation: {
            exists: taskProgress ? taskProgress.completed > 0 : false
          }
        },
        taskProgress
      };
    } catch (error) {
      return null;
    }
  }


  async getProjectSteeringStatus(): Promise<SteeringStatus> {
    const steeringPath = PathUtils.getSteeringPath(this.projectPath);
    
    try {
      const stats = await stat(steeringPath);
      
      const productExists = await this.fileExists(join(steeringPath, 'product.md'));
      const techExists = await this.fileExists(join(steeringPath, 'tech.md'));
      const structureExists = await this.fileExists(join(steeringPath, 'structure.md'));
      
      return {
        exists: stats.isDirectory(),
        documents: {
          product: productExists,
          tech: techExists,
          structure: structureExists
        },
        lastModified: stats.mtime.toISOString()
      };
    } catch (error) {
      return {
        exists: false,
        documents: {
          product: false,
          tech: false,
          structure: false
        }
      };
    }
  }

  private async getPhaseStatus(basePath: string, filename: string): Promise<PhaseStatus> {
    const filePath = join(basePath, filename);

    try {
      const stats = await stat(filePath);
      const content = await readFile(filePath, 'utf-8');
      const approved = await this.isPhaseApproved(basePath, filename);

      return {
        exists: true,
        approved,
        lastModified: stats.mtime.toISOString(),
        content
      };
    } catch (error) {
      return {
        exists: false
      };
    }
  }

  private async isPhaseApproved(basePath: string, filename: string): Promise<boolean> {
    try {
      const specName = basename(basePath);
      const metaPath = join(
        PathUtils.getApprovalsPath(this.projectPath),
        specName,
        '.snapshots',
        filename,
        'metadata.json'
      );
      const metaContent = await readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaContent);
      const snapshots: Array<{ trigger: string }> = meta.snapshots || [];
      const latest = snapshots[snapshots.length - 1];
      return latest?.trigger === 'approved';
    } catch {
      return false;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}