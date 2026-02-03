import { describe, it, expect, vi } from 'vitest';
import { loadSav } from './savIngestion';

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(async () => Buffer.from([0x00, 0x01, 0x02])),
  },
}));

vi.mock('jsavvy', () => {
  class Feeder {
    constructor(_buffer: ArrayBuffer) {}
  }

  class SavParser {
    async schema(_feeder: any) {
      return {
        headers: [{ name: 'Q1', label: 'Q1', code: 0 }],
        internal: { levels: [] },
        meta: { cases: 1 },
      };
    }
  }

  return {
    default: { SavParser, Feeder },
  };
});

describe('savIngestion loadSav', () => {
  it('escapes single quotes in SAV file paths', async () => {
    const execute = vi.fn(async (_sql: string) => undefined);
    const adapter = { execute } as any;

    const filePath = "/tmp/te'st.sav";
    await loadSav(adapter, filePath, 'main');

    const createSql = execute.mock.calls.find((call) => String(call[0]).includes('read_sav'))?.[0] as string;
    expect(createSql).toContain("read_sav('/tmp/te''st.sav')");
  });
});
