/**
 * Workspace library layer — portraits, ambient search, timeline helpers.
 * Pure functions; no React or engine dependencies.
 */

import type { Variable } from '../../../types';
import { normalizeVariableType } from '../../../types/variableType';
import type { Project, StoredDataset } from '../components/WorkspaceView';

const MS_PER_DAY = 86_400_000;
const HEATMAP_DAYS = 7;
const HEATMAP_SLOTS_PER_DAY = 3;

export type ColorSignature = {
  hue: number;
  warmth: number;
  label: 'categorical' | 'numeric' | 'mixed';
};

export type ActivityHeatmapCell = {
  intensity: number;
};

export type SessionPortraitSummary = {
  slideCount: number;
  variableLabels: string[];
  hasAnalysis: boolean;
  editedAgo: string;
};

export type WorkspaceCategoryChip = {
  id: string;
  label: string;
  count: number;
  filter: 'longitudinal' | 'unanalyzed' | 'with-session' | 'recent';
};

export type AmbientSearchHint = {
  id: string;
  message: string;
};

export type HarmonizationRingStatus = 'complete' | 'partial' | 'none';

export type WaveDeltaPreview = {
  variableDelta: number;
  responseRate: number;
  responseDelta?: number;
};

/** Derive a meaningful color signature from variable type mix (warmer = more categorical). */
export function computeColorSignature(variables?: Variable[]): ColorSignature {
  if (!variables || variables.length === 0) {
    return { hue: 210, warmth: 0.5, label: 'mixed' };
  }

  let categorical = 0;
  let numeric = 0;
  for (const v of variables) {
    const t = normalizeVariableType(v.type);
    if (t === 'numeric' || t === 'date') numeric += 1;
    else if (t === 'categorical' || t === 'ordered' || t === 'text') categorical += 1;
    else categorical += 1;
  }

  const total = categorical + numeric || 1;
  const warmth = categorical / total;
  const hue = 28 + (1 - warmth) * 175;
  const label: ColorSignature['label'] =
    warmth > 0.65 ? 'categorical' : warmth < 0.35 ? 'numeric' : 'mixed';

  return { hue, warmth, label };
}

/** 7×3 activity grid from access timestamps (synthetic when no history array). */
export function buildActivityHeatmap(
  lastOpenedAt: number,
  lastModifiedAt: number,
  createdAt: number,
  now = Date.now()
): ActivityHeatmapCell[][] {
  const grid: ActivityHeatmapCell[][] = Array.from({ length: HEATMAP_DAYS }, () =>
    Array.from({ length: HEATMAP_SLOTS_PER_DAY }, () => ({ intensity: 0 }))
  );

  const stamps = [lastOpenedAt, lastModifiedAt, createdAt].filter(t => t > 0);
  for (const ts of stamps) {
    const dayOffset = Math.floor((now - ts) / MS_PER_DAY);
    if (dayOffset < 0 || dayOffset >= HEATMAP_DAYS) continue;
    const dayIndex = HEATMAP_DAYS - 1 - dayOffset;
    const hour = new Date(ts).getHours();
    const slot = Math.min(HEATMAP_SLOTS_PER_DAY - 1, Math.floor(hour / 8));
    const ageFactor = 1 - dayOffset / HEATMAP_DAYS;
    grid[dayIndex][slot].intensity = Math.min(1, grid[dayIndex][slot].intensity + 0.35 + ageFactor * 0.4);
  }

  return grid;
}

export function summarizeSessionPortrait(
  dataset: StoredDataset,
  now = Date.now()
): SessionPortraitSummary {
  const session = dataset.sessionState;
  const rowVars = session?.tableConfig?.rowVars ?? [];
  const colVar = session?.tableConfig?.colVar;
  const vars = [...rowVars, ...(colVar ? [colVar] : [])];
  const hasAnalysis = vars.length > 0;
  const slideCount = hasAnalysis ? Math.max(1, rowVars.length > 0 && colVar ? 1 : rowVars.length) : 0;

  const editedMs = now - dataset.lastModifiedAt;
  const editedAgo =
    editedMs < MS_PER_DAY
      ? `${Math.max(1, Math.floor(editedMs / 3_600_000))}h ago`
      : `${Math.floor(editedMs / MS_PER_DAY)}d ago`;

  return {
    slideCount,
    variableLabels: vars.slice(0, 3),
    hasAnalysis,
    editedAgo,
  };
}

/** Match datasets/projects by name and variable keywords (no ML). */
export function computeAmbientSearchHints(
  query: string,
  datasets: StoredDataset[],
  projects: Project[]
): AmbientSearchHint[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const hints: AmbientSearchHint[] = [];
  const varMatches = datasets.filter(d =>
    (d.variables ?? []).some(
      v =>
        v.name.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q)
    )
  );

  if (varMatches.length > 0) {
    hints.push({
      id: 'var-keyword',
      message: `${varMatches.length} dataset${varMatches.length === 1 ? '' : 's'} include variables matching “${query.trim()}”`,
    });
  }

  const longitudinal = projects.filter(p => p.isLongitudinal);
  if (/wave|longitudinal|panel/i.test(q) && longitudinal.length > 0) {
    hints.push({
      id: 'longitudinal',
      message: `${longitudinal.length} longitudinal project${longitudinal.length === 1 ? '' : 's'} in your library`,
    });
  }

  return hints.slice(0, 3);
}

