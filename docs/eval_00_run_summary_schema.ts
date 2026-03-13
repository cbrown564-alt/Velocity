export type EvalLayer =
  | 'engine'
  | 'mcp_workflow'
  | 'semantic_layer'
  | 'browser_convergence'
  | 'deliverable_layer'
  | 'product_defaults'
  | 'agent_prompting';

export type EvalScore = 1 | 2 | 3 | 4 | 5;

export type EvalOutcomePattern =
  | 'pattern_1_good_analysis_bad_artifact'
  | 'pattern_2_good_insight_painful_workflow'
  | 'pattern_3_browser_stronger_than_agent'
  | 'pattern_4_agent_lost_in_discovery'
  | 'pattern_5a_product_defaults_weak'
  | 'pattern_5b_agent_prompting_weak'
  | 'pattern_6_intended_path_blocked'
  | 'pattern_7_end_to_end_success';

export interface EvalLayerScore {
  layer: EvalLayer;
  score: EvalScore;
  notes: string;
}

export interface EvalArtifactStatus {
  path: string | null;
  produced: boolean;
  notes?: string;
}

export interface EvalRunSummary {
  evalId: string;
  runId: string;
  runDate: string;
  commitSha: string;
  briefPath: string;
  dataset: {
    path: string;
    fallbackPath?: string | null;
    rowCount?: number;
    variableCount?: number;
  };
  outcome: 'success' | 'partial' | 'blocked';
  outcomePattern: EvalOutcomePattern;
  toolMetrics: {
    totalToolCalls: number;
    totalDurationMs?: number;
    retries: number;
    externalScriptsWritten: number;
  };
  artifacts: {
    deck: EvalArtifactStatus;
    session: EvalArtifactStatus;
    summary: EvalArtifactStatus;
  };
  scores: EvalLayerScore[];
  notableFindings: string[];
  blockers: string[];
  followUps: string[];
}
