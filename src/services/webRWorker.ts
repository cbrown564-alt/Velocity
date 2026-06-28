/**
 * WebR Worker
 *
 * Dedicated Web Worker for running R in the browser via WebR.
 * Isolated from DuckDB worker for failure isolation and parallel operation.
 *
 * Features:
 * - Lazy loading: WebR only loads on first init message
 * - Package management: Pre-loads survey, loads lme4 on demand
 * - Arrow IPC: Accepts data as Arrow buffers for efficient transfer
 * - Progress reporting: Reports initialization and package download progress
 */

import type {
  WebRWorkerRequest,
  WebRWorkerResponse,
  WebRStatus,
  RResult,
  SurveyDesignConfig,
  SurveyResult,
  MixedModelConfig,
  MixedModelResult,
} from '../types/webr';

// WebR instance (lazy loaded)
let webR: any = null;
let status: WebRStatus = {
  status: 'idle',
  loadedPackages: [],
  initProgress: 0,
};

// ============================================================================
// Initialization
// ============================================================================

async function initWebR(): Promise<void> {
  if (webR !== null) {
    return; // Already initialized
  }

  updateStatus('initializing', 0, 'Loading WebR runtime...');

  try {
    // Dynamic import to enable lazy loading
    const { WebR } = await import('webr');

    updateStatus('initializing', 10, 'Initializing WebR...');

    webR = new WebR();
    await webR.init();

    updateStatus('initializing', 50, 'WebR initialized, loading survey package...');

    // Pre-load the survey package (always needed for design effects)
    await loadPackageInternal('survey');

    updateStatus('ready', 100, 'WebR ready');

    postResponse({ type: 'ready' });
  } catch (error: any) {
    console.error('🔬 [WebR Worker] Init failed:', error);
    updateStatus('error', 0, undefined, error.message);
    postResponse({ type: 'error', message: error.message || 'Failed to initialize WebR' });
  }
}

// ============================================================================
// Package Management
// ============================================================================

const AVAILABLE_PACKAGES = ['survey', 'lme4', 'Matrix', 'MASS'];

async function loadPackageInternal(packageName: string): Promise<void> {
  if (!webR) {
    throw new Error('WebR not initialized');
  }

  if (status.loadedPackages.includes(packageName)) {
    return; // Already loaded
  }

  postResponse({ type: 'packageProgress', packageName, progress: 0 });

  try {
    // Install package from webR repository
    await webR.installPackages([packageName], {
      quiet: false,
      mount: true,
    });

    postResponse({ type: 'packageProgress', packageName, progress: 50 });

    // Load into R session
    await webR.evalR(`library(${packageName})`);

    status.loadedPackages.push(packageName);
    postResponse({ type: 'packageProgress', packageName, progress: 100 });
    postResponse({ type: 'packageLoaded', packageName });

    console.log(`🔬 [WebR Worker] Loaded package: ${packageName}`);
  } catch (err: any) {
    console.error(`🔬 [WebR Worker] Failed to load package ${packageName}:`, err);
    throw new Error(`Failed to load R package "${packageName}": ${err.message}`, { cause: err });
  }
}

// ============================================================================
// R Code Execution
// ============================================================================

async function executeR(code: string, data?: Uint8Array): Promise<RResult> {
  if (!webR) {
    throw new Error('WebR not initialized');
  }

  const start = performance.now();
  let output: string;
  const warnings: string[] = [];

  try {
    // If data provided, load it as Arrow IPC
    if (data) {
      await loadArrowData(data);
    }

    // Execute the R code
    const shelter = await webR.Shelter();
    try {
      const result = await shelter.evalR(code, { captureStreams: true });

      // Capture output
      const stdout = (await result.stdout?.toArray?.()) ?? [];
      const stderr = (await result.stderr?.toArray?.()) ?? [];

      output = stdout.join('\n');
      if (stderr.length > 0) {
        warnings.push(...stderr);
      }

      // Try to extract values from the result
      const values = await extractRValues(result);

      return {
        output,
        values,
        warnings: warnings.length > 0 ? warnings : undefined,
        durationMs: performance.now() - start,
      };
    } finally {
      await shelter.purge();
    }
  } catch (err: any) {
    console.error('🔬 [WebR Worker] R execution error:', err);
    throw new Error(`R execution failed: ${err.message}`, { cause: err });
  }
}

async function loadArrowData(buffer: Uint8Array): Promise<void> {
  // Write buffer to virtual filesystem
  await webR.FS.writeFile('/data.arrow', buffer);

  // Load in R using arrow package
  await ensurePackage('arrow');
  await webR.evalR(`
    df <- arrow::read_ipc_file("/data.arrow")
    df <- as.data.frame(df)
  `);
}

