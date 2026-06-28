/**
 * WebR Type Definitions
 *
 * Type-safe communication protocol for the WebR Web Worker.
 * WebR enables R runtime in the browser for academic-grade statistical methods.
 */

// ============================================================================
// Worker Message Types
// ============================================================================

export type WebRWorkerRequest =
  | { type: 'init' }
  | { type: 'loadPackage'; packageName: string }
  | { type: 'executeR'; code: string; data?: Uint8Array }
  | { type: 'runSurveyAnalysis'; config: SurveyDesignConfig; data: Uint8Array }
  | { type: 'runMixedModel'; config: MixedModelConfig; data: Uint8Array }
  | { type: 'getStatus' }
  | { type: 'terminate' };

export type WebRWorkerResponse =
  | { type: 'ready' }
  | { type: 'initProgress'; progress: number; message: string }
  | { type: 'packageLoaded'; packageName: string }
  | { type: 'packageProgress'; packageName: string; progress: number }
  | { type: 'rResult'; result: RResult }
  | { type: 'surveyResult'; result: SurveyResult }
  | { type: 'mixedModelResult'; result: MixedModelResult }
  | { type: 'status'; status: WebRStatus }
  | { type: 'error'; message: string; code?: string };

// ============================================================================
// WebR Status
// ============================================================================

export type WebRStatusType = 'idle' | 'initializing' | 'ready' | 'busy' | 'error';

export interface WebRStatus {
  status: WebRStatusType;
  loadedPackages: string[];
  initProgress: number;
  lastError?: string;
}

// ============================================================================
// R Execution Result
// ============================================================================

export interface RResult {
  /** Raw output from R console */
  output: string;

  /** Parsed result values (if applicable) */
  values?: Record<string, RValue>;

  /** Any warnings generated */
  warnings?: string[];

  /** Execution time in milliseconds */
  durationMs: number;
}

export type RValue = number | string | boolean | null | number[] | string[] | RDataFrame | RMatrix | RList;

export interface RDataFrame {
  type: 'data.frame';
  columns: Record<string, (number | string | null)[]>;
  rowNames?: string[];
  nrow: number;
  ncol: number;
}

export interface RMatrix {
  type: 'matrix';
  data: number[][];
  rowNames?: string[];
  colNames?: string[];
  nrow: number;
  ncol: number;
}

export interface RList {
  type: 'list';
  elements: Record<string, RValue>;
}

// ============================================================================
// Survey Design Configuration (survey package)
// ============================================================================

export interface SurveyDesignConfig {
  /** Weight variable name */
  weightVar?: string;

  /** Cluster/PSU variable for complex designs */
  clusterVar?: string;

  /** Strata variable for stratified designs */
  strataVar?: string;

  /** Finite population correction variable or value */
  fpc?: string | number;

  /** Design type */
  designType: 'simple' | 'stratified' | 'cluster' | 'twostage';

  /** Variables to analyze */
  analysisVars: string[];

  /** Grouping variable for svyby() */
  byVar?: string;

  /** Statistics to compute */
  statistics: SurveyStatistic[];
}

export type SurveyStatistic = 'mean' | 'total' | 'proportion' | 'quantile' | 'ratio' | 'variance';

export interface SurveyResult {
  /** Design effect (deff) for each variable */
  deff: Record<string, number>;

  /** Point estimates */
  estimates: Record<string, number>;

  /** Standard errors */
  standardErrors: Record<string, number>;

  /** Confidence intervals (95%) */
  confidenceIntervals: Record<string, { lower: number; upper: number }>;

  /** Sample sizes (effective n) */
  effectiveN: Record<string, number>;

  /** By-group results if byVar specified */
  byGroup?: Record<string, Omit<SurveyResult, 'byGroup'>>;

  /** Raw R output for debugging */
  rawOutput?: string;

  /** Execution time */
  durationMs: number;
}

// ============================================================================
// Mixed Effects Model Configuration (lme4 package)
// ============================================================================

export interface MixedModelConfig {
  /** Response/dependent variable */
  responseVar: string;

  /** Fixed effect predictors */
  fixedEffects: string[];

  /** Random effects specification */
  randomEffects: RandomEffectSpec[];

  /** Model family for GLMMs */
  family?: 'gaussian' | 'binomial' | 'poisson' | 'gamma';

  /** Link function (defaults based on family) */
  link?: string;

  /** Use REML (true) or ML (false) estimation */
  reml?: boolean;

  /** Optimizer settings */
  optimizer?: 'bobyqa' | 'Nelder_Mead' | 'nlminbwrap';

  /** Maximum iterations */
  maxIter?: number;
}

export interface RandomEffectSpec {
  /** Grouping variable (e.g., "subject", "school") */
  groupVar: string;

  /** Random slopes (empty = intercept only) */
  slopes?: string[];

  /** Allow correlation between random effects */
  correlated?: boolean;
}

export interface MixedModelResult {
  /** Fixed effects coefficients */
  fixedEffects: {
    name: string;
    estimate: number;
    standardError: number;
    tValue: number;
    pValue?: number;
  }[];

  /** Random effects variance components */
  randomEffects: {
    group: string;
    effect: string;
    variance: number;
    stdDev: number;
  }[];

  /** Correlation between random effects (if applicable) */
  randomCorrelations?: {
    group: string;
    effect1: string;
    effect2: string;
    correlation: number;
  }[];

  /** Residual variance */
  residualVariance: number;
  residualStdDev: number;

  /** Model fit statistics */
  fitStats: {
    AIC: number;
    BIC: number;
    logLik: number;
    deviance: number;
    df: number;
  };

  /** Number of observations and groups */
  nObs: number;
  nGroups: Record<string, number>;

  /** Convergence information */
  converged: boolean;
  convergenceMessage?: string;

  /** Intraclass correlation coefficient (ICC) for intercept-only models */
  icc?: number;

  /** Raw R output for debugging */
  rawOutput?: string;

  /** Execution time */
  durationMs: number;
}

// ============================================================================
// Engine Selection
// ============================================================================

export type AnalysisEngine = 'auto' | 'duckdb' | 'webr';

/**
 * Determines which engine to use based on analysis configuration
 */
export function selectEngine(
  preferredEngine: AnalysisEngine,
  requiresDesignEffects: boolean,
  requiresMixedModels: boolean,
): 'duckdb' | 'webr' {
  if (preferredEngine === 'webr') {
    return 'webr';
  }

  if (preferredEngine === 'duckdb') {
    return 'duckdb';
  }

  // Auto selection
  if (requiresDesignEffects || requiresMixedModels) {
    return 'webr';
  }

  return 'duckdb';
}