export function computeWorkspaceCategoryChips(
  datasets: StoredDataset[],
  projects: Project[],
  now = Date.now()
): WorkspaceCategoryChip[] {
  const chips: WorkspaceCategoryChip[] = [];
  const longitudinal = projects.filter(p => p.isLongitudinal).length;
  if (longitudinal > 0) {
    chips.push({
      id: 'longitudinal',
      label: 'Longitudinal',
      count: longitudinal,
      filter: 'longitudinal',
    });
  }

  const unanalyzed = datasets.filter(d => !d.sessionState?.tableConfig?.rowVars?.length).length;
  if (unanalyzed > 0) {
    chips.push({
      id: 'unanalyzed',
      label: 'Unanalyzed',
      count: unanalyzed,
      filter: 'unanalyzed',
    });
  }

  const withSession = datasets.filter(d => Boolean(d.sessionState)).length;
  if (withSession > 0) {
    chips.push({
      id: 'with-session',
      label: 'With session',
      count: withSession,
      filter: 'with-session',
    });
  }

  const recent = datasets.filter(d => now - d.lastOpenedAt < MS_PER_DAY).length;
  if (recent > 0) {
    chips.push({
      id: 'recent',
      label: 'Opened today',
      count: recent,
      filter: 'recent',
    });
  }

  return chips;
}

export function applyWorkspaceCategoryFilter(
  datasets: StoredDataset[],
  projects: Project[],
  filter: WorkspaceCategoryChip['filter']
): StoredDataset[] {
  switch (filter) {
    case 'longitudinal':
      return datasets.filter(d => {
        const p = projects.find(pr => pr.id === d.projectId);
        return Boolean(p?.isLongitudinal);
      });
    case 'unanalyzed':
      return datasets.filter(d => !d.sessionState?.tableConfig?.rowVars?.length);
    case 'with-session':
      return datasets.filter(d => Boolean(d.sessionState));
    case 'recent':
      return datasets.filter(d => Date.now() - d.lastOpenedAt < MS_PER_DAY);
    default:
      return datasets;
  }
}

/** Harmonization ring: variable-name overlap across waves in a project. */
export function computeHarmonizationStatus(
  project: Project,
  datasets: StoredDataset[]
): HarmonizationRingStatus {
  if (!project.isLongitudinal || datasets.length < 2) return 'none';

  const waveDatasets = datasets
    .filter(d => d.projectId === project.id && d.variables && d.variables.length > 0)
    .sort((a, b) => (a.waveNumber ?? 0) - (b.waveNumber ?? 0));

  if (waveDatasets.length < 2) return 'none';

  const nameSets = waveDatasets.map(d => new Set((d.variables ?? []).map(v => v.name.toLowerCase())));
  let minOverlap = 1;
  for (let i = 1; i < nameSets.length; i++) {
    const prev = nameSets[i - 1];
    const curr = nameSets[i];
    const overlap = [...curr].filter(n => prev.has(n)).length;
    const ratio = overlap / Math.max(prev.size, curr.size, 1);
    minOverlap = Math.min(minOverlap, ratio);
  }

  if (minOverlap >= 0.5) return 'complete';
  if (minOverlap >= 0.2) return 'partial';
  return 'none';
}

export function computeWaveDeltaPreview(
  wave: StoredDataset,
  baseline: StoredDataset,
  previous?: StoredDataset
): WaveDeltaPreview {
  const baseVars = baseline.variables?.length ?? baseline.columnCount;
  const waveVars = wave.variables?.length ?? wave.columnCount;
  const variableDelta = waveVars - baseVars;

  const responseRate = baseline.rowCount > 0
    ? Math.round((wave.rowCount / baseline.rowCount) * 100)
    : 100;

  let responseDelta: number | undefined;
  if (previous && previous.rowCount > 0) {
    const prevRate = Math.round((previous.rowCount / baseline.rowCount) * 100);
    responseDelta = responseRate - prevRate;
  }

  return { variableDelta, responseRate, responseDelta };
}

/** Missing wave numbers between min and max for ghost placeholders. */
export function findWaveGaps(datasets: StoredDataset[]): number[] {
  const waves = datasets
    .map(d => d.waveNumber)
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b);

  if (waves.length < 2) return [];

  const gaps: number[] = [];
  for (let w = waves[0]; w <= waves[waves.length - 1]; w++) {
    if (!waves.includes(w)) gaps.push(w);
  }
  return gaps;
}

export function matchesVariableKeyword(dataset: StoredDataset, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return false;
  return (dataset.variables ?? []).some(
    v => v.name.toLowerCase().includes(q) || v.label.toLowerCase().includes(q)
  );
}
