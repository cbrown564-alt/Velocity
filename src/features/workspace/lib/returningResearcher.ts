/**
 * Returning-researcher helpers (STAB-UI-E Phase 4).
 * Pure functions — no React or engine dependencies.
 */

import type { Variable } from '../../../types';
import type { StoredDataset } from '../types';
import { MS_THREE_DAYS } from '../../../lib/welcomeBack';

export type ResumeCandidate = {
  datasetId: string;
  datasetName: string;
  summaryLine: string;
};

function resolveVarLabel(id: string, variables?: Variable[]): string {
  const v = variables?.find((x) => x.id === id || x.name === id);
  return v?.label || v?.name || id;
}

/** Pick the best dataset to resume from workspace + persisted analysis config. */
export function findResumeCandidate(
  datasets: StoredDataset[],
  activeDatasetId: string | null,
  tableConfig: { rowVars: string[]; colVar: string | null },
  now = Date.now(),
): ResumeCandidate | null {
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
  const cfg = useLive ? tableConfig : (pick.sessionState?.tableConfig ?? { rowVars: [], colVar: null });

  const rowVars = cfg.rowVars ?? [];
  const colVar = cfg.colVar;
  if (rowVars.length === 0 && !colVar) return null;

  const vars = pick.variables;
  const rowLabel = rowVars.map((id) => resolveVarLabel(id, vars)).join(', ');
  const colLabel = colVar ? resolveVarLabel(colVar, vars) : null;
  const analysis = rowLabel && colLabel ? `${rowLabel} × ${colLabel}` : rowLabel || colLabel || 'your last analysis';

  const editedAgoMs = now - pick.lastModifiedAt;
  const editedNote =
    editedAgoMs < 86_400_000
      ? `${Math.max(1, Math.floor(editedAgoMs / 3_600_000))}h ago`
      : `${Math.floor(editedAgoMs / MS_THREE_DAYS)}d ago`;

  return {
    datasetId: pick.id,
    datasetName: pick.name,
    summaryLine: `You were analyzing ${analysis} in ${pick.name} (${editedNote}).`,
  };
}

/** Hover tooltip for workspace cards with saved session state. */
export function formatDeckSummaryTooltip(dataset: StoredDataset): string | null {
  const session = dataset.sessionState;
  if (!session?.tableConfig) return null;

  const { rowVars, colVar } = session.tableConfig;
  const vars = dataset.variables;
  const labels = [
    ...rowVars.map((id) => resolveVarLabel(id, vars)),
    ...(colVar ? [resolveVarLabel(colVar, vars)] : []),
  ].filter(Boolean);

  if (labels.length === 0) return null;

  const parts: string[] = [];
  if (labels.length >= 2) {
    parts.push(`${labels[0]} × ${labels.slice(1).join(', ')}`);
  } else {
    parts.push(labels[0]);
  }

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
