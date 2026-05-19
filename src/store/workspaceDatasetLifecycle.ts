/**
 * Workspace dataset lifecycle helpers (STAB-ARCH-1 §8.2).
 *
 * Pure orchestration for OPFS source rehydration and workspace dataset open/switch.
 * Store slice methods delegate here to keep dataSlice.ts thin.
 */

import * as opfsFileManager from '../services/opfsFileManager';
import type { EngineProxy } from '../services/EngineProxy';
import type {
  DataTransform,
  Dataset,
  Folder,
  PersistenceState,
  Variable,
  VariableSet,
  WorkspaceDatasetOpenInput,
} from './slices/dataSlice';
import {
  buildVariableSetsFromVariables,
  normalizeVariable,
  normalizeVariableSet,
} from './slices/dataSlice';

export type RunAnalysisFn = () => Promise<void>;

export interface RehydrateFromOpfsContext {
  engineProxy: EngineProxy;
  dataset: Dataset;
  transformLog: DataTransform[];
  runAnalysis?: RunAnalysisFn;
  flushPersistedData: () => Promise<void>;
}

export async function rehydrateDatasetFromOpfsSource(
  ctx: RehydrateFromOpfsContext,
  options?: { forceReload?: boolean },
): Promise<void> {
  const { engineProxy, dataset, transformLog, runAnalysis, flushPersistedData } = ctx;

  if (!dataset.opfsFileKey) throw new Error('Dataset has no OPFS source key');

  if (!options?.forceReload) {
    try {
      const status = await engineProxy.ping();
      if (status.hasData) {
        if (runAnalysis) {
          void runAnalysis().catch((error) => {
            console.warn('[workspaceDatasetLifecycle] Analysis replay failed during OPFS rehydration shortcut:', error);
          });
        }
        return;
      }
    } catch {
      // Ping failed, proceed with rehydration
    }
  }

  console.log(`[workspaceDatasetLifecycle] Rehydrating DuckDB from OPFS source: ${dataset.opfsFileKey}`);
  const opfsOk = await opfsFileManager.isAvailable().catch(() => false);
  if (!opfsOk) {
    throw new Error('OPFS is unavailable in this browser/session (private browsing can disable it)');
  }

  const sourceKey = dataset.opfsFileKey;
  const exists = await opfsFileManager.fileExists(sourceKey).catch(() => false);
  if (!exists) {
    throw new Error(`OPFS source file not found: ${sourceKey}`);
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await opfsFileManager.readFile(sourceKey);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error) || 'Unknown read error';
    throw new Error(`Failed to read OPFS source file (${sourceKey}): ${message}`);
  }

  await engineProxy.loadSAV(buffer);

  if (transformLog.length > 0) {
    console.log(`[workspaceDatasetLifecycle] Replaying ${transformLog.length} transforms`);
  }

  for (const transform of transformLog) {
    if (transform.type !== 'recode') continue;
    try {
      await engineProxy.recodeVariable(transform.sourceColId, transform.newColId, transform.config);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[workspaceDatasetLifecycle] Transform replay failed:', message);
    }
  }

  if (runAnalysis) {
    await runAnalysis();
  }

  void flushPersistedData();
}

export interface WorkspaceDatasetOpenPatch {
  dataset: Dataset;
  variableSets: VariableSet[];
  folders: Folder[];
  transformLog: DataTransform[];
  tableConfig: { rowVars: string[]; colVar: string | null };
  activeFilters: unknown[];
}

export function buildWorkspaceDatasetOpenPatch(stored: WorkspaceDatasetOpenInput): WorkspaceDatasetOpenPatch {
  const variables = (stored.variables ?? []).map(normalizeVariable);
  const variableSets = stored.variableSets && stored.variableSets.length > 0
    ? stored.variableSets.map(normalizeVariableSet)
    : buildVariableSetsFromVariables(variables);
  const session = stored.sessionState;
  const transformLog = (session?.transformLog ?? []) as DataTransform[];
  const fileName = stored.fileName || stored.name;

  return {
    dataset: {
      id: stored.id,
      name: fileName,
      rowCount: stored.rowCount,
      variables,
      source: stored.source,
      opfsFileKey: stored.opfsFileKey,
      metadataOnly: variables.length === 0,
    },
    variableSets,
    folders: stored.folders ?? [],
    transformLog,
    tableConfig: session?.tableConfig ?? { rowVars: [], colVar: null },
    activeFilters: session?.activeFilters ?? [],
  };
}

export interface OpenWorkspaceDatasetContext {
  engineProxy: EngineProxy;
  currentDataset: Dataset | null;
  runAnalysis?: RunAnalysisFn;
  flushPersistedData: () => Promise<void>;
  respawnWorker: (cleanStart?: boolean) => Promise<void>;
  getEngineProxy: () => EngineProxy | null;
  getPersistenceState: () => PersistenceState;
  applyOpenPatch: (patch: WorkspaceDatasetOpenPatch) => void;
  applySameDatasetSession: (sessionState: WorkspaceDatasetOpenInput['sessionState']) => void;
  rehydrateFromOpfs: (options?: { forceReload?: boolean }) => Promise<void>;
  setPersistenceReady: (fileName: string, rowCount: number) => void;
}

export async function openWorkspaceDatasetLifecycle(
  stored: WorkspaceDatasetOpenInput,
  ctx: OpenWorkspaceDatasetContext,
): Promise<void> {
  const { engineProxy, currentDataset, runAnalysis } = ctx;

  if (currentDataset?.id === stored.id) {
    if (stored.sessionState) {
      ctx.applySameDatasetSession(stored.sessionState);
    }
    if (runAnalysis) {
      await runAnalysis();
    }
    return;
  }

  if (currentDataset) {
    await ctx.flushPersistedData().catch(() => {});
  }

  const patch = buildWorkspaceDatasetOpenPatch(stored);
  ctx.applyOpenPatch(patch);

  await ctx.respawnWorker(false);

  const activeProxy = ctx.getEngineProxy();
  if (!activeProxy) throw new Error('Engine not initialized after dataset switch');

  let hasData = false;
  try {
    const ping = await activeProxy.ping();
    hasData = ping.hasData;
  } catch {
    hasData = false;
  }

  const needsSourceRebuild = !hasData || ctx.getPersistenceState() === 'corrupt';

  if (needsSourceRebuild) {
    if (!stored.opfsFileKey) {
      throw new Error('Dataset has no persisted source file. Re-upload the original file.');
    }

    const exists = await opfsFileManager.fileExists(stored.opfsFileKey).catch(() => false);
    if (!exists) {
      throw new Error(`OPFS source file not found: ${stored.opfsFileKey}`);
    }

    await ctx.rehydrateFromOpfs({ forceReload: true });
    return;
  }

  const fileName = stored.fileName || stored.name;
  ctx.setPersistenceReady(fileName, stored.rowCount);

  if (runAnalysis) {
    await runAnalysis();
  }
}
