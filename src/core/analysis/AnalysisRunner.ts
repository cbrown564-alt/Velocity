import { DatabaseAdapter } from '../DatabaseAdapter';

/**
 * AnalysisRunner interface
 *
 * Allows new analysis types (regression, factor analysis, cluster analysis)
 * to plug into the system without modifying core code.
 */
export interface AnalysisRunner<TConfig, TResult> {
  /** Unique identifier, e.g. "crosstab", "variableStats", "regression" */
  readonly id: string;

  /** Human-readable name for UI display */
  readonly label: string;

  /** JSON schema describing TConfig (for UI form generation) */
  readonly configSchema: Record<string, unknown>;

  /** Execute the analysis */
  run(adapter: DatabaseAdapter, config: TConfig): Promise<TResult>;

  /** Optional: validate config before execution */
  validate?(config: TConfig): string[]; // Returns error messages, empty = valid
}
