import { describe, it, expect, vi } from 'vitest';
import { DuckDBNodeAdapter } from './DuckDBNodeAdapter';

describe('DuckDBNodeAdapter.queryStream', () => {
  it('yields chunks with correct columns and rows', async () => {
    const mockChunks = [
      {
        rowCount: 2,
        value: (c: number, r: number) => {
          const data = [
            [1, 'a'],
            [2, 'b'],
          ];
          return data[r][c];
        },
      },
      {
        rowCount: 1,
        value: (c: number, r: number) => {
          const data = [[3, 'c']];
          return data[r][c];
        },
      },
    ];

    const streamResult = {
      columnNames: () => ['id', 'name'],
      [Symbol.asyncIterator]: async function* () {
        for (const chunk of mockChunks) yield chunk;
      },
    };

    const connection = {
      stream: vi.fn(async () => streamResult),
      run: vi.fn(),
      runAndReadAll: vi.fn(),
      closeSync: vi.fn(),
    };
    const instance = { closeSync: vi.fn() };
    const adapter = new (DuckDBNodeAdapter as any)(instance, connection);

    const chunks: any[] = [];
    for await (const chunk of adapter.queryStream('SELECT * FROM main')) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(2);
    expect(chunks[0].columns).toEqual(['id', 'name']);
    expect(chunks[0].rows).toEqual([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);
    expect(chunks[0].rowCount).toBe(2);
    expect(chunks[1].rows).toEqual([{ id: 3, name: 'c' }]);
    expect(chunks[1].rowCount).toBe(1);
  });

  it('converts bigint values to numbers', async () => {
    const streamResult = {
      columnNames: () => ['count'],
      [Symbol.asyncIterator]: async function* () {
        yield { rowCount: 1, value: () => BigInt(42) };
      },
    };

    const connection = {
      stream: vi.fn(async () => streamResult),
      closeSync: vi.fn(),
    };
    const adapter = new (DuckDBNodeAdapter as any)({ closeSync: vi.fn() }, connection);

    const chunks: any[] = [];
    for await (const chunk of adapter.queryStream('SELECT COUNT(*)')) {
      chunks.push(chunk);
    }

    expect(chunks[0].rows[0].count).toBe(42);
    expect(typeof chunks[0].rows[0].count).toBe('number');
  });
});

describe('DuckDBNodeAdapter.loadCSV', () => {
  it('escapes single quotes in file paths', async () => {
    const run = vi.fn(async (sql: string) => {
      void sql;
    });
    const runAndReadAll = vi.fn(async (sql: string) => {
      void sql;
      return {
        columnNames: () => ['cnt'],
        currentRowCount: 1,
        value: () => 1,
      };
    });

    const connection = { run, runAndReadAll, closeSync: vi.fn() };
    const instance = { closeSync: vi.fn() };

    const adapter = new (DuckDBNodeAdapter as any)(instance, connection);

    const filePath = "/tmp/te'st.csv";
    await adapter.loadCSV(filePath, 'main');

    const createSql = run.mock.calls[0]?.[0] as string;
    expect(createSql).toContain("read_csv_auto('/tmp/te''st.csv')");
  });
});
