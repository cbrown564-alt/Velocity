import { SESSION_FORMAT_VERSION } from './sessionTypes';
import type {
  ExportSessionInput,
  SessionWorkspaceSnapshot,
  VelocitySessionFile,
} from './sessionTypes';

function getFingerprintColumnNames(input: ExportSessionInput): string[] {
  const derivedIds = new Set<string>();
  for (const transform of input.transformLog) {
    if (transform.type === 'recode') {
      derivedIds.add(transform.newColId);
    }
  }

  return input.dataset.variables
    .map((variable) => variable.id)
    .filter((id) => !derivedIds.has(id));
}

function shouldIncludeWorkspace(input?: ExportSessionInput['workspace']): input is NonNullable<ExportSessionInput['workspace']> {
  if (!input) return false;
  return input.projects.length > 0 || input.datasets.length > 1;
}

function resolveWorkspaceRole(dataset: { waveNumber?: number; id: string }, activeDatasetId?: string | null): string {
  if (typeof dataset.waveNumber === 'number') return `wave_${dataset.waveNumber}`;
  if (activeDatasetId && dataset.id === activeDatasetId) return 'active';
  return 'linked';
}

function buildWorkspaceSnapshot(input: ExportSessionInput): SessionWorkspaceSnapshot | undefined {
  if (!shouldIncludeWorkspace(input.workspace)) return undefined;

  return {
    projects: input.workspace.projects.map((project) => ({ ...project })),
    datasetLinks: input.workspace.datasets.map((dataset) => ({
      datasetFilename: dataset.name,
      datasetRowCount: dataset.rowCount,
      role: resolveWorkspaceRole(dataset, input.activeDatasetId),
    })),
  };
}

export function exportSession(input: ExportSessionInput): VelocitySessionFile {
  const fingerprintColumnNames = getFingerprintColumnNames(input);

  const analysisSettings =
    input.analysisSettings && Object.keys(input.analysisSettings).length > 0
      ? { ...input.analysisSettings }
      : undefined;

  const base: VelocitySessionFile = {
    formatVersion: SESSION_FORMAT_VERSION,
    exportedAt: (input.exportedAt ?? new Date()).toISOString(),
    velocityVersion: input.velocityVersion ?? 'dev',
    dataset: {
      originalFilename: input.dataset.name,
      rowCount: input.dataset.rowCount,
      source: input.dataset.source,
      fingerprint: {
        columnCount: fingerprintColumnNames.length,
        columnNames: fingerprintColumnNames,
        checksum: input.checksum,
      },
    },
    variables: input.dataset.variables.map((variable) => ({ ...variable })),
    variableSets: input.variableSets.map((set) => ({ ...set })),
    folders: input.folders.map((folder) => ({ ...folder })),
    transformLog: input.transformLog.map((transform) => ({ ...transform })),
    tableConfig: {
      rowVars: [...input.tableConfig.rowVars],
      colVar: input.tableConfig.colVar,
    },
    activeFilters: input.activeFilters.map((filter) => ({ ...filter })),
    analysisSettings,
    slides: input.slides.map((slide) => ({ ...slide })),
    sections: input.sections.map((section) => ({ ...section })),
  };

  const workspace = buildWorkspaceSnapshot(input);
  if (workspace) base.workspace = workspace;

  if (input.harmonizationSession !== undefined) {
    base.harmonizationSession = input.harmonizationSession;
  }

  if (input.semantic && Object.keys(input.semantic.annotations).length > 0) {
    base.semantic = input.semantic;
  }

  return base;
}

export function serializeSessionFile(sessionFile: VelocitySessionFile, pretty = true): string {
  return JSON.stringify(sessionFile, null, pretty ? 2 : 0);
}
