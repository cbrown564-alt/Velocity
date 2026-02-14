import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as opfs from './opfsFileManager';

class FakeFileEntry {
  private data: Uint8Array;
  lastModified: number;

  constructor(initial?: Uint8Array) {
    this.data = initial ?? new Uint8Array();
    this.lastModified = Date.now();
  }

  setData(input: ArrayBuffer | Uint8Array): void {
    if (input instanceof Uint8Array) {
      this.data = new Uint8Array(input);
    } else {
      this.data = new Uint8Array(input);
    }
    this.lastModified = Date.now();
  }

  toFile() {
    const data = this.data;
    return {
      size: data.byteLength,
      lastModified: this.lastModified,
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    } as File;
  }
}

class FakeWritable {
  constructor(private entry: FakeFileEntry) {}

  async write(input: ArrayBuffer | Uint8Array): Promise<void> {
    this.entry.setData(input);
  }

  async close(): Promise<void> {
    // no-op
  }
}

class FakeFileHandle {
  kind = 'file' as const;

  constructor(public name: string, private entry: FakeFileEntry) {}

  async getFile(): Promise<File> {
    return this.entry.toFile();
  }

  async createWritable(): Promise<FakeWritable> {
    return new FakeWritable(this.entry);
  }
}

class FakeDirectoryHandle {
  kind = 'directory' as const;
  private files = new Map<string, FakeFileEntry>();
  private directories = new Map<string, FakeDirectoryHandle>();

  constructor(public name: string) {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FakeDirectoryHandle> {
    const existing = this.directories.get(name);
    if (existing) return existing;
    if (options?.create) {
      const dir = new FakeDirectoryHandle(name);
      this.directories.set(name, dir);
      return dir;
    }
    throw createNotFoundError();
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FakeFileHandle> {
    const existing = this.files.get(name);
    if (existing) return new FakeFileHandle(name, existing);
    if (options?.create) {
      const entry = new FakeFileEntry();
      this.files.set(name, entry);
      return new FakeFileHandle(name, entry);
    }
    throw createNotFoundError();
  }

  async removeEntry(name: string, _options?: { recursive?: boolean }): Promise<void> {
    if (this.files.delete(name)) return;
    if (this.directories.delete(name)) return;
    throw createNotFoundError();
  }

  async *entries(): AsyncIterable<[string, FakeDirectoryHandle | FakeFileHandle]> {
    for (const [name, dir] of this.directories) {
      yield [name, dir];
    }
    for (const [name, file] of this.files) {
      yield [name, new FakeFileHandle(name, file)];
    }
  }

  // Helpers for tests
  seedFile(name: string, data: Uint8Array): void {
    const entry = new FakeFileEntry(data);
    this.files.set(name, entry);
  }

  hasFile(name: string): boolean {
    return this.files.has(name);
  }
}

function createNotFoundError(): Error {
  const err = new Error('NotFoundError');
  (err as any).name = 'NotFoundError';
  return err;
}

let originalStorage: any;

function mockStorage(root: FakeDirectoryHandle, options?: { estimate?: { usage: number; quota: number } }) {
  const storage = {
    getDirectory: vi.fn(async () => root),
    estimate: options?.estimate ? vi.fn(async () => options.estimate) : undefined,
  };

  Object.defineProperty(navigator, 'storage', {
    value: storage,
    configurable: true,
  });

  return storage;
}

describe('opfsFileManager', () => {
  beforeEach(() => {
    originalStorage = (navigator as any).storage;
  });

  afterEach(() => {
    if (originalStorage === undefined) {
      delete (navigator as any).storage;
    } else {
      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        configurable: true,
      });
    }
    vi.restoreAllMocks();
  });

  it('isAvailable returns false when OPFS is missing or throws', async () => {
    // No storage
    delete (navigator as any).storage;
    await expect(opfs.isAvailable()).resolves.toBe(false);

    // Storage throws
    const root = new FakeDirectoryHandle('root');
    mockStorage(root);
    (navigator as any).storage.getDirectory = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(opfs.isAvailable()).resolves.toBe(false);
  });

  it('stores and reads files from OPFS with sanitized names', async () => {
    const root = new FakeDirectoryHandle('root');
    mockStorage(root);

    const data = new Uint8Array([1, 2, 3, 4]);
    await opfs.storeFile('My File?.sav', data.buffer);

    const files = await opfs.listFiles();
    expect(files.length).toBe(1);
    expect(files[0].name).toBe('My_File_.sav');

    const buffer = await opfs.readFile('My File?.sav');
    expect(new Uint8Array(buffer)).toEqual(data);
  });

  it('lists and deletes DB files by prefix', async () => {
    const root = new FakeDirectoryHandle('root');
    root.seedFile('velocity_data_v1_default.db', new Uint8Array([1]));
    root.seedFile('velocity_data_v1_default.db.corrupt_123', new Uint8Array([2]));
    root.seedFile('other.db', new Uint8Array([3]));
    mockStorage(root);

    const files = await opfs.listDbFiles();
    const names = files.map((f) => f.name).sort();
    expect(names).toEqual([
      'velocity_data_v1_default.db',
      'velocity_data_v1_default.db.corrupt_123',
    ]);

    await opfs.deleteDbFile('velocity_data_v1_default.db');
    expect(root.hasFile('velocity_data_v1_default.db')).toBe(false);

    // NotFound should be ignored
    await expect(opfs.deleteDbFile('missing.db')).resolves.toBeUndefined();
  });

  it('lists and deletes DB files in nested directories', async () => {
    const root = new FakeDirectoryHandle('root');
    const duckDir = await root.getDirectoryHandle('.duckdb', { create: true });
    duckDir.seedFile('velocity_data_v1_default.db', new Uint8Array([5]));
    mockStorage(root);

    const files = await opfs.listDbFiles();
    const names = files.map((f) => f.name).sort();
    expect(names).toEqual(['.duckdb/velocity_data_v1_default.db']);

    await opfs.deleteDbFile('.duckdb/velocity_data_v1_default.db');
    expect(duckDir.hasFile('velocity_data_v1_default.db')).toBe(false);
  });

  it('clears uploaded_sav directory and reports empty list', async () => {
    const root = new FakeDirectoryHandle('root');
    mockStorage(root);

    await opfs.storeFile('test.sav', new Uint8Array([9]).buffer);
    const before = await opfs.listFiles();
    expect(before.length).toBe(1);

    await opfs.clearAll();
    const after = await opfs.listFiles();
    expect(after.length).toBe(0);
  });

  it('returns storage estimates when available', async () => {
    const root = new FakeDirectoryHandle('root');
    mockStorage(root, { estimate: { usage: 123, quota: 456 } });

    await expect(opfs.getStorageEstimate()).resolves.toEqual({ usage: 123, quota: 456 });

    // Missing estimate API returns null
    mockStorage(root);
    await expect(opfs.getStorageEstimate()).resolves.toBeNull();
  });

  it('generates storage keys with sanitized base name', () => {
    const key = opfs.generateStorageKey('My File?.sav');
    expect(key.endsWith('.sav')).toBe(true);
    expect(key.includes('My_File_')).toBe(true);
    expect(key.includes(' ')).toBe(false);
  });
});
