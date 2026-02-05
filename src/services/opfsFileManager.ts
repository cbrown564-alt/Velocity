/**
 * OPFS File Manager
 *
 * Manages uploaded SAV files in the Origin Private File System (OPFS).
 * This enables:
 * - Storing large SAV files client-side for later processing
 * - "Load Full Data" without requiring re-upload from disk
 * - Graceful fallback when OPFS is unavailable (private browsing)
 */

const UPLOADED_DIR = 'uploaded_sav';
import { walkOpfs, resolveOpfsPath } from './opfsTraversal';

const DB_PREFIX = 'velocity_data';

/**
 * Check if OPFS is available in the current environment.
 */
export async function isAvailable(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
      return false;
    }
    // Try to access OPFS to confirm it works
    await navigator.storage.getDirectory();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the uploaded_sav directory handle, creating it if needed.
 */
async function getUploadedDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(UPLOADED_DIR, { create: true });
}

/**
 * Store a file in OPFS.
 *
 * @param name - Unique name for the file (typically filename + timestamp)
 * @param buffer - File contents as ArrayBuffer
 */
export async function storeFile(name: string, buffer: ArrayBuffer): Promise<void> {
  const dir = await getUploadedDir();
  const safeName = sanitizeFileName(name);

  const fileHandle = await dir.getFileHandle(safeName, { create: true });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(buffer);
  } finally {
    await writable.close();
  }

  console.log(`📁 [OPFS] Stored file: ${safeName} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

/**
 * Read a file from OPFS.
 *
 * @param name - Name of the file to read
 * @returns ArrayBuffer containing file contents
 */
export async function readFile(name: string): Promise<ArrayBuffer> {
  const dir = await getUploadedDir();
  const safeName = sanitizeFileName(name);

  const fileHandle = await dir.getFileHandle(safeName);
  const file = await fileHandle.getFile();
  const buffer = await file.arrayBuffer();

  console.log(`📁 [OPFS] Read file: ${safeName} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  return buffer;
}

/**
 * Delete a file from OPFS.
 *
 * @param name - Name of the file to delete
 */
export async function deleteFile(name: string): Promise<void> {
  const dir = await getUploadedDir();
  const safeName = sanitizeFileName(name);

  try {
    await dir.removeEntry(safeName);
    console.log(`📁 [OPFS] Deleted file: ${safeName}`);
  } catch (error: any) {
    // File might not exist - that's okay
    if (error.name !== 'NotFoundError') {
      throw error;
    }
  }
}

/**
 * List all stored files.
 *
 * @returns Array of file info objects
 */
export async function listFiles(): Promise<{ name: string; size: number; lastModified: number }[]> {
  const dir = await getUploadedDir();
  const files: { name: string; size: number; lastModified: number }[] = [];

  // @ts-expect-error - entries() returns an async iterator
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile();
      files.push({
        name,
        size: file.size,
        lastModified: file.lastModified,
      });
    }
  }

  return files;
}

/**
 * Check if a specific file exists in OPFS.
 *
 * @param name - Name of the file to check
 */
export async function fileExists(name: string): Promise<boolean> {
  const dir = await getUploadedDir();
  const safeName = sanitizeFileName(name);

  try {
    await dir.getFileHandle(safeName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the size of a file in OPFS.
 *
 * @param name - Name of the file
 * @returns File size in bytes, or 0 if not found
 */
export async function getFileSize(name: string): Promise<number> {
  const dir = await getUploadedDir();
  const safeName = sanitizeFileName(name);

  try {
    const fileHandle = await dir.getFileHandle(safeName);
    const file = await fileHandle.getFile();
    return file.size;
  } catch {
    return 0;
  }
}

/**
 * Get storage estimate for quota info.
 */
export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  try {
    if (!navigator.storage?.estimate) {
      return null;
    }
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage || 0,
      quota: estimate.quota || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Clear all stored files.
 */
export async function clearAll(): Promise<void> {
  const root = await navigator.storage.getDirectory();

  try {
    await root.removeEntry(UPLOADED_DIR, { recursive: true });
    console.log(`📁 [OPFS] Cleared all uploaded files`);
  } catch (error: any) {
    // Directory might not exist
    if (error.name !== 'NotFoundError') {
      throw error;
    }
  }
}

/**
 * List DuckDB OPFS files (including quarantined files).
 */
export async function listDbFiles(): Promise<{ name: string; size: number; lastModified: number }[]> {
  const root = await navigator.storage.getDirectory();
  const files: { name: string; size: number; lastModified: number }[] = [];

  for await (const entry of walkOpfs(root)) {
    if (entry.handle.kind !== 'file') continue;
    if (!entry.name.startsWith(DB_PREFIX)) continue;
    const file = await (entry.handle as FileSystemFileHandle).getFile();
    files.push({
      name: entry.path,
      size: file.size,
      lastModified: file.lastModified,
    });
  }

  return files;
}

/**
 * Delete a DuckDB OPFS file by name.
 */
export async function deleteDbFile(name: string): Promise<void> {
  const root = await navigator.storage.getDirectory();
  const resolved = await resolveOpfsPath(root, name);
  if (resolved) {
    try {
      await resolved.parent.removeEntry(resolved.name);
      return;
    } catch (error: any) {
      if (error.name !== 'NotFoundError') {
        throw error;
      }
    }
  }

  for await (const entry of walkOpfs(root)) {
    if (entry.handle.kind !== 'file') continue;
    if (entry.path !== name && entry.name !== name) continue;
    await entry.parent.removeEntry(entry.name);
    return;
  }
}

/**
 * Sanitize filename for OPFS storage.
 * Removes or replaces characters that might cause issues.
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 200); // Limit length
}

/**
 * Generate a unique storage key for a file.
 * Combines filename with timestamp to avoid collisions.
 */
export function generateStorageKey(filename: string): string {
  const timestamp = Date.now();
  const base = filename.replace(/\.[^.]+$/, ''); // Remove extension
  const ext = filename.split('.').pop() || 'sav';
  return `${sanitizeFileName(base)}_${timestamp}.${ext}`;
}
