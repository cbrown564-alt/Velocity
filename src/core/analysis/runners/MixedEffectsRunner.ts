/**
 * MixedEffectsRunner
 *
 * Analysis runner for mixed effects (hierarchical/multilevel) models using lme4.
 * Handles nested data structures common in surveys (e.g., students within schools,
 * repeated measures within subjects).
 *
 * Requires WebR engine with lme4 package.
 */

import type { AnalysisRunner } from '../AnalysisRunner';
import type { DatabaseAdapter } from '../../DatabaseAdapter';
import type { MixedModelConfig } from '../../../types/webr';
import { analysisRegistry } from '../registry';

// ============================================================================
// Configuration Types
// ============================================================================

export interface MixedEffectsConfig {
  /** Response/dependent variable */
  responseVariable: string;

  /** Fixed effect predictors */
  fixedEffects: string[];

  /** Random effects specification */
  randomEffects: {
    /** Grouping variable (e.g., "subject_id", "school_id") */
    groupVariable: string;
    /** Random slopes (empty = intercept only) */
    randomSlopes?: string[];
    /** Allow correlation between random effects (default: true) */
    correlated?: boolean;
  }[];

  /** Model family for generalized linear mixed models */
  family?: 'gaussian' | 'binomial' | 'poisson' | 'gamma';

  /** Link function (defaults based on family) */
  link?: string;

  /** Use REML estimation (default: true for LMM) */
  useREML?: boolean;

  /** Maximum iterations for optimizer */
  maxIterations?: number;

  /** Filter SQL WHERE clause */
  filterClause?: string;
}

export interface MixedEffectsResult {
  /** Fixed effects with inference */
  fixedEffects: {
    term: string;
    estimate: number;
    standardError: number;
    tValue: number;
    pValue?: number;
    significant?: boolean;
  }[];

  /** Random effects variance components */
  randomEffects: {
    group: string;
    term: string;
    variance: number;
    standardDeviation: number;
  }[];

  /** Correlations between random effects */
  randomCorrelations?: {
    group: string;
    term1: string;
    term2: string;
    correlation: number;
  }[];

  /** Residual variance */
  residualVariance: number;
  residualSD: number;

  /** Model fit statistics */
  modelFit: {
    aic: number;
    bic: number;
    logLikelihood: number;
    deviance: number;
    degreesOfFreedom: number;
  };

  /** Sample information */
  nObservations: number;
  nGroups: Record<string, number>;

  /** Intraclass correlation (for intercept-only models) */
  icc?: number;

  /** Convergence status */
  converged: boolean;
  convergenceMessage?: string;

  /** Generated R code for reproducibility */
  rCode: string;

  /** Raw R output */
  rawOutput?: string;

  /** Execution time */
  durationMs: number;
}

// ============================================================================
// Runner Implementation
// ============================================================================

