/**
 * useFileUpload — File upload orchestration (STAB-ARCH-1 §8.4).
 */

import React, { useCallback } from 'react';
import { formatUploadFailure, getUploadFormatError } from '../../../lib/uploadFeedback';
import * as opfsFileManager from '../../../services/opfsFileManager';
import { recordPilotEvent } from '../../../services/pilotOnboarding';
import { useVelocityStore } from '../../../store';
import { assignOpfsKeyAndLoad, assignOpfsStorageForUpload } from './assignOpfsKeyAndLoad';

type AppMode = 'splash' | 'uploading' | 'dashboard' | 'restoring' | 'metadata';

const SAV_WARN_MB = 50;
const SAV_HARD_MB = 200;
const SAV_SAMPLE_ROWS = 1000;
const SAV_ELEVATED_RISK_CELLS = 20_000_000;
const SAV_HIGH_RISK_CELLS = 40_000_000;

export const EXAMPLE_SAV_URL = '/examples/sleep.sav';
export const EXAMPLE_SAV_NAME = 'sleep.sav';

export interface FileUploadState {
  pendingSavFile: File | null;
  pendingSavSizeMb: number | null;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDroppedFile: (file: File) => Promise<void>;
  handleMetadataLoadFull: () => Promise<void>;
  handleMetadataCancel: () => Promise<void>;
  handleDemoClick: () => void;
}

