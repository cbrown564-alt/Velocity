import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadSav } from './savIngestion';

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

    const createSql = execute.mock.calls.find((call) => String(call[0]).includes('read_sav'))?.[0] as string;
    expect(createSql).toContain("read_sav('");
    expect(createSql).toContain("te''st.sav");
    expect(result.rowCount).toBe(271);
  });

  it('falls back to ReadStat appender flow when read_stat is unavailable', async () => {
    const execute = vi.fn(async (sql: string) => {
      if (sql.includes('INSTALL read_stat; LOAD read_stat;')) {
        throw new Error('read_stat extension unavailable');
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
