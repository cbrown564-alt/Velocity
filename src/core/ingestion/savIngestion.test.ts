import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadSav, loadSavMetadata } from './savIngestion';

describe('savIngestion loadSavMetadata', () => {
  it('returns variable inventory without requiring a DuckDB adapter', async () => {
    const sourceSavPath = path.resolve(process.cwd(), 'test_data/sleep.sav');
    const result = await loadSavMetadata(sourceSavPath);

    expect(result.rowCount).toBe(271);
    expect(result.variables.length).toBeGreaterThan(0);
    expect(result.variableSets.length).toBeGreaterThan(0);
  });
});

describe('savIngestion loadSav', () => {
  let tempDir = '';
  let tempSavPath = '';
  const sourceSavPath = path.resolve(process.cwd(), 'test_data/sleep.sav');

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'velocity-sav-'));
    tempSavPath = path.join(tempDir, "te'st.sav");
    await fs.copyFile(sourceSavPath, tempSavPath);
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('escapes single quotes in SAV file paths', async () => {
    const execute = vi.fn(async (_sql: string) => undefined);
    const adapter = { execute, query: vi.fn() } as any;

    const result = await loadSav(adapter, tempSavPath, 'main');

    const createSql = execute.mock.calls.find((call) => String(call[0]).includes('read_stat('))?.[0] as string;
    expect(createSql).toContain("read_stat('");
    expect(createSql).toContain("format='sav'");
    expect(createSql).toContain("te''st.sav");
    expect(result.rowCount).toBe(271);
  });

  it('installs read_stat from community when not already cached', async () => {
    let loadAttempts = 0;
    const execute = vi.fn(async (sql: string) => {
      if (sql === 'LOAD read_stat;' && loadAttempts++ === 0) {
        throw new Error('Extension not found');
      }
    });

    const adapter = { execute, query: vi.fn() } as any;

    const result = await loadSav(adapter, tempSavPath, 'main');

    expect(execute).toHaveBeenCalledWith('LOAD read_stat;');
    expect(execute).toHaveBeenCalledWith('INSTALL read_stat FROM community;');
    expect(
      execute.mock.calls.some((call) => String(call[0]).includes("SELECT * FROM read_stat('"))
    ).toBe(true);
    expect(result.rowCount).toBe(271);
  });

  it('falls back to ReadStat appender flow when community read_stat is unavailable', async () => {
    const execute = vi.fn(async (sql: string) => {
      if (sql === 'LOAD read_stat;') {
        throw new Error('Extension not found');
      }
      if (sql === 'INSTALL read_stat FROM community;') {
        throw new Error('community repository unavailable');
      }
    });

    const appender = {
      appendNull: vi.fn(),
      appendVarchar: vi.fn(),
      appendDouble: vi.fn(),
      endRow: vi.fn(),
      flushSync: vi.fn(),
      closeSync: vi.fn(),
    };

    const createAppender = vi.fn(async () => appender);

    const adapter = {
      execute,
      query: vi.fn(),
      connection: { createAppender },
    } as any;

    const result = await loadSav(adapter, tempSavPath, 'main');

    expect(createAppender).toHaveBeenCalledWith('main');
    expect(appender.endRow).toHaveBeenCalledTimes(271);
    expect(result.rowCount).toBe(271);
    expect(result.variables.length).toBeGreaterThan(0);
  });
});
