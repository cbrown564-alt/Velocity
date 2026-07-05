/**
 * Returning-researcher helpers (STAB-UI-E Phase 4).
 * Pure functions — no React or engine dependencies.
 */

import type { TableConfig } from '../../../types/analysis';
import type { Variable } from '../../../types';
import type { StoredDataset } from '../types';
import { MS_THREE_DAYS } from '../../../lib/welcomeBack';
import { enrichTableConfigLabels } from '../../../store/datasetSessionCoordinator';

export type ResumeCandidate = {
  datasetId: string;
  datasetName: string;
  summaryLine: string;
};

export type FindResumeCandidateOptions = {
  /** Live variable catalog for the active dataset (store), when table config is in memory. */
  liveVariables?: Variable[];
  now?: number;
};

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isOpaqueId(value: string): boolean {
  return UUID_LIKE.test(value);
}

function resolveVarLabel(
  id: string,
  variables: Variable[] | undefined,
  tableConfig: TableConfig,
  rowIndex?: number,
): string {
  const match = variables?.find((x) => x.id === id || x.name === id);
  if (match?.label) return match.label;
  if (match?.name && !isOpaqueId(match.name)) return match.name;

  if (rowIndex !== undefined && tableConfig.rowVarLabels?.[rowIndex]) {
    const label = tableConfig.rowVarLabels[rowIndex];
    if (!isOpaqueId(label)) return label;
  }

  if (tableConfig.colVar === id && tableConfig.colVarLabel && !isOpaqueId(tableConfig.colVarLabel)) {
    return tableConfig.colVarLabel;
  }

  if (!isOpaqueId(id)) return id;
  return id;
}

function buildAnalysisSummary(tableConfig: TableConfig, variables?: Variable[]): string | null {
  const rowVars = tableConfig.rowVars ?? [];
  const colVar = tableConfig.colVar;
  if (rowVars.length === 0 && !colVar) return null;

  const rowLabels = rowVars.map((id, index) => resolveVarLabel(id, variables, tableConfig, index));
  const colLabel = colVar ? resolveVarLabel(colVar, variables, tableConfig) : null;

  if (rowLabels.some(isOpaqueId) || (colLabel && isOpaqueId(colLabel))) {
    return null;
  }

  const rowLabel = rowLabels.join(', ');
  if (rowLabel && colLabel) return `${rowLabel} × ${colLabel}`;
  return rowLabel || colLabel || null;
}

/** Pick the best dataset to resume from workspace + persisted analysis config. */
export function findResumeCandidate(
  datasets: StoredDataset[],
  activeDatasetId: string | null,
  tableConfig: TableConfig,
  options: FindResumeCandidateOptions = {},
): ResumeCandidate | null {
  const now = options.now ?? Date.now();
  const hasLiveConfig = tableConfig.rowVars.length > 0 || Boolean(tableConfig.colVar);

  const scoreDataset = (d: StoredDataset): number => {
    const session = d.sessionState?.tableConfig;
    const hasSession = Boolean(session?.rowVars?.length || session?.colVar);
    if (!hasSession && !hasLiveConfig) return -1;
    let score = d.lastModifiedAt;
    if (d.id === activeDatasetId) score += 1_000_000_000_000;
    if (hasLiveConfig && d.id === activeDatasetId) score += 500_000_000_000;
    return score;
  };

  const ranked = [...datasets]
    .map((d) => ({ d, score: scoreDataset(d) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score);

  const pick = ranked[0]?.d;
  if (!pick) return null;

  const useLive = pick.id === activeDatasetId && hasLiveConfig;
  const variables = useLive ? (options.liveVariables ?? pick.variables) : pick.variables;
  const rawCfg = useLive ? tableConfig : (pick.sessionState?.tableConfig ?? { rowVars: [], colVar: null });
  const cfg = enrichTableConfigLabels(rawCfg, variables);

  const analysis = buildAnalysisSummary(cfg, variables);

  const editedAgoMs = now - pick.lastModifiedAt;
  const editedNote =
    editedAgoMs < 86_400_000
      ? `${Math.max(1, Math.floor(editedAgoMs / 3_600_000))}h ago`
      : `${Math.floor(editedAgoMs / MS_THREE_DAYS)}d ago`;

  const summaryLine = analysis
    ? `You were analyzing ${analysis} in ${pick.name} (${editedNote}).`
    : `Resume your last analysis in ${pick.name} (${editedNote}).`;

  return {
    datasetId: pick.id,
    datasetName: pick.name,
    summaryLine,
  };
}

/** Hover tooltip for workspace cards with saved session state. */
export function formatDeckSummaryTooltip(dataset: StoredDataset): string | null {
  const session = dataset.sessionState;
  if (!session?.tableConfig) return null;

  const analysis = buildAnalysisSummary(session.tableConfig, dataset.variables);
  if (!analysis) return null;

  const parts: string[] = [analysis];

  const filterCount = Array.isArray(session.activeFilters) ? session.activeFilters.length : 0;
  if (filterCount > 0) {
    parts.push(`${filterCount} active filter${filterCount === 1 ? '' : 's'}`);
  }

  const transformCount = Array.isArray(session.transformLog) ? session.transformLog.length : 0;
  if (transformCount > 0) {
    parts.push(`${transformCount} saved transform${transformCount === 1 ? '' : 's'}`);
  }

  return parts.join(' · ');
}
