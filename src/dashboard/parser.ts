import { readFile, readdir, access, stat } from 'fs/promises';
import { join, basename } from 'path';
// PathUtils import removed — parser uses direct joins because PathUtils
// relies on a process-level DocVault singleton not initialized in the dashboard.
import { SpecData, SteeringStatus, TaskInfo } from '../types.js';
import { parseTaskProgress } from '../core/task-parser.js';

export interface ParsedSpec extends SpecData {
  displayName: string;
}


export class SpecParser {
  private projectPath: string;
  private specsPath: string;
  private archiveSpecsPath: string;
  private steeringPath: string;

  constructor(projectPath: string) {
    // Path should already be translated by caller (ProjectManager)
    // Use direct joins — PathUtils.get*Path() methods rely on a process-level
    // DocVault singleton that isn't initialized in the dashboard process.
    this.projectPath = projectPath;
    this.specsPath = join(projectPath, 'specs');
    this.archiveSpecsPath = join(projectPath, 'archive', 'specs');
    this.steeringPath = join(projectPath, 'steering');
  }

  async getAllSpecs(): Promise<ParsedSpec[]> {
    try {
      await access(this.specsPath);
      const entries = await readdir(this.specsPath, { withFileTypes: true });
      const specDirs = entries.filter(entry => entry.isDirectory());
      
      const specs: ParsedSpec[] = [];
      for (const dir of specDirs) {
        const spec = await this.getSpec(dir.name);
        if (spec) {
          specs.push(spec);
        }
      }
      
      return specs.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  async getAllArchivedSpecs(): Promise<ParsedSpec[]> {
    try {
      await access(this.archiveSpecsPath);
      const entries = await readdir(this.archiveSpecsPath, { withFileTypes: true });
      const specDirs = entries.filter(entry => entry.isDirectory());
      
      const specs: ParsedSpec[] = [];
      for (const dir of specDirs) {
        const spec = await this.getArchivedSpec(dir.name);
        if (spec) {
          specs.push(spec);
        }
      }
      
      return specs.sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return [];
    }
  }

  async getSpec(name: string): Promise<ParsedSpec | null> {
    // Sanitize name to prevent path traversal from API input
    name = basename(name);
    try {
      const specDir = join(this.projectPath, 'specs', name);
      await access(specDir);

      const spec: ParsedSpec = {
        name,
        displayName: this.formatDisplayName(name),
        createdAt: '',
        lastModified: '',
        phases: {
          discovery: { exists: false },
          requirements: { exists: false },
          design: { exists: false },
          tasks: { exists: false },
          readinessReport: { exists: false },
          implementation: { exists: false }
        }
      };

      // Get directory stats
      const dirStats = await stat(specDir);
      spec.createdAt = dirStats.birthtime.toISOString();
      spec.lastModified = dirStats.mtime.toISOString();

      // Check each phase
      const discoveryPath = join(specDir, 'discovery.md');
      const requirementsPath = join(specDir, 'requirements.md');
      const designPath = join(specDir, 'design.md');
      const tasksPath = join(specDir, 'tasks.md');
      const readinessReportPath = join(specDir, 'readiness-report.md');

      // Check discovery
      try {
        await access(discoveryPath);
        spec.phases.discovery.exists = true;
        spec.phases.discovery.approved = await this.isPhaseApproved(name, 'discovery.md');
        const discStats = await stat(discoveryPath);
        spec.phases.discovery.lastModified = discStats.mtime.toISOString();

        if (discStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = discStats.mtime.toISOString();
        }
      } catch {}

      // Check requirements
      try {
        await access(requirementsPath);
        spec.phases.requirements.exists = true;
        spec.phases.requirements.approved = await this.isPhaseApproved(name, 'requirements.md');
        const reqStats = await stat(requirementsPath);
        spec.phases.requirements.lastModified = reqStats.mtime.toISOString();

        // Update overall last modified if this is newer
        if (reqStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = reqStats.mtime.toISOString();
        }
      } catch {}

      // Check design
      try {
        await access(designPath);
        spec.phases.design.exists = true;
        spec.phases.design.approved = await this.isPhaseApproved(name, 'design.md');
        const designStats = await stat(designPath);
        spec.phases.design.lastModified = designStats.mtime.toISOString();

        if (designStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = designStats.mtime.toISOString();
        }
      } catch {}

      // Check tasks
      try {
        await access(tasksPath);
        spec.phases.tasks.exists = true;
        spec.phases.tasks.approved = await this.isPhaseApproved(name, 'tasks.md');
        const tasksStats = await stat(tasksPath);
        spec.phases.tasks.lastModified = tasksStats.mtime.toISOString();

        if (tasksStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = tasksStats.mtime.toISOString();
        }

        // Parse tasks to get progress
        const tasksContent = await readFile(tasksPath, 'utf-8');
        const taskProgress = parseTaskProgress(tasksContent);
        spec.taskProgress = {
          total: taskProgress.total,
          completed: taskProgress.completed,
          pending: taskProgress.pending
        };
      } catch {}

      // Check readiness report
      try {
        await access(readinessReportPath);
        spec.phases.readinessReport.exists = true;
        spec.phases.readinessReport.approved = await this.isPhaseApproved(name, 'readiness-report.md');
        const rrStats = await stat(readinessReportPath);
        spec.phases.readinessReport.lastModified = rrStats.mtime.toISOString();

        if (rrStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = rrStats.mtime.toISOString();
        }
      } catch {}

      // Implementation phase is always considered "exists" since it's ongoing manual work
      spec.phases.implementation.exists = true;

      return spec;
    } catch {
      return null;
    }
  }

  async getArchivedSpec(name: string): Promise<ParsedSpec | null> {
    // Sanitize name to prevent path traversal from API input
    name = basename(name);
    try {
      const specDir = join(this.projectPath, 'archive', 'specs', name);
      await access(specDir);

      const spec: ParsedSpec = {
        name,
        displayName: this.formatDisplayName(name),
        createdAt: '',
        lastModified: '',
        phases: {
          discovery: { exists: false },
          requirements: { exists: false },
          design: { exists: false },
          tasks: { exists: false },
          readinessReport: { exists: false },
          implementation: { exists: false }
        }
      };

      // Get directory stats
      const dirStats = await stat(specDir);
      spec.createdAt = dirStats.birthtime.toISOString();
      spec.lastModified = dirStats.mtime.toISOString();

      // Check each phase
      const discoveryPath = join(specDir, 'discovery.md');
      const requirementsPath = join(specDir, 'requirements.md');
      const designPath = join(specDir, 'design.md');
      const tasksPath = join(specDir, 'tasks.md');
      const readinessReportPath = join(specDir, 'readiness-report.md');

      // Check discovery
      try {
        await access(discoveryPath);
        spec.phases.discovery.exists = true;
        spec.phases.discovery.approved = await this.isPhaseApproved(name, 'discovery.md');
        const discStats = await stat(discoveryPath);
        spec.phases.discovery.lastModified = discStats.mtime.toISOString();

        if (discStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = discStats.mtime.toISOString();
        }
      } catch {}

      // Check requirements
      try {
        await access(requirementsPath);
        spec.phases.requirements.exists = true;
        spec.phases.requirements.approved = await this.isPhaseApproved(name, 'requirements.md');
        const reqStats = await stat(requirementsPath);
        spec.phases.requirements.lastModified = reqStats.mtime.toISOString();

        // Update overall last modified if this is newer
        if (reqStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = reqStats.mtime.toISOString();
        }
      } catch {}

      // Check design
      try {
        await access(designPath);
        spec.phases.design.exists = true;
        spec.phases.design.approved = await this.isPhaseApproved(name, 'design.md');
        const designStats = await stat(designPath);
        spec.phases.design.lastModified = designStats.mtime.toISOString();

        if (designStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = designStats.mtime.toISOString();
        }
      } catch {}

      // Check tasks
      try {
        await access(tasksPath);
        spec.phases.tasks.exists = true;
        spec.phases.tasks.approved = await this.isPhaseApproved(name, 'tasks.md');
        const tasksStats = await stat(tasksPath);
        spec.phases.tasks.lastModified = tasksStats.mtime.toISOString();

        if (tasksStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = tasksStats.mtime.toISOString();
        }

        // Parse tasks to get progress
        const tasksContent = await readFile(tasksPath, 'utf-8');
        const taskProgress = parseTaskProgress(tasksContent);
        spec.taskProgress = {
          total: taskProgress.total,
          completed: taskProgress.completed,
          pending: taskProgress.pending
        };
      } catch {}

      // Check readiness report
      try {
        await access(readinessReportPath);
        spec.phases.readinessReport.exists = true;
        spec.phases.readinessReport.approved = await this.isPhaseApproved(name, 'readiness-report.md');
        const rrStats = await stat(readinessReportPath);
        spec.phases.readinessReport.lastModified = rrStats.mtime.toISOString();

        if (rrStats.mtime > new Date(spec.lastModified)) {
          spec.lastModified = rrStats.mtime.toISOString();
        }
      } catch {}

      // Implementation phase is always considered "exists" since it's ongoing manual work
      spec.phases.implementation.exists = true;

      return spec;
    } catch {
      return null;
    }
  }


  async getProjectSteeringStatus(): Promise<SteeringStatus> {
    const status: SteeringStatus = {
      exists: false,
      documents: {
        product: false,
        tech: false,
        structure: false
      }
    };

    try {
      await access(this.steeringPath);
      status.exists = true;

      // Check each steering document
      try {
        await access(join(this.steeringPath, 'product.md'));
        status.documents.product = true;
      } catch {}

      try {
        await access(join(this.steeringPath, 'tech.md'));
        status.documents.tech = true;
      } catch {}

      try {
        await access(join(this.steeringPath, 'structure.md'));
        status.documents.structure = true;
      } catch {}

      // Get last modified time for steering directory
      const steeringStats = await stat(this.steeringPath);
      status.lastModified = steeringStats.mtime.toISOString();

    } catch {}

    return status;
  }


  private async isPhaseApproved(specName: string, filename: string): Promise<boolean> {
    try {
      const metaPath = join(
        join(this.projectPath, 'approvals'),
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

  private formatDisplayName(kebabCase: string): string {
    return kebabCase
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}