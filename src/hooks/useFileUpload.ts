/**
 * useFileUpload — File upload orchestration extracted from App.tsx
 */

import React, { useCallback } from 'react';
import { useVelocityStore } from '../store';
import { MOCK_DATASET } from '../constants';
import * as opfsFileManager from '../services/opfsFileManager';

type AppMode = 'splash' | 'uploading' | 'dashboard' | 'restoring' | 'metadata';

const SAV_WARN_MB = 50;
const SAV_HARD_MB = 200;
const SAV_SAMPLE_ROWS = 1000;
const SAV_ELEVATED_RISK_CELLS = 20_000_000;
const SAV_HIGH_RISK_CELLS = 40_000_000;

export interface FileUploadState {
  pendingSavFile: File | null;
  pendingSavSizeMb: number | null;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleMetadataLoadFull: () => Promise<void>;
  handleMetadataCancel: () => Promise<void>;
  handleDemoClick: () => void;
}

export function useFileUpload(
  setMode: React.Dispatch<React.SetStateAction<AppMode>>,
  opfsAvailableLocal: boolean,
): FileUploadState {
  const { dataset, loadCSV, loadSAV, loadSAVSample, discardPersistedData } = useVelocityStore();

  const [pendingSavFile, setPendingSavFile] = React.useState<File | null>(null);
  const [pendingSavSizeMb, setPendingSavSizeMb] = React.useState<number | null>(null);
  const [opfsStorageKey, setOpfsStorageKey] = React.useState<string | null>(null);

  const loadMockData = useCallback(async () => {
    if (MOCK_DATASET.data.length === 0) return;
    const headers = Object.keys(MOCK_DATASET.data[0]);
    const csvRows = [
      headers.join(','),
      ...MOCK_DATASET.data.map(row => headers.map(fieldName => `"${row[fieldName]}"`).join(','))
    ];
    const csvContent = csvRows.join('\n');
    await loadCSV('mock_data.csv', csvContent);
    setMode('dashboard');
  }, [loadCSV, setMode]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMode('uploading');

    try {
      const ext = file.name.toLowerCase().split('.').pop();

      if (ext === 'sav') {
        const datasetId = crypto.randomUUID();
        const fileSizeMb = file.size / (1024 * 1024);
        const shouldWarn = fileSizeMb >= SAV_WARN_MB;
        const mustMetadataOnly = fileSizeMb >= SAV_HARD_MB;

        setPendingSavFile(file);
        setPendingSavSizeMb(fileSizeMb);

        let buffer: ArrayBuffer | null = null;
        let storageKey: string | null = null;

        // Store in OPFS for local-first restore (best-effort).
        if (opfsAvailableLocal) {
          try {
            if (dataset?.opfsFileKey) {
              await opfsFileManager.deleteFile(dataset.opfsFileKey).catch(() => { });
            }

            let canStore = true;
            const estimate = await opfsFileManager.getStorageEstimate();
            if (estimate) {
              const available = estimate.quota - estimate.usage;
              const required = Math.ceil(file.size * 1.2);
              if (available < required) {
                canStore = false;
                console.warn('📁 [App] Skipping OPFS storage due to low quota');
              }
            }

            if (canStore) {
              storageKey = opfsFileManager.generateStorageKey(file.name);
              buffer = await file.arrayBuffer();
              await opfsFileManager.storeFile(storageKey, buffer);
              setOpfsStorageKey(storageKey);
              console.log(`📁 [App] Stored file in OPFS: ${storageKey}`);
            }
          } catch (opfsErr) {
            console.warn('📁 [App] Failed to store in OPFS, will fall back to file reference:', opfsErr);
            storageKey = null;
            setOpfsStorageKey(null);
          }
        }

        if (!buffer) {
          buffer = await file.arrayBuffer();
        }

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
            const riskSummary = sampledRows > 0 && sampledVars > 0
              ? `${sampledRows.toLocaleString()} rows × ${sampledVars.toLocaleString()} variables (${estimatedCells.toLocaleString()} cells).`
              : `${fileSizeMb.toFixed(1)} MB file.`;
            const proceed = window.confirm(
              `This SAV file is high-risk for browser memory pressure.\n\n${riskSummary}\n\nLoad full data anyway?`
            );
            if (!proceed) {
              setMode('metadata');
              return;
            }
          }
        }

        await loadSAV(file.name, buffer, { datasetId, opfsFileKey: storageKey || undefined });
        setOpfsStorageKey(null);
        setPendingSavFile(null);
        setPendingSavSizeMb(null);
      } else {
        setPendingSavFile(null);
        setPendingSavSizeMb(null);
        setOpfsStorageKey(null);
        // CSV or other text file
        const text = await file.text();
        await loadCSV(file.name, text);
      }

      setMode('dashboard');
    } catch (err) {
      console.error(err);
      alert('Error loading file. Check console.');
      setMode('splash');
    }
  }, [dataset?.opfsFileKey, loadCSV, loadSAV, loadSAVSample, opfsAvailableLocal, setMode]);

  const handleMetadataLoadFull = useCallback(async () => {
    if (!pendingSavFile && !opfsStorageKey) return;
    setMode('uploading');

    try {
      let buffer: ArrayBuffer;
      let fileName: string;

      if (opfsStorageKey) {
        console.log(`📁 [App] Reading from OPFS: ${opfsStorageKey}`);
        buffer = await opfsFileManager.readFile(opfsStorageKey);
        fileName = pendingSavFile?.name || 'restored.sav';
      } else if (pendingSavFile) {
        buffer = await pendingSavFile.arrayBuffer();
        fileName = pendingSavFile.name;
      } else {
        throw new Error('No file available to load');
      }

      await loadSAV(fileName, buffer, { opfsFileKey: opfsStorageKey || undefined });
      setOpfsStorageKey(null);
      setPendingSavFile(null);
      setPendingSavSizeMb(null);
      setMode('dashboard');
    } catch (err) {
      console.error(err);
      alert('Error loading file. Check console.');
      setMode('splash');
    }
  }, [pendingSavFile, opfsStorageKey, loadSAV, setMode]);

  const handleMetadataCancel = useCallback(async () => {
    await discardPersistedData();
    if (opfsStorageKey) {
      await opfsFileManager.deleteFile(opfsStorageKey).catch(() => { });
      setOpfsStorageKey(null);
    }
    setPendingSavFile(null);
    setPendingSavSizeMb(null);
    setMode('splash');
  }, [discardPersistedData, opfsStorageKey, setMode]);

  const handleDemoClick = useCallback(() => {
    setMode('uploading');
    setTimeout(() => { loadMockData(); }, 800);
  }, [loadMockData, setMode]);

  return {
    pendingSavFile,
    pendingSavSizeMb,
    handleFileUpload,
    handleMetadataLoadFull,
    handleMetadataCancel,
    handleDemoClick,
  };
}
