import { describe, it, expect, vi } from 'vitest';
import { DuckDBNodeAdapter } from './DuckDBNodeAdapter';

describe('DuckDBNodeAdapter.loadCSV', () => {
  it('escapes single quotes in file paths', async () => {
    const run = vi.fn(async (_sql: string) => undefined);
    const runAndReadAll = vi.fn(async (_sql: string) => ({
      columnNames: () => ['cnt'],
      currentRowCount: 1,
      value: (_c: number, _r: number) => 1,
    }));

    const connection = { run, runAndReadAll, closeSync: vi.fn() };
    const instance = { closeSync: vi.fn() };

    const adapter = new (DuckDBNodeAdapter as any)(instance, connection);

    const filePath = "/tmp/te'st.csv";
    await adapter.loadCSV(filePath, 'main');

    const createSql = run.mock.calls[0]?.[0] as string;
    expect(createSql).toContain("read_csv_auto('/tmp/te''st.csv')");
  });
});