async function ensurePackage(packageName: string): Promise<void> {
  if (!status.loadedPackages.includes(packageName)) {
    await loadPackageInternal(packageName);
  }
}

async function extractRValues(result: any): Promise<Record<string, any> | undefined> {
  try {
    const jsValue = await result.toJs?.();
    if (jsValue !== undefined && jsValue !== null) {
      return { result: jsValue };
    }
  } catch {
    // Result may not be convertible to JS
  }
  return undefined;
}

// ============================================================================
// Survey Analysis (survey package)
// ============================================================================

async function runSurveyAnalysis(config: SurveyDesignConfig, data: Uint8Array): Promise<SurveyResult> {
  const start = performance.now();

  await loadArrowData(data);
  await ensurePackage('survey');

  // Build survey design specification
  const designCode = buildSurveyDesign(config);
  const analysisCode = buildSurveyAnalysis(config);

  const fullCode = `
    ${designCode}
    ${analysisCode}
  `;

  try {
    const shelter = await webR.Shelter();
    try {
      await shelter.evalR(fullCode);

      // Extract results
      const result = await extractSurveyResults(config, shelter);
      result.durationMs = performance.now() - start;

      return result;
    } finally {
      await shelter.purge();
    }
  } catch (err: any) {
    throw new Error(`Survey analysis failed: ${err.message}`, { cause: err });
  }
}

function buildSurveyDesign(config: SurveyDesignConfig): string {
  const parts: string[] = ['design <- svydesign('];

  // IDs (clusters)
  if (config.clusterVar) {
    parts.push(`  ids = ~${config.clusterVar},`);
  } else {
    parts.push('  ids = ~1,');
  }

  // Strata
  if (config.strataVar) {
    parts.push(`  strata = ~${config.strataVar},`);
  }

  // Weights
  if (config.weightVar) {
    parts.push(`  weights = ~${config.weightVar},`);
  }

  // FPC
  if (config.fpc) {
    if (typeof config.fpc === 'string') {
      parts.push(`  fpc = ~${config.fpc},`);
    } else {
      parts.push(`  fpc = rep(${config.fpc}, nrow(df)),`);
    }
  }

  parts.push('  data = df');
  parts.push(')');

  return parts.join('\n');
}

function buildSurveyAnalysis(config: SurveyDesignConfig): string {
  const lines: string[] = [];

  for (const stat of config.statistics) {
    const formula = `~${config.analysisVars.join(' + ')}`;

    if (config.byVar) {
      switch (stat) {
        case 'mean':
          lines.push(`result_mean <- svyby(${formula}, ~${config.byVar}, design, svymean, deff = TRUE)`);
          break;
        case 'total':
          lines.push(`result_total <- svyby(${formula}, ~${config.byVar}, design, svytotal, deff = TRUE)`);
          break;
        case 'proportion':
          lines.push(`result_prop <- svyby(${formula}, ~${config.byVar}, design, svymean, deff = TRUE)`);
          break;
      }
    } else {
      switch (stat) {
        case 'mean':
          lines.push(`result_mean <- svymean(${formula}, design, deff = TRUE)`);
          break;
        case 'total':
          lines.push(`result_total <- svytotal(${formula}, design, deff = TRUE)`);
          break;
        case 'proportion':
          lines.push(`result_prop <- svymean(${formula}, design, deff = TRUE)`);
          break;
        case 'variance':
          lines.push(`result_var <- svyvar(${formula}, design)`);
          break;
      }
    }
  }

  // Extract confidence intervals
  if (config.statistics.includes('mean')) {
    lines.push('result_ci <- confint(result_mean)');
  }

  return lines.join('\n');
}

