import type { Dataset } from '../types';
import type { ResultEnvelope } from './types';
import type { VelocityEngineState } from './velocityEngineTypes';

export function wrapEnvelope<T>(
  state: VelocityEngineState,
  engineVersion: string,
  operation: string,
  inputs: Record<string, unknown>,
  fn: () => Promise<T>,
  warnings: string[] = [],
): Promise<ResultEnvelope<T>> {
  const start = performance.now();
  return fn().then((data) => {
    const dataset = state.dataset;
    return {
      data,
      operation,
      inputs,
      durationMs: performance.now() - start,
      warnings,
      metadata: {
        datasetName: dataset?.name ?? 'unloaded',
        rowCount: dataset?.rowCount ?? 0,
        filtersApplied: state.activeFilters.length,
        isWeighted: !!dataset?.weightVariable,
        engineVersion,
      },
    };
  });
}

export function wrapEnvelopeSync<T>(
  state: VelocityEngineState,
  engineVersion: string,
  operation: string,
  inputs: Record<string, unknown>,
  fn: () => T,
  warnings: string[] = [],
): ResultEnvelope<T> {
  const start = performance.now();
  const data = fn();
  const dataset: Dataset | null = state.dataset;

  return {
    data,
    operation,
    inputs,
    durationMs: performance.now() - start,
    warnings,
    metadata: {
      datasetName: dataset?.name ?? 'unloaded',
      rowCount: dataset?.rowCount ?? 0,
      filtersApplied: state.activeFilters.length,
      isWeighted: !!dataset?.weightVariable,
      engineVersion,
    },
  };
}
