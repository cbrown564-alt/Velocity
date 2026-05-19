/**
 * OPFS key assignment + SAV load helper (STAB-ARCH-1 §8.4).
 *
 * Best-effort OPFS storage for uploaded files, then loadSAV with opfsFileKey wired.
 */

import * as opfsFileManager from '../../../services/opfsFileManager';

export interface AssignOpfsStorageResult {
  buffer: ArrayBuffer;
  storageKey: string | null;
}

/**
 * Store an uploaded file in OPFS when available and quota permits.
 * Always returns a buffer suitable for loadSAV (from OPFS write or fresh read).
 */
export async function assignOpfsStorageForUpload(
  file: File,
  opfsAvailable: boolean,
): Promise<AssignOpfsStorageResult> {
  let buffer: ArrayBuffer | null = null;
  let storageKey: string | null = null;

  if (opfsAvailable) {
    try {
      let canStore = true;
      const estimate = await opfsFileManager.getStorageEstimate();
      if (estimate) {
        const available = estimate.quota - estimate.usage;
        const required = Math.ceil(file.size * 1.2);
        if (available < required) {
          canStore = false;
          console.warn('[assignOpfsKeyAndLoad] Skipping OPFS storage due to low quota');
        }
      }

      if (canStore) {
        storageKey = opfsFileManager.generateStorageKey(file.name);
        buffer = await file.arrayBuffer();
        await opfsFileManager.storeFile(storageKey, buffer);
        console.log(`[assignOpfsKeyAndLoad] Stored file in OPFS: ${storageKey}`);
      }
    } catch (opfsErr) {
      console.warn('[assignOpfsKeyAndLoad] Failed to store in OPFS, will fall back to file reference:', opfsErr);
      storageKey = null;
    }
  }

  if (!buffer) {
    buffer = await file.arrayBuffer();
  }

  return { buffer, storageKey };
}

export type LoadSavFn = (
  fileName: string,
  buffer: ArrayBuffer,
  options?: { datasetId?: string; opfsFileKey?: string },
) => Promise<void>;

export interface AssignOpfsKeyAndLoadOptions {
  datasetId?: string;
  opfsFileKey?: string | null;
}

/**
 * Load a SAV buffer into the engine with optional OPFS source key for local-first restore.
 */
export async function assignOpfsKeyAndLoad(
  fileName: string,
  buffer: ArrayBuffer,
  loadSAV: LoadSavFn,
  options: AssignOpfsKeyAndLoadOptions = {},
): Promise<void> {
  await loadSAV(fileName, buffer, {
    datasetId: options.datasetId,
    opfsFileKey: options.opfsFileKey || undefined,
  });
}
