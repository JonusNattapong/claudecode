export type EvalCategory = 'coding' | 'research' | 'memory' | 'security' | 'workflow';

export interface EvalTaskExpected {
  filesChanged?: string[];
  filesNotChanged?: string[];
  commandsRun?: string[];
  citationsRequired?: boolean;
  testsMustPass?: string[];
  forbiddenActions?: string[];
  minSources?: number;
  sourceTypes?: string[];
  reportSections?: string[];
  requireSourceType?: string[];
  rejectSourceTypeAsPrimary?: string[];
  mustInclude?: string[];
  mustNotInclude?: string[];
  destructiveCommandsRequireApproval?: boolean;
  forbiddenWithoutApproval?: string[];
}

export interface EvalTaskBudgets {
  maxSteps?: number;
  maxToolCalls?: number;
  maxDurationMs?: number;
  maxCostUsd?: number;
}

export interface EvalTask {
  id: string;
  title: string;
  category: EvalCategory;
  input: string;
  workspaceFixture?: string;
  expected?: EvalTaskExpected;
  graders: string[];
  budgets?: EvalTaskBudgets;
}

export interface EvalConfig {
  tasksDir: string;
  gradersDir: string;
  runsDir: string;
  baselinesDir: string;
  reportsDir: string;
}

export interface EvalRun {
  id: string;
  taskIds: string[];
  agentVersion: string;
  model: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  config: EvalConfig;
  resultsPath: string;
}

export interface EvalMetrics {
  durationMs: number;
  toolCalls: number;
  shellCommands: number;
  filesChanged: number;
  testsPassed: number;
  testsFailed: number;
  approvalsRequested: number;
}

export interface EvalResult {
  taskId: string;
  runId: string;
  status: 'pass' | 'fail' | 'partial' | 'error';
  score: number;
  scores: Record<string, number>;
  tracePath?: string;
  artifactPaths: string[];
  failureReasons: string[];
  metrics: EvalMetrics;
}

export type GraderType = 'command' | 'trace' | 'artifact' | 'rule';

export interface GraderConfig {
  id: string;
  type: GraderType;
  // Command Grader
  commands?: string[];
  passWhen?: {
    exitCode?: number;
  };
  // Trace Grader
  rules?: {
    before?: string;
    requireAny?: string[];
  }[];
  failMessage?: string;
  // Artifact Grader
  checks?: {
    changedFiles?: {
      allow?: string[];
      deny?: string[];
    };
    maxChangedFiles?: number;
  };
  // Rule Grader
  mustInclude?: string[];
  mustNotInclude?: string[];
}

export interface GraderResult {
  graderId: string;
  status: 'pass' | 'fail' | 'partial' | 'error';
  score: number;
  failureReasons: string[];
}

export interface EvalComparison {
  runId: string;
  baselineId: string;
  overallScoreDelta: number;
  categoryDeltas: Record<string, number>;
  taskComparisons: {
    taskId: string;
    currentScore: number;
    baselineScore: number;
    currentStatus: string;
    baselineStatus: string;
  }[];
}

export interface EvalReport {
  runId: string;
  generatedAt: string;
  summary: {
    overallScore: number;
    categoryScores: Record<string, number>;
    passedTasks: number;
    failedTasks: number;
    totalTasks: number;
  };
  regression?: {
    baselineId: string;
    delta: number;
    status: 'pass' | 'fail';
  };
  failures: {
    taskId: string;
    status: string;
    score: number;
    failureReasons: string[];
  }[];
  criticalFailures: {
    taskId: string;
    reason: string;
  }[];
}