async function extractSurveyResults(config: SurveyDesignConfig, shelter: any): Promise<SurveyResult> {
  const result: SurveyResult = {
    deff: {},
    estimates: {},
    standardErrors: {},
    confidenceIntervals: {},
    effectiveN: {},
    durationMs: 0,
  };

  try {
    // Extract mean results if computed
    const hasMean = config.statistics.includes('mean');
    if (hasMean) {
      const meanResult = await shelter.evalR('as.data.frame(result_mean)');
      const meanDf = await meanResult.toJs();

      // Parse the data frame structure
      for (const varName of config.analysisVars) {
        const idx = meanDf.values?.[varName];
        if (idx !== undefined) {
          result.estimates[varName] = Number(idx);
        }
      }

      // Extract deff
      const deffResult = await shelter.evalR('deff(result_mean)');
      const deffValues = await deffResult.toJs();
      if (Array.isArray(deffValues)) {
        config.analysisVars.forEach((v, i) => {
          result.deff[v] = deffValues[i] || 1;
        });
      }

      // Extract standard errors
      const seResult = await shelter.evalR('SE(result_mean)');
      const seValues = await seResult.toJs();
      if (Array.isArray(seValues)) {
        config.analysisVars.forEach((v, i) => {
          result.standardErrors[v] = seValues[i] || 0;
        });
      }

      // Extract confidence intervals
      const ciResult = await shelter.evalR('as.matrix(result_ci)');
      const ciMatrix = await ciResult.toJs();
      if (ciMatrix?.data) {
        config.analysisVars.forEach((v, i) => {
          result.confidenceIntervals[v] = {
            lower: ciMatrix.data[i]?.[0] || 0,
            upper: ciMatrix.data[i]?.[1] || 0,
          };
        });
      }
    }
  } catch (error: any) {
    console.warn('🔬 [WebR Worker] Failed to extract survey results:', error);
    result.rawOutput = error.message;
  }

  return result;
}

// ============================================================================
// Mixed Effects Models (lme4 package)
// ============================================================================

async function runMixedModel(config: MixedModelConfig, data: Uint8Array): Promise<MixedModelResult> {
  const start = performance.now();

  await loadArrowData(data);
  await ensurePackage('lme4');

  const modelCode = buildMixedModelCode(config);

  try {
    const shelter = await webR.Shelter();
    try {
      await shelter.evalR(modelCode);

      const result = await extractMixedModelResults(config, shelter);
      result.durationMs = performance.now() - start;

      return result;
    } finally {
      await shelter.purge();
    }
  } catch (err: any) {
    throw new Error(`Mixed model analysis failed: ${err.message}`, { cause: err });
  }
}

function buildMixedModelCode(config: MixedModelConfig): string {
  const lines: string[] = [];

  // Build formula
  const fixedPart = config.fixedEffects.join(' + ');
  const randomParts = config.randomEffects.map((re) => {
    if (re.slopes && re.slopes.length > 0) {
      const slopeFormula =
        re.correlated !== false
          ? `(1 + ${re.slopes.join(' + ')} | ${re.groupVar})`
          : `(1 | ${re.groupVar}) + (0 + ${re.slopes.join(' + ')} | ${re.groupVar})`;
      return slopeFormula;
    }
    return `(1 | ${re.groupVar})`;
  });

  const formula = `${config.responseVar} ~ ${fixedPart} + ${randomParts.join(' + ')}`;

  // Build model call
  if (config.family && config.family !== 'gaussian') {
    // GLMM
    const familyStr = config.link ? `${config.family}(link = "${config.link}")` : config.family;
    lines.push(`model <- glmer(${formula}, data = df, family = ${familyStr})`);
  } else {
    // LMM
    const remlStr = config.reml !== false ? 'TRUE' : 'FALSE';
    lines.push(`model <- lmer(${formula}, data = df, REML = ${remlStr})`);
  }

  // Extract summary
  lines.push('model_summary <- summary(model)');

  return lines.join('\n');
}

