// Common types for the spec workflow MCP server
import { encode } from '@toon-format/toon';

// Automation job types
export interface AutomationJob {
  id: string;
  name: string;
  type: 'cleanup-approvals' | 'cleanup-specs' | 'cleanup-archived-specs';
  enabled: boolean;
  config: {
    daysOld: number; // Number of days to keep; delete older records
  };
  schedule: string; // Cron expression (e.g., "0 2 * * *" for daily at 2 AM)
  lastRun?: string; // ISO timestamp of last execution
  nextRun?: string; // ISO timestamp of next scheduled execution
  createdAt: string; // ISO timestamp
}

export interface SecurityConfig {
  // Rate limiting configuration
  rateLimitEnabled: boolean;
  rateLimitPerMinute: number; // Requests per minute per client

  // Audit logging configuration
  auditLogEnabled: boolean;
  auditLogPath?: string; // Path for audit logs
  auditLogRetentionDays: number;

  // CORS configuration
  corsEnabled: boolean;
  allowedOrigins: string[]; // List of allowed origins for CORS
}

export interface GlobalSettings {
  automationJobs: AutomationJob[];
  security?: SecurityConfig; // Optional for backwards compatibility
  createdAt?: string;
  lastModified?: string;
}

export interface JobExecutionHistory {
  jobId: string;
  jobName: string;
  jobType: string;
  executedAt: string;
  success: boolean;
  duration: number; // in milliseconds
  itemsProcessed: number;
  itemsDeleted: number;
  error?: string;
}

export interface JobExecutionLog {
  executions: JobExecutionHistory[];
  lastUpdated?: string;
}

export interface ToolContext {
  projectPath: string;
  dashboardUrl?: string; // Optional for backwards compatibility
  lang?: string; // Language code for i18n (e.g., 'en', 'ja')
}

export interface SpecData {
  name: string;
  description?: string;
  createdAt: string;
  lastModified: string;
  phases: {
    discovery: PhaseStatus;
    requirements: PhaseStatus;
    design: PhaseStatus;
    tasks: PhaseStatus;
    readinessReport: PhaseStatus;
    implementation: PhaseStatus;
  };
  taskProgress?: {
    total: number;
    completed: number;
    pending: number;
  };
}

export interface PhaseStatus {
  exists: boolean;
  approved?: boolean; // Optional for backwards compatibility
  lastModified?: string;
  content?: string;
}

export interface SteeringStatus {
  exists: boolean;
  documents: {
    product: boolean;
    tech: boolean;
    structure: boolean;
  };
  lastModified?: string;
}

export interface PromptSection {
  key: string;
  value: string;
}

export interface TaskInfo {
  id: string;
  description: string;
  leverage?: string;
  requirements?: string;
  completed: boolean;
  details?: string[];
  prompt?: string;
  promptStructured?: PromptSection[];
}

export interface ImplementationLogEntry {
  id: string;
  taskId: string;
  timestamp: string;
  summary: string;
  filesModified: string[];
  filesCreated: string[];
  statistics: {
    linesAdded: number;
    linesRemoved: number;
    filesChanged: number;
  };
  artifacts: {
    apiEndpoints?: Array<{
      method: string; // GET, POST, PUT, DELETE, PATCH
      path: string; // /api/specs/:name/logs
      purpose: string; // What this endpoint does
      requestFormat?: string; // Request body/params format or example
      responseFormat?: string; // Response format or example
      location: string; // File path and line number (e.g., "src/server.ts:245")
    }>;
    components?: Array<{
      name: string; // ComponentName
      type: string; // "React", "Vue", "Svelte", etc.
      purpose: string; // What the component does
      location: string; // File path
      props?: string; // Props interface or signature
      exports?: string[]; // What it exports
    }>;
    functions?: Array<{
      name: string; // Function/method name
      purpose: string; // What it does
      location: string; // File path and line
      signature?: string; // Function signature
      isExported: boolean; // Can it be imported?
    }>;
    classes?: Array<{
      name: string; // Class name
      purpose: string; // What it does
      location: string; // File path
      methods?: string[]; // Public methods
      isExported: boolean;
    }>;
    integrations?: Array<{
      description: string; // How frontend connects to backend
      frontendComponent: string; // Which component
      backendEndpoint: string; // Which API endpoint
      dataFlow: string; // How data flows
    }>;
    tests?: Array<{
      name: string; // Test suite or file name
      type: string; // unit | integration | e2e | smoke | acceptance
      framework: string; // playwright | vitest | jest | cypress | manual
      location: string; // File path
      status: string; // passed | failed | skipped
      passed: number; // Passing test count
      failed: number; // Failing test count
      total: number; // Total test count
      duration?: string; // Execution time (e.g., "4.2s")
      coveragePercent?: number; // Code coverage percentage
      userStories?: string[]; // Linked requirement IDs from spec
    }>;
  };
}

export interface ImplementationLog {
  entries: ImplementationLogEntry[];
  lastUpdated?: string;
}
export interface ToolResponse {
  success: boolean;
  message: string;
  data?: any;
  nextSteps?: string[]; // Optional for backwards compatibility
  projectContext?: {
    projectPath: string;
    workflowRoot: string;
    specName?: string;
    currentPhase?: string;
    dashboardUrl?: string; // Optional for backwards compatibility
  };
}

// MCP-compliant response format (matches CallToolResult from MCP SDK)
export interface MCPToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
  _meta?: Record<string, any>;
}

// Helper function to convert ToolResponse to MCP format
export function toMCPResponse(response: ToolResponse, isError: boolean = false): MCPToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: encode(response),
      },
    ],
    isError,
  };
}

// ── SFLW-13: TDD Test Checklist ──────────────────────────────────────────────

export interface TestChecklistItem {
  testName: string;
  fileLocation: string;
  status: 'pending' | 'passed' | 'failed';
  failureReason?: string;
}

export interface TestFileRecord {
  filePath: string;
  contentHash: string; // SHA-256 hex
  recordedAt: string; // ISO timestamp
}

export interface TestChecklistSection {
  taskId: string;
  taskTitle: string;
  status: 'red' | 'awaiting-approval' | 'green-in-progress' | 'green-complete';
  testFiles: TestFileRecord[];
  items: TestChecklistItem[];
}

export interface TestChecklist {
  specName: string;
  sections: TestChecklistSection[];
}

export interface TestResult {
  name: string; // full test name including describe blocks
  fileLocation: string; // relative file path + line number
  status: 'fail' | 'pass';
  failureMessage?: string;
}

export interface TestRunnerOutput {
  framework: string; // 'vitest' | 'jest' | 'pytest' | 'go-test' | 'other'
  tests: TestResult[];
  totalTests: number;
  totalFailed: number;
}

export interface GenerateOptions {
  specName: string;
  taskId: string;
  taskTitle: string;
  testOutput: TestRunnerOutput;
  testFilePaths: string[];
  checklistPath: string;
}

export interface ValidationResult {
  valid: boolean;
  taskId: string;
  totalItems: number;
  completedItems: number;
  incompleteItems: TestChecklistItem[];
  message: string;
}

export interface ModificationResult {
  modified: boolean;
  files: Array<{
    filePath: string;
    originalHash: string;
    currentHash: string;
  }>;
  message: string;
}

export interface UpdateResult {
  allPassed: boolean;
  updatedItems: number;
}
