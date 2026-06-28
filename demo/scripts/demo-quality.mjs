export function evaluateTimingTargets(steps = [], targets = []) {
  return targets.map((target) => {
    const step = steps.find((candidate) => candidate.id === target.stepId);
    if (!step) {
      return {
        ...target,
        actualDurationMs: null,
        status: 'missing',
      };
    }

    return {
      ...target,
      actualDurationMs: step.durationMs,
      status: step.durationMs <= target.maxDurationMs ? 'passed' : 'failed',
    };
  });
}

export function summarizeRecoverabilityChecks(checks = []) {
  return checks.map((check) => ({
    id: check.id,
    description: check.description,
    status: check.status ?? 'manual',
    evidence: check.evidence ?? null,
  }));
}

export function buildQualitySummary({
  steps = [],
  timingTargets = [],
  recoverabilityChecks = [],
  consoleMessages = [],
  pageErrors = [],
} = {}) {
  const timingResults = evaluateTimingTargets(steps, timingTargets);
  const recoverability = summarizeRecoverabilityChecks(recoverabilityChecks);
  const consoleErrors = consoleMessages.filter((message) => message.type === 'error').map((message) => message.text);
  const pageErrorMessages = pageErrors.map((error) => error.message ?? String(error));

  const hasFailedTiming = timingResults.some((target) => target.status === 'failed' || target.status === 'missing');
  const hasManualChecks = recoverability.some((check) => check.status === 'manual');
  const hasErrors = consoleErrors.length > 0 || pageErrorMessages.length > 0;

  return {
    status: hasFailedTiming || hasErrors ? 'needs_review' : hasManualChecks ? 'needs_review' : 'passed',
    timingTargets: timingResults,
    recoverabilityChecks: recoverability,
    consoleErrors,
    pageErrors: pageErrorMessages,
  };
}