export function useFileUpload(
  setMode: React.Dispatch<React.SetStateAction<AppMode>>,
  opfsAvailableLocal: boolean,
): FileUploadState {
  const loadCSV = useVelocityStore((state) => state.loadCSV);
  const loadSAV = useVelocityStore((state) => state.loadSAV);
  const loadSAVSample = useVelocityStore((state) => state.loadSAVSample);
  const discardPersistedData = useVelocityStore((state) => state.discardPersistedData);
  const setLoadProgress = useVelocityStore((state) => state.setLoadProgress);
  const addToast = useVelocityStore((state) => state.addToast);

  const [pendingSavFile, setPendingSavFile] = React.useState<File | null>(null);
  const [pendingSavSizeMb, setPendingSavSizeMb] = React.useState<number | null>(null);
  const [opfsStorageKey, setOpfsStorageKey] = React.useState<string | null>(null);

  const reportUploadError = useCallback(
    (err: unknown, fileName: string) => {
      const { title, message, duration } = formatUploadFailure(err, fileName);
      addToast({ type: 'error', title, message, duration });
      setLoadProgress(null);
      setMode('splash');
    },
    [addToast, setLoadProgress, setMode],
  );

  const processUploadFile = useCallback(
    async (file: File) => {
      const formatError = getUploadFormatError(file.name);
      if (formatError) {
        addToast({
          type: 'warning',
          title: formatError.title,
          message: formatError.message,
          duration: formatError.duration,
        });
        return;
      }

      setMode('uploading');

      const ext = file.name.toLowerCase().split('.').pop();
      recordPilotEvent('file_selected', {
        fileName: file.name,
        fileSizeMb: Number((file.size / (1024 * 1024)).toFixed(2)),
        format: ext ?? 'unknown',
      });

      try {
        if (ext === 'sav') {
          const datasetId = crypto.randomUUID();
          const fileSizeMb = file.size / (1024 * 1024);
          const shouldWarn = fileSizeMb >= SAV_WARN_MB;
          const mustMetadataOnly = fileSizeMb >= SAV_HARD_MB;

          setPendingSavFile(file);
          setPendingSavSizeMb(fileSizeMb);

          const { buffer, storageKey } = await assignOpfsStorageForUpload(file, opfsAvailableLocal);
          setOpfsStorageKey(storageKey);

          if (mustMetadataOnly || shouldWarn) {
            await loadSAVSample(file.name, buffer, SAV_SAMPLE_ROWS);

            const sampledDataset = useVelocityStore.getState().dataset;
            const sampledRows = sampledDataset?.rowCount ?? 0;
            const sampledVars = sampledDataset?.variables.length ?? 0;
            const estimatedCells = sampledRows * sampledVars;
            const isHighCellRisk = estimatedCells >= SAV_HIGH_RISK_CELLS;
            const isElevatedCellRisk = estimatedCells >= SAV_ELEVATED_RISK_CELLS;

            if (mustMetadataOnly || isHighCellRisk) {
              setMode('metadata');
              return;
            }

            if (shouldWarn || isElevatedCellRisk) {
              const riskSummary =
                sampledRows > 0 && sampledVars > 0
                  ? `${sampledRows.toLocaleString()} rows × ${sampledVars.toLocaleString()} variables (${estimatedCells.toLocaleString()} cells).`
                  : `${fileSizeMb.toFixed(1)} MB file.`;
              const proceed = window.confirm(
                `This SAV file is high-risk for browser memory pressure.\n\n${riskSummary}\n\nLoad full data anyway?`,
              );
              if (!proceed) {
                setMode('metadata');
                return;
              }
            }
          }

          await assignOpfsKeyAndLoad(file.name, buffer, loadSAV, { datasetId, opfsFileKey: storageKey });
          setOpfsStorageKey(null);
          setPendingSavFile(null);
          setPendingSavSizeMb(null);
        } else {
          setPendingSavFile(null);
          setPendingSavSizeMb(null);
          setOpfsStorageKey(null);
          setLoadProgress({
            phase: 'parsing',
            progress: 0.05,
            message: 'Reading file...',
          });
          const text = await file.text();
          setLoadProgress({
            phase: 'parsing',
            progress: 0.2,
            message: 'Parsing variables...',
          });
          await loadCSV(file.name, text);
        }

        setLoadProgress(null);
        setMode('dashboard');
      } catch (err) {
        console.error(err);
        reportUploadError(err, file.name);
      }
    },
    [loadCSV, loadSAV, loadSAVSample, opfsAvailableLocal, setMode, setLoadProgress, addToast, reportUploadError],
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      await processUploadFile(file);
    },
    [processUploadFile],
  );

  const handleDroppedFile = useCallback(
    async (file: File) => {
      await processUploadFile(file);
    },
    [processUploadFile],
  );

  const loadExampleDataset = useCallback(async () => {
    setMode('uploading');
    setLoadProgress({
      phase: 'parsing',
      progress: 0.1,
      message: 'Loading Sleep study example…',
    });

    try {
      const response = await fetch(EXAMPLE_SAV_URL);
      if (!response.ok) {
        throw new Error('Example dataset is unavailable. Check your connection and reload.');
      }

      const buffer = await response.arrayBuffer();
      const file = new File([buffer], EXAMPLE_SAV_NAME, { type: 'application/octet-stream' });

      recordPilotEvent('file_selected', {
        fileName: EXAMPLE_SAV_NAME,
        fileSizeMb: Number((file.size / (1024 * 1024)).toFixed(2)),
        format: 'sav',
        source: 'example',
      });

      const { storageKey } = await assignOpfsStorageForUpload(file, opfsAvailableLocal);
      await assignOpfsKeyAndLoad(EXAMPLE_SAV_NAME, buffer, loadSAV, { opfsFileKey: storageKey });

      setLoadProgress(null);
      setMode('dashboard');
      addToast({
        type: 'info',
        title: 'Sleep study example loaded',
        message: 'Explore sex × marital status, then export an editable PowerPoint slide.',
        duration: 9000,
      });
    } catch (err) {
      console.error(err);
      reportUploadError(err, EXAMPLE_SAV_NAME);
    }
  }, [addToast, loadSAV, opfsAvailableLocal, reportUploadError, setLoadProgress, setMode]);

  const handleMetadataLoadFull = useCallback(async () => {
    if (!pendingSavFile && !opfsStorageKey) return;
    setMode('uploading');

    try {
      let buffer: ArrayBuffer;
      let fileName: string;

      if (opfsStorageKey) {
        console.log(`[useFileUpload] Reading from OPFS: ${opfsStorageKey}`);
        buffer = await opfsFileManager.readFile(opfsStorageKey);
        fileName = pendingSavFile?.name || 'restored.sav';
      } else if (pendingSavFile) {
        buffer = await pendingSavFile.arrayBuffer();
        fileName = pendingSavFile.name;
      } else {
        throw new Error('No file available to load');
      }

      await assignOpfsKeyAndLoad(fileName, buffer, loadSAV, { opfsFileKey: opfsStorageKey });
      setOpfsStorageKey(null);
      setPendingSavFile(null);
      setPendingSavSizeMb(null);
      setMode('dashboard');
    } catch (err) {
      console.error(err);
      reportUploadError(err, pendingSavFile?.name ?? 'dataset.sav');
    }
  }, [pendingSavFile, opfsStorageKey, loadSAV, setMode, reportUploadError]);

  const handleMetadataCancel = useCallback(async () => {
    await discardPersistedData();
    if (opfsStorageKey) {
      await opfsFileManager.deleteFile(opfsStorageKey).catch(() => {});
      setOpfsStorageKey(null);
    }
    setPendingSavFile(null);
    setPendingSavSizeMb(null);
    setMode('splash');
  }, [discardPersistedData, opfsStorageKey, setMode]);

  const handleDemoClick = useCallback(() => {
    void loadExampleDataset();
  }, [loadExampleDataset]);

  return {
    pendingSavFile,
    pendingSavSizeMb,
    handleFileUpload,
    handleDroppedFile,
    handleMetadataLoadFull,
    handleMetadataCancel,
    handleDemoClick,
  };
}

export default useFileUpload;
