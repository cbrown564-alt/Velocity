import { findOpfsFile, walkOpfs } from '../opfsTraversal';
import { OPFS_BASE_NAME, OPFS_SCHEMA_VERSION, workerDbState } from './workerDbState';

export async function cleanOPFS(): Promise<void> {
  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const entriesToDelete: string[] = [];

    for await (const entry of walkOpfs(opfsRoot)) {
      if (entry.handle.kind !== 'file') continue;
      if (!entry.name.startsWith(OPFS_BASE_NAME)) continue;
      entriesToDelete.push(entry.path);
      try {
        await entry.parent.removeEntry(entry.name, { recursive: true });
        console.log(`🦆 [Worker] Removed OPFS entry: ${entry.path}`);
      } catch (e: any) {
        console.warn(`🦆 [Worker] Failed to remove ${entry.path}:`, e.message);
      }
    }

    console.log('🦆 [Worker] Found OPFS DB entries to clean:', entriesToDelete);
    console.log('🦆 [Worker] Cleared all OPFS storage');
  } catch (error: any) {
    console.warn('🦆 [Worker] Failed to clean OPFS:', error.message);
  }
}

export async function listOpfsDbFiles(): Promise<{ name: string; path: string; lastModified: number }[]> {
  const root = await navigator.storage.getDirectory();
  const files: { name: string; path: string; lastModified: number }[] = [];

  for await (const entry of walkOpfs(root)) {
    if (entry.handle.kind !== 'file') continue;
    if (!entry.name.startsWith(OPFS_BASE_NAME)) continue;
    if (!entry.name.endsWith('.db')) continue;
    if (entry.name.includes('.corrupt_')) continue;
    const file = await (entry.handle as FileSystemFileHandle).getFile();
    files.push({ name: entry.name, path: entry.path, lastModified: file.lastModified });
  }

  files.sort((a, b) => b.lastModified - a.lastModified);
  return files;
}

export async function detectOpfsSupport(): Promise<{ supported: boolean; error?: string }> {
  try {
    if (typeof self !== 'undefined' && !(self as any).isSecureContext) {
      return { supported: false, error: 'Insecure context (OPFS requires HTTPS or localhost)' };
    }

    if (!navigator?.storage || typeof navigator.storage.getDirectory !== 'function') {
      return { supported: false, error: 'OPFS not supported (StorageManager.getDirectory unavailable)' };
    }

    await navigator.storage.getDirectory();
    return { supported: true };
  } catch (error: any) {
    return { supported: false, error: error?.message || 'OPFS unsupported in this environment' };
  }
}

export function parseDuckDbVersion(version: string): [number, number, number] | null {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isVersionAtLeast(version: [number, number, number], minimum: [number, number, number]): boolean {
  for (let i = 0; i < 3; i++) {
    if (version[i] > minimum[i]) return true;
    if (version[i] < minimum[i]) return false;
  }
  return true;
}

export function buildOpfsDbPath(
  datasetId?: string,
  schemaVersion: number = workerDbState.persistenceContext.schemaVersion,
): string {
  const datasetPart = datasetId ? `_dataset_${datasetId}` : '_default';
  const versionPart = `_v${schemaVersion}`;
  return `opfs://${OPFS_BASE_NAME}${versionPart}${datasetPart}.db`;
}

export function buildRepairDbPath(): string {
  const datasetPart = workerDbState.persistenceContext.datasetId
    ? `_dataset_${workerDbState.persistenceContext.datasetId}`
    : '_default';
  const versionPart = `_v${workerDbState.persistenceContext.schemaVersion}`;
  return `opfs://${OPFS_BASE_NAME}${versionPart}${datasetPart}_repair_${Date.now()}.db`;
}

export async function quarantineCorruptedDb(dbPath: string): Promise<void> {
  try {
    if (!dbPath.startsWith('opfs://')) return;
    const opfsRoot = await navigator.storage.getDirectory();
    const target = await findOpfsFile(opfsRoot, dbPath);
    if (!target) {
      console.warn('🦆 [Worker] Failed to quarantine corrupted DB: The object can not be found here.');
      return;
    }

    const quarantineName = `${target.name}.corrupt_${Date.now()}`;
    const file = await target.handle.getFile();
    const buffer = await file.arrayBuffer();
    const destHandle = await target.parent.getFileHandle(quarantineName, { create: true });
    const writable = await destHandle.createWritable();
    try {
      await writable.write(buffer);
    } finally {
      await writable.close();
    }
    await target.parent.removeEntry(target.name);
    console.warn('🦆 [Worker] Quarantined corrupted OPFS DB:', quarantineName);
  } catch (error: any) {
    console.warn('🦆 [Worker] Failed to quarantine corrupted DB:', error?.message || error);
  }
}

export async function removeOpfsDbFile(dbPath: string): Promise<void> {
  if (!dbPath.startsWith('opfs://')) return;

  try {
    const opfsRoot = await navigator.storage.getDirectory();
    const fileName = dbPath.replace('opfs://', '');
    await opfsRoot.removeEntry(fileName);
    console.log('🦆 [Worker] Removed OPFS DB file:', fileName);
  } catch (error: any) {
    if (error?.name !== 'NotFoundError') {
      console.warn('🦆 [Worker] Failed to remove OPFS DB file:', error?.message || error);
    }
  }
}