export class MixedEffectsRunner implements AnalysisRunner<MixedEffectsConfig, MixedEffectsResult> {
  readonly id = 'mixedEffects';
  readonly label = 'Mixed Effects Model (HLM/Multilevel)';
  readonly configSchema = {
    type: 'object',
    properties: {
      responseVariable: {
        type: 'string',
        description: 'Dependent/response variable',
      },
      fixedEffects: {
        type: 'array',
        items: { type: 'string' },
        description: 'Fixed effect predictors',
      },
      randomEffects: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            groupVariable: { type: 'string' },
            randomSlopes: { type: 'array', items: { type: 'string' } },
            correlated: { type: 'boolean' },
          },
          required: ['groupVariable'],
        },
        description: 'Random effects specification',
      },
      family: {
        type: 'string',
        enum: ['gaussian', 'binomial', 'poisson', 'gamma'],
        description: 'Model family for GLMM',
      },
      link: {
        type: 'string',
        description: 'Link function',
      },
      useREML: {
        type: 'boolean',
        description: 'Use REML estimation',
      },
      maxIterations: {
        type: 'number',
        description: 'Maximum optimizer iterations',
      },
      filterClause: {
        type: 'string',
        description: 'SQL WHERE clause',
      },
    },
    required: ['responseVariable', 'randomEffects'],
  };

  /**
   * Mixed effects models require WebR orchestration (see `src/engine/webr/WebREngine`).
   * Core exposes pure R-code generation via `generateRCode()` and `toWebRConfig()`.
   */
  async run(_adapter: DatabaseAdapter, _config: MixedEffectsConfig): Promise<MixedEffectsResult> {
    void _adapter;
    void _config;
    throw new Error(
      'mixedEffects requires WebR execution via WebREngine; use generateRCode() in core and orchestrate in engine/store',
    );
  }

  /**
   * Generate R code for mixed effects model
   */
  generateRCode(config: MixedEffectsConfig): string {
    const lines: string[] = [];

    lines.push('# Mixed Effects Model - Generated by Velocity');
    lines.push('library(lme4)');
    lines.push('');
    lines.push('# Note: Data should be loaded as "df" before running this code');
    lines.push('');

    // Build formula
    const formula = this.buildFormula(config);
    lines.push(`# Model formula: ${formula}`);
    lines.push('');

    // Model fitting
    if (config.family && config.family !== 'gaussian') {
      // GLMM
      const familyStr = this.buildFamilyString(config);
      lines.push('# Fit generalized linear mixed model');
      lines.push(`model <- glmer(`);
      lines.push(`  ${formula},`);
      lines.push(`  data = df,`);
      lines.push(`  family = ${familyStr}`);
      if (config.maxIterations) {
        lines.push(`,  control = glmerControl(optimizer = "bobyqa", optCtrl = list(maxfun = ${config.maxIterations}))`);
      }
      lines.push(')');
    } else {
      // LMM
      const remlStr = config.useREML !== false ? 'TRUE' : 'FALSE';
      lines.push('# Fit linear mixed model');
      lines.push(`model <- lmer(`);
      lines.push(`  ${formula},`);
      lines.push(`  data = df,`);
      lines.push(`  REML = ${remlStr}`);
      if (config.maxIterations) {
        lines.push(`,  control = lmerControl(optimizer = "bobyqa", optCtrl = list(maxfun = ${config.maxIterations}))`);
      }
      lines.push(')');
    }
    lines.push('');

    // Extract results
    lines.push('# Model summary');
    lines.push('model_summary <- summary(model)');
    lines.push('');

    lines.push('# Fixed effects');
    lines.push('fixed_effects <- as.data.frame(coef(model_summary))');
    lines.push('');

    lines.push('# Random effects variance components');
    lines.push('var_components <- as.data.frame(VarCorr(model))');
    lines.push('');

    lines.push('# Model fit statistics');
    lines.push('fit_stats <- list(');
    lines.push('  AIC = AIC(model),');
    lines.push('  BIC = BIC(model),');
    lines.push('  logLik = as.numeric(logLik(model)),');
    lines.push('  deviance = deviance(model),');
    lines.push('  df = attr(logLik(model), "df")');
    lines.push(')');
    lines.push('');

    lines.push('# Number of observations and groups');
    lines.push('n_obs <- nobs(model)');
    lines.push('n_groups <- ngrps(model)');
    lines.push('');

    // ICC for intercept-only models
    if (config.fixedEffects.length === 0 || (config.fixedEffects.length === 1 && config.fixedEffects[0] === '1')) {
      lines.push('# Intraclass correlation coefficient');
      lines.push('icc <- var_components$vcov[var_components$grp != "Residual"][1] / sum(var_components$vcov)');
      lines.push('');
    }

    lines.push('# Check convergence');
    lines.push('convergence_code <- model@optinfo$conv$lme4$code');
    lines.push('converged <- is.null(convergence_code) || convergence_code == 0');
    lines.push('');

    lines.push('# Compile results');
    lines.push('results <- list(');
    lines.push('  fixed_effects = fixed_effects,');
    lines.push('  var_components = var_components,');
    lines.push('  fit_stats = fit_stats,');
    lines.push('  n_obs = n_obs,');
    lines.push('  n_groups = n_groups,');
    lines.push('  converged = converged');
    lines.push(')');

    return lines.join('\n');
  }

  /**
   * Convert config to MixedModelConfig for WebR worker
   */
  toWebRConfig(config: MixedEffectsConfig): MixedModelConfig {
    return {
      responseVar: config.responseVariable,
      fixedEffects: config.fixedEffects.length > 0 ? config.fixedEffects : ['1'],
      randomEffects: config.randomEffects.map((re) => ({
        groupVar: re.groupVariable,
        slopes: re.randomSlopes,
        correlated: re.correlated,
      })),
      family: config.family,
      link: config.link,
      reml: config.useREML,
      maxIter: config.maxIterations,
    };
  }

  validate(config: MixedEffectsConfig): string[] {
    const errors: string[] = [];

    if (!config.responseVariable) {
      errors.push('Response variable is required');
    }

    if (!config.randomEffects || config.randomEffects.length === 0) {
      errors.push('At least one random effect specification is required');
    }

    for (const re of config.randomEffects || []) {
      if (!re.groupVariable) {
        errors.push('Each random effect must specify a group variable');
      }
    }

    // Check for crossed vs nested random effects
    if (config.randomEffects && config.randomEffects.length > 1) {
      const groups = config.randomEffects.map((re) => re.groupVariable);
      // This is just a warning, not an error
      if (groups.length > 2) {
        errors.push('Note: Models with more than 2 random effect groups may have convergence issues');
      }
    }

    return errors;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private buildFormula(config: MixedEffectsConfig): string {
    // Fixed effects
    const fixedPart = config.fixedEffects && config.fixedEffects.length > 0 ? config.fixedEffects.join(' + ') : '1';

    // Random effects
    const randomParts = config.randomEffects.map((re) => {
      if (re.randomSlopes && re.randomSlopes.length > 0) {
        if (re.correlated !== false) {
          // Correlated random effects: (1 + slope | group)
          return `(1 + ${re.randomSlopes.join(' + ')} | ${re.groupVariable})`;
        } else {
          // Uncorrelated: (1 | group) + (0 + slope | group)
          const slopeParts = re.randomSlopes.map((s) => `(0 + ${s} | ${re.groupVariable})`);
          return `(1 | ${re.groupVariable}) + ${slopeParts.join(' + ')}`;
        }
      }
      // Intercept only
      return `(1 | ${re.groupVariable})`;
    });

    return `${config.responseVariable} ~ ${fixedPart} + ${randomParts.join(' + ')}`;
  }

  private buildFamilyString(config: MixedEffectsConfig): string {
    const family = config.family || 'gaussian';

    if (config.link) {
      return `${family}(link = "${config.link}")`;
    }

    // Default links
    switch (family) {
      case 'binomial':
        return 'binomial(link = "logit")';
      case 'poisson':
        return 'poisson(link = "log")';
      case 'gamma':
        return 'Gamma(link = "inverse")';
      default:
        return 'gaussian()';
    }
  }
}

// ============================================================================
// Singleton & Registration
// ============================================================================

export const mixedEffectsRunner = new MixedEffectsRunner();

// Register with central registry
analysisRegistry.register(mixedEffectsRunner);