async function extractMixedModelResults(config: MixedModelConfig, shelter: any): Promise<MixedModelResult> {
  const result: MixedModelResult = {
    fixedEffects: [],
    randomEffects: [],
    residualVariance: 0,
    residualStdDev: 0,
    fitStats: {
      AIC: 0,
      BIC: 0,
      logLik: 0,
      deviance: 0,
      df: 0,
    },
    nObs: 0,
    nGroups: {},
    converged: true,
    durationMs: 0,
  };

  try {
    // Fixed effects
    const fixefResult = await shelter.evalR('as.data.frame(coef(model_summary))');
    const fixefDf = await fixefResult.toJs();

    if (fixefDf?.values) {
      const names = fixefDf.rowNames || Object.keys(fixefDf.values.Estimate || {});
      names.forEach((name: string, i: number) => {
        result.fixedEffects.push({
          name,
          estimate: fixefDf.values.Estimate?.[i] || 0,
          standardError: fixefDf.values['Std. Error']?.[i] || 0,
          tValue: fixefDf.values['t value']?.[i] || fixefDf.values['z value']?.[i] || 0,
          pValue: fixefDf.values['Pr(>|t|)']?.[i] || fixefDf.values['Pr(>|z|)']?.[i],
        });
      });
    }

    // Random effects variance
    const vcovResult = await shelter.evalR('as.data.frame(VarCorr(model))');
    const vcovDf = await vcovResult.toJs();

    if (vcovDf?.values) {
      const groups = vcovDf.values.grp || [];
      const vars = vcovDf.values.var1 || [];
      const vcors = vcovDf.values.vcov || [];
      const sdcors = vcovDf.values.sdcor || [];

      groups.forEach((group: string, i: number) => {
        if (group === 'Residual') {
          result.residualVariance = vcors[i] || 0;
          result.residualStdDev = sdcors[i] || 0;
        } else {
          result.randomEffects.push({
            group,
            effect: vars[i] || '(Intercept)',
            variance: vcors[i] || 0,
            stdDev: sdcors[i] || 0,
          });
        }
      });
    }

    // Model fit statistics
    const aicResult = await shelter.evalR('AIC(model)');
    const bicResult = await shelter.evalR('BIC(model)');
    const llResult = await shelter.evalR('logLik(model)');

    result.fitStats.AIC = (await aicResult.toJs()) || 0;
    result.fitStats.BIC = (await bicResult.toJs()) || 0;

    const llValue = await llResult.toJs();
    result.fitStats.logLik = llValue?.value || llValue || 0;
    result.fitStats.df = llValue?.df || 0;
    result.fitStats.deviance = -2 * result.fitStats.logLik;

    // Number of observations
    const nobsResult = await shelter.evalR('nobs(model)');
    result.nObs = (await nobsResult.toJs()) || 0;

    // Number of groups
    const ngroupsResult = await shelter.evalR('as.list(ngrps(model))');
    const ngroups = await ngroupsResult.toJs();
    if (ngroups) {
      Object.entries(ngroups).forEach(([key, value]) => {
        result.nGroups[key] = Number(value) || 0;
      });
    }

    // Check convergence
    const convResult = await shelter.evalR('model@optinfo$conv$lme4$code');
    const convCode = await convResult.toJs();
    result.converged = convCode === 0 || convCode === null;

    // Calculate ICC for intercept-only models
    if (config.fixedEffects.length === 0 || (config.fixedEffects.length === 1 && config.fixedEffects[0] === '1')) {
      const interceptVariance = result.randomEffects.find((re) => re.effect === '(Intercept)')?.variance || 0;
      const totalVariance = interceptVariance + result.residualVariance;
      if (totalVariance > 0) {
        result.icc = interceptVariance / totalVariance;
      }
    }
  } catch (error: any) {
    console.warn('🔬 [WebR Worker] Failed to extract mixed model results:', error);
    result.rawOutput = error.message;
  }

  return result;
}

// ============================================================================
// Status Management
// ============================================================================

function updateStatus(newStatus: WebRStatus['status'], progress?: number, message?: string, error?: string): void {
  status.status = newStatus;
  if (progress !== undefined) {
    status.initProgress = progress;
  }
  if (error !== undefined) {
    status.lastError = error;
  }

  if (message) {
    postResponse({ type: 'initProgress', progress: status.initProgress, message });
  }
}

// ============================================================================
// Message Posting
// ============================================================================

function postResponse(response: WebRWorkerResponse): void {
  self.postMessage(response);
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = async (event: MessageEvent<WebRWorkerRequest>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case 'init':
        await initWebR();
        break;

      case 'loadPackage':
        if (!AVAILABLE_PACKAGES.includes(request.packageName)) {
          throw new Error(`Package "${request.packageName}" is not available`);
        }
        await loadPackageInternal(request.packageName);
        break;

      case 'executeR': {
        status.status = 'busy';
        const rResult = await executeR(request.code, request.data);
        status.status = 'ready';
        postResponse({ type: 'rResult', result: rResult });
        break;
      }

      case 'runSurveyAnalysis': {
        status.status = 'busy';
        const surveyResult = await runSurveyAnalysis(request.config, request.data);
        status.status = 'ready';
        postResponse({ type: 'surveyResult', result: surveyResult });
        break;
      }

      case 'runMixedModel': {
        status.status = 'busy';
        const mixedResult = await runMixedModel(request.config, request.data);
        status.status = 'ready';
        postResponse({ type: 'mixedModelResult', result: mixedResult });
        break;
      }

      case 'getStatus':
        postResponse({ type: 'status', status: { ...status } });
        break;

      case 'terminate':
        if (webR) {
          await webR.close?.();
          webR = null;
        }
        status = {
          status: 'idle',
          loadedPackages: [],
          initProgress: 0,
        };
        break;
    }
  } catch (error: any) {
    console.error('🔬 [WebR Worker] Error:', error);
    status.status = status.loadedPackages.length > 0 ? 'ready' : 'error';
    postResponse({
      type: 'error',
      message: error.message || 'Unknown error',
      code: error.code,
    });
  }
};

console.log('🔬 [WebR Worker] Initialized (waiting for init message)');
