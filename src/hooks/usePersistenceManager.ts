/**
 * usePersistenceManager — Encapsulates all OPFS / persistence state and effects
 * extracted from App.tsx to reduce the monolith.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useVelocityStore } from '../store';
import * as opfsFileManager from '../services/opfsFileManager';

type AppMode = 'splash' | 'uploading' | 'dashboard' | 'restoring' | 'metadata';

const STORAGE_TOAST_SEEN_KEY = 'velocity-storage-backup-toast-seen-v1';

function hasSeenStorageToast(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_TOAST_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markStorageToastSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_TOAST_SEEN_KEY, '1');
  } catch {
    // Ignore localStorage failures (private mode / quota).
  }
}

export interface PersistenceManagerState {
  opfsAvailableLocal: boolean;
  opfsEstimate: { usage: number; quota: number } | null;
  opfsDbFiles: { name: string; size: number; lastModified: number }[] | null;
  opfsDbListError: string | null;
  opfsDbPurgeError: string | null;
  opfsRehydrateError: string | null;
  restoreActionError: string | null;
  showPartialLoadNotice: boolean;
  persistentStorageGranted: boolean | null;
  showStorageReminderToast: boolean;

  // Derived
  opfsUsageMb: number | null;
  opfsQuotaMb: number | null;
  opfsUsagePct: number | null;
  opfsDbLabel: string | null | undefined;
  restoreWarning: string | null;
  restorationPromptWarning: string | null;
  opfsErrorHint: string | null;

  // Dataset diagnostics
  datasetVariableCount: number | null;
  labeledVariableCount: number | null;
  totalValueLabelCount: number | null;
  estimatedCells: number | null;
  memoryRisk: 'normal' | 'elevated' | 'critical';
  partialLoadMessage: string | null;

  // Actions
  rebuildFromOpfsSource: (fallbackMode: AppMode, options?: { forceReload?: boolean }) => Promise<void>;
  attemptRestoreFromPersistence: () => boolean;
  handleDismissPartialLoadNotice: () => void;
  refreshOpfsDbFiles: () => Promise<void>;
  purgeQuarantinedDbs: () => Promise<void>;
  setShowStorageReminderToast: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPartialLoadNotice: React.Dispatch<React.SetStateAction<boolean>>;
}

export function usePersistenceManager(
  mode: AppMode,
  setMode: React.Dispatch<React.SetStateAction<AppMode>>,
): PersistenceManagerState {
  const {
    dataset,
    isDbReady,
    persistenceState,
    persistedDataInfo,
    persistenceError,
    opfsAvailable,
    activeDbPath,
    restoreFromPersistence,
    rehydrateDatasetFromOpfs,
    discardPersistedData,
    initWorker,
    updateStorageQuota,
  } = useVelocityStore();

  // -- Local state --
  const [opfsAvailableLocal, setOpfsAvailableLocal] = React.useState(false);
  const [opfsEstimate, setOpfsEstimate] = React.useState<{ usage: number; quota: number } | null>(null);
  const [opfsDbFiles, setOpfsDbFiles] = React.useState<{ name: string; size: number; lastModified: number }[] | null>(null);
  const [opfsDbListError, setOpfsDbListError] = React.useState<string | null>(null);
  const [opfsDbPurgeError, setOpfsDbPurgeError] = React.useState<string | null>(null);
  const [opfsRehydrateError, setOpfsRehydrateError] = React.useState<string | null>(null);
  const [restoreActionError, setRestoreActionError] = React.useState<string | null>(null);
  const [showPartialLoadNotice, setShowPartialLoadNotice] = React.useState(false);
  const [persistentStorageGranted, setPersistentStorageGranted] = React.useState<boolean | null>(null);
  const [persistentStorageResolved, setPersistentStorageResolved] = React.useState(false);
  const [showStorageReminderToast, setShowStorageReminderToast] = React.useState(false);

  // -- Refs --
  const hasRequestedPersistentStorage = useRef(false);
  const hasShownStorageToast = useRef(false);
  const hasProcessedPersistence = useRef(false);
  const partialNoticeDismissedByDataset = useRef<Set<string>>(new Set());
  const autoRecoveredDatasets = useRef<Set<string>>(new Set());

  // -- Derived values --
  const opfsUsageMb = opfsEstimate ? opfsEstimate.usage / (1024 * 1024) : null;
  const opfsQuotaMb = opfsEstimate ? opfsEstimate.quota / (1024 * 1024) : null;
  const opfsUsagePct = opfsEstimate && opfsEstimate.quota > 0
    ? Math.min(100, Math.round((opfsEstimate.usage / opfsEstimate.quota) * 100))
    : null;
  const opfsDbLabel = activeDbPath?.startsWith('opfs://')
    ? activeDbPath.replace('opfs://', '')
    : activeDbPath;

  const SAV_ELEVATED_RISK_CELLS = 20_000_000;
  const SAV_HIGH_RISK_CELLS = 40_000_000;

  const datasetVariableCount = React.useMemo(() => {
    if (!dataset?.variables) return null;
    return dataset.variables.filter(v => !v.synthetic).length;
  }, [dataset?.variables]);

  const labeledVariableCount = React.useMemo(() => {
    if (!dataset?.variables) return null;
    return dataset.variables.filter(v => !v.synthetic && v.valueLabels.length > 0).length;
  }, [dataset?.variables]);

  const totalValueLabelCount = React.useMemo(() => {
    if (!dataset?.variables) return null;
    return dataset.variables
      .filter(v => !v.synthetic)
      .reduce((sum, v) => sum + v.valueLabels.length, 0);
  }, [dataset?.variables]);

  const estimatedCells = React.useMemo(() => {
    if (!dataset || datasetVariableCount === null) return null;
    return dataset.rowCount * datasetVariableCount;
  }, [dataset, datasetVariableCount]);

  const memoryRisk = React.useMemo<'normal' | 'elevated' | 'critical'>(() => {
    if (estimatedCells === null) return 'normal';
    if (estimatedCells >= SAV_HIGH_RISK_CELLS) return 'critical';
    if (estimatedCells >= SAV_ELEVATED_RISK_CELLS) return 'elevated';
    return 'normal';
  }, [estimatedCells]);

  const categoricalOrOrderedCount = React.useMemo(() => {
    if (!dataset?.variables) return 0;
    return dataset.variables.filter(v => !v.synthetic && (v.type === 'categorical' || v.type === 'ordered')).length;
  }, [dataset?.variables]);

  const likelyMissingValueLabels = React.useMemo(() => {
    if (!dataset || dataset.metadataOnly || dataset.source !== 'sav') return false;
    if (dataset.loadDiagnostics?.isPartial) return true;
    if (categoricalOrOrderedCount < 10) return false;
    if ((totalValueLabelCount ?? 0) === 0) return true;
    if (labeledVariableCount !== null && categoricalOrOrderedCount >= 20) {
      const labeledShare = labeledVariableCount / categoricalOrOrderedCount;
      return labeledShare < 0.1;
    }
    return false;
  }, [dataset, categoricalOrOrderedCount, totalValueLabelCount, labeledVariableCount]);

  const partialLoadMessage = React.useMemo(() => {
    if (dataset?.loadDiagnostics?.isPartial) return dataset.loadDiagnostics.message;
    if (likelyMissingValueLabels) {
      return 'This restored session appears to be missing SAV value labels. Codes may be shown instead of text labels.';
    }
    return null;
  }, [dataset?.loadDiagnostics?.isPartial, dataset?.loadDiagnostics?.message, likelyMissingValueLabels]);

  const restoreWarning = React.useMemo(() => {
    if (!persistedDataInfo?.metadata || !dataset) return null;
    const meta = persistedDataInfo.metadata;
    const mismatches: string[] = [];
    if (meta.datasetId && dataset.id !== meta.datasetId) {
      mismatches.push('dataset id');
    }
    if (dataset.rowCount !== meta.rowCount) {
      mismatches.push('row count');
    }
    if (dataset.variables.length !== meta.columnCount) {
      mismatches.push('column count');
    }
    if (mismatches.length === 0) return null;
    return `Local data differs from OPFS metadata (${mismatches.join(', ')}). Restoring will use OPFS data.`;
  }, [persistedDataInfo, dataset]);

  const restorationPromptWarning = React.useMemo(() => {
    if (!restoreActionError) return restoreWarning;
    if (!restoreWarning) return restoreActionError;
    return `${restoreWarning} ${restoreActionError}`;
  }, [restoreWarning, restoreActionError]);

  const opfsErrorHint = React.useMemo(() => {
    if (!persistenceError) return null;
    const normalized = persistenceError.toLowerCase();

    if (normalized.includes('opfs disabled by feature flag') || normalized.includes('does not support opfs db persistence')) {
      return 'DuckDB OPFS database-file persistence is disabled on this build. Velocity will use in-memory DuckDB and restore from the OPFS source file when available.';
    }
    if (
      normalized.includes('access handle') ||
      normalized.includes('writable stream') ||
      normalized.includes('another open access handle')
    ) {
      return 'OPFS database is locked (often another tab is using it). Close other Velocity tabs and reload to re-enable fast OPFS DB restore.';
    }
    if (
      normalized.includes('not a valid duckdb database file') ||
      normalized.includes('database file appears to be corrupted') ||
      normalized.includes('failed to scan dictionary string') ||
      normalized.includes('invalid bit width for bitpacking') ||
      normalized.includes('out of bounds memory access') ||
      normalized.includes('corrupt')
    ) {
      return 'OPFS database looks corrupted or partially written. Velocity will fall back to rebuilding from the OPFS source file when possible. You can also purge quarantined DBs.';
    }
    if (normalized.includes('insecure context')) {
      return 'OPFS requires a secure context (HTTPS or localhost).';
    }
    if (normalized.includes('unsupported') || normalized.includes('getdirectory')) {
      return 'OPFS is not supported in this browser/environment (private browsing can also disable it).';
    }
    return null;
  }, [persistenceError]);

  // -- Callbacks --
  const rebuildFromOpfsSource = useCallback(async (fallbackMode: AppMode, options?: { forceReload?: boolean }) => {
    if (!dataset?.opfsFileKey) return;
    setOpfsRehydrateError(null);
    setMode('uploading');
    try {
      await rehydrateDatasetFromOpfs(options);
      setMode('dashboard');
    } catch (error: any) {
      const message = error?.message || String(error) || 'Failed to restore from OPFS source file';
      setOpfsRehydrateError(message);
      setMode(fallbackMode);
    }
  }, [dataset?.opfsFileKey, rehydrateDatasetFromOpfs, setMode]);

  const attemptRestoreFromPersistence = useCallback((): boolean => {
    try {
      setRestoreActionError(null);
      restoreFromPersistence();
      return true;
    } catch (error: any) {
      const message = error?.message || String(error) || 'Failed to restore session';
      const normalized = message.toLowerCase();
      if (normalized.includes('quota')) {
        setRestoreActionError('Browser localStorage quota was exceeded while restoring cached metadata. Click Start Fresh to recover.');
      } else {
        setRestoreActionError(`Restore failed: ${message}`);
      }
      console.error('[App] Restore from persistence failed:', error);
      return false;
    }
  }, [restoreFromPersistence]);

  const handleDismissPartialLoadNotice = useCallback(() => {
    if (dataset?.id) {
      partialNoticeDismissedByDataset.current.add(dataset.id);
    }
    setShowPartialLoadNotice(false);
  }, [dataset?.id]);

  const refreshOpfsDbFiles = useCallback(async () => {
    try {
      setOpfsDbListError(null);
      const files = await opfsFileManager.listDbFiles();
      setOpfsDbFiles(files);
    } catch (error: any) {
      setOpfsDbListError(error?.message || 'Failed to list OPFS DB files');
      setOpfsDbFiles(null);
    }
  }, []);

  const purgeQuarantinedDbs = useCallback(async () => {
    try {
      setOpfsDbPurgeError(null);
      const files = opfsDbFiles ?? await opfsFileManager.listDbFiles();
      const quarantined = files.filter((file) => file.name.includes('.corrupt_'));
      await Promise.all(quarantined.map((file) => opfsFileManager.deleteDbFile(file.name)));
      await refreshOpfsDbFiles();
    } catch (error: any) {
      setOpfsDbPurgeError(error?.message || 'Failed to purge quarantined DBs');
    }
  }, [opfsDbFiles, refreshOpfsDbFiles]);

  // -- Effects --

  // Init worker
  useEffect(() => {
    initWorker();
  }, [initWorker]);

  // Request persistent storage
  useEffect(() => {
    if (!isDbReady || hasRequestedPersistentStorage.current) return;
    hasRequestedPersistentStorage.current = true;

    if (!navigator.storage?.persist) {
      setPersistentStorageGranted(null);
      setPersistentStorageResolved(true);
      return;
    }

    let cancelled = false;
    navigator.storage
      .persist()
      .then((granted) => {
        if (cancelled) return;
        setPersistentStorageGranted(granted);
        setPersistentStorageResolved(true);
        console.log(`[Storage] Persistent storage ${granted ? 'granted' : 'denied'}`);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn('[Storage] Failed to request persistent storage:', error);
        setPersistentStorageGranted(false);
        setPersistentStorageResolved(true);
      });

    return () => { cancelled = true; };
  }, [isDbReady]);

  // OPFS availability check
  useEffect(() => {
    opfsFileManager.isAvailable().then(setOpfsAvailableLocal);
  }, []);

  // Storage estimate polling
  useEffect(() => {
    let mounted = true;
    const refreshEstimate = () => {
      opfsFileManager.getStorageEstimate().then((estimate) => {
        if (mounted) setOpfsEstimate(estimate);
      });
    };

    refreshEstimate();
    const interval = window.setInterval(refreshEstimate, 30000);
    return () => { mounted = false; window.clearInterval(interval); };
  }, []);

  // Refresh workspace storage quota periodically
  useEffect(() => {
    const refresh = async () => {
      const estimate = await opfsFileManager.getStorageEstimate();
      if (estimate) {
        updateStorageQuota(estimate.usage, estimate.quota);
      }
    };

    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Partial load notice
  useEffect(() => {
    if (!dataset?.id || !partialLoadMessage) {
      setShowPartialLoadNotice(false);
      return;
    }
    if (mode !== 'dashboard') {
      setShowPartialLoadNotice(false);
      return;
    }
    if (partialNoticeDismissedByDataset.current.has(dataset.id)) return;
    setShowPartialLoadNotice(true);
  }, [dataset?.id, partialLoadMessage, mode]);

  const tableConfig = useVelocityStore((state) => state.tableConfig);

  // Storage reminder toast — defer until first analysis shelf use (UXR-005)
  useEffect(() => {
    if (!dataset?.id || hasShownStorageToast.current) return;
    if (hasSeenStorageToast()) {
      hasShownStorageToast.current = true;
      return;
    }
    const hasStartedAnalysis =
      tableConfig.rowVars.length > 0 || tableConfig.colVar !== null;
    if (!hasStartedAnalysis) return;

    hasShownStorageToast.current = true;
    markStorageToastSeen();
    setShowStorageReminderToast(true);
  }, [dataset?.id, tableConfig.rowVars.length, tableConfig.colVar]);

  useEffect(() => {
    if (!showStorageReminderToast) return;
    const timer = window.setTimeout(() => setShowStorageReminderToast(false), 10000);
    return () => window.clearTimeout(timer);
  }, [showStorageReminderToast]);

  // Persistence state handling
  useEffect(() => {
    if (hasProcessedPersistence.current) return;

    if (persistenceState === 'found' && persistedDataInfo) {
      const shouldWaitForStorageDecision = Boolean(dataset?.opfsFileKey) && !persistentStorageResolved;
      if (shouldWaitForStorageDecision) {
        return;
      }

      const persistedMeta = persistedDataInfo.metadata;
      const hasMatchingMetadata = dataset && (persistedMeta
        ? (
          dataset.rowCount === persistedMeta.rowCount &&
          dataset.variables.length === persistedMeta.columnCount &&
          (persistedMeta.datasetId ? dataset.id === persistedMeta.datasetId : true)
        )
        : (
          dataset.rowCount === persistedDataInfo.rowCount &&
          dataset.variables.length === persistedDataInfo.schema.length
        ));
      const shouldPreferSourceRebuild = Boolean(dataset?.opfsFileKey) && persistentStorageGranted === false;

      if (hasMatchingMetadata && shouldPreferSourceRebuild) {
        console.log('[App] Persistent storage denied; rebuilding from OPFS source file instead of trusting persisted DuckDB cache');
        hasProcessedPersistence.current = true;
        void rebuildFromOpfsSource('splash', { forceReload: true });
      } else if (hasMatchingMetadata) {
        console.log('[App] Auto-restoring: localStorage metadata matches OPFS data');
        hasProcessedPersistence.current = true;
        const restored = attemptRestoreFromPersistence();
        setMode(restored ? 'dashboard' : 'restoring');
      } else {
        console.log('[App] Showing restoration prompt: metadata mismatch or missing');
        setMode('restoring');
      }
    } else if (persistenceState === 'ready' && mode === 'restoring') {
      hasProcessedPersistence.current = true;
      if (dataset) {
        setMode('dashboard');
      } else {
        setMode('splash');
      }
    } else if (persistenceState === 'ready' && mode === 'splash') {
      if (dataset?.opfsFileKey) {
        console.log('[App] Rehydrating DuckDB from OPFS source file');
        hasProcessedPersistence.current = true;
        void rebuildFromOpfsSource('splash');
      } else {
        hasProcessedPersistence.current = true;
      }
    }
  }, [persistenceState, persistedDataInfo, dataset, mode, persistentStorageGranted, persistentStorageResolved, attemptRestoreFromPersistence, rebuildFromOpfsSource, setMode]);

  useEffect(() => {
    if (persistenceState !== 'corrupt') return;
    if (!dataset?.opfsFileKey || !dataset?.id) return;
    if (autoRecoveredDatasets.current.has(dataset.id)) return;

    autoRecoveredDatasets.current.add(dataset.id);
    console.log('[App] Persisted DuckDB restore failed; rebuilding from OPFS source file');
    void rebuildFromOpfsSource(mode === 'dashboard' ? 'dashboard' : 'splash', { forceReload: true });
  }, [dataset?.id, dataset?.opfsFileKey, mode, persistenceState, rebuildFromOpfsSource]);

  return {
    opfsAvailableLocal,
    opfsEstimate,
    opfsDbFiles,
    opfsDbListError,
    opfsDbPurgeError,
    opfsRehydrateError,
    restoreActionError,
    showPartialLoadNotice,
    persistentStorageGranted,
    showStorageReminderToast,
    opfsUsageMb,
    opfsQuotaMb,
    opfsUsagePct,
    opfsDbLabel,
    restoreWarning,
    restorationPromptWarning,
    opfsErrorHint,
    datasetVariableCount,
    labeledVariableCount,
    totalValueLabelCount,
    estimatedCells,
    memoryRisk,
    partialLoadMessage,
    rebuildFromOpfsSource,
    attemptRestoreFromPersistence,
    handleDismissPartialLoadNotice,
    refreshOpfsDbFiles,
    purgeQuarantinedDbs,
    setShowStorageReminderToast,
    setShowPartialLoadNotice,
  };
}
