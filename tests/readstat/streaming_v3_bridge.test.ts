import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSavMetadata, parseSavStreamingSinglePassBridge } from '../../packages/readstat-wasm/ts/index';

const sleepSavPath = path.resolve(process.cwd(), 'test_data/sleep.sav');

function asArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

describe('readstat single-pass streaming bridge', () => {
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    const wasmPath = path.resolve(process.cwd(), 'packages/readstat-wasm/dist/readstat.wasm');
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (href.endsWith('/readstat.wasm') || href.endsWith('readstat.wasm')) {
        const wasm = await fs.readFile(wasmPath);
        return new Response(wasm, {
          status: 200,
          headers: { 'Content-Type': 'application/wasm' },
        });
      }

      if (!originalFetch) {
        throw new Error(`Unhandled fetch URL in test: ${href}`);
      }

      return originalFetch(input as any, init);
    };
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('streams rows with bounded queue depth and parity', async () => {
    const buffer = asArrayBuffer(await fs.readFile(sleepSavPath));
    const metadata = await parseSavMetadata(buffer);

    let totalRows = 0;
    let firstBatchVariableCount = 0;

    const result = await parseSavStreamingSinglePassBridge(
      buffer,
      {
        batchSize: 64,
        initialCredits: 2,
        maxCredits: 2,
      },
      async (batch) => {
        totalRows += batch.rows.length;
        if (firstBatchVariableCount === 0) {
          firstBatchVariableCount = batch.variables?.length || 0;
        }

        return 48;
      },
    );

    expect(totalRows).toBe(metadata.metadata.rowCount);
    expect(result.metadata.rowCount).toBe(metadata.metadata.rowCount);
    expect(firstBatchVariableCount).toBe(metadata.metadata.variables.length);
    expect(result.bridge.maxQueueDepth).toBeLessThanOrEqual(2);
    expect(result.bridge.producedBatches).toBe(result.bridge.consumedBatches);
  });
});
