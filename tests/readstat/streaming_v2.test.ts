import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseSavMetadata, parseSavWindow, parseSavStreamingV2 } from '../../packages/readstat-wasm/ts/index';

const sleepSavPath = path.resolve(process.cwd(), 'test_data/sleep.sav');

function asArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

describe('readstat streaming v2 window APIs', () => {
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    const wasmPath = path.resolve(process.cwd(), 'packages/readstat-wasm/dist/readstat.wasm');
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const href = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

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

  it('parses bounded windows with stable row counts', async () => {
    const buffer = asArrayBuffer(await fs.readFile(sleepSavPath));
    const metadata = await parseSavMetadata(buffer);

    const firstWindow = await parseSavWindow(buffer, 0, 10);
    const secondWindow = await parseSavWindow(buffer, 10, 10);

    expect(firstWindow.rows.length).toBe(10);
    expect(secondWindow.rows.length).toBe(10);
    expect(firstWindow.metadata.variables.length).toBe(metadata.metadata.variables.length);

    const sampled = firstWindow.rows.length + secondWindow.rows.length;
    expect(sampled).toBe(20);
  });

  it('streams all rows in-order via parseSavStreamingV2', async () => {
    const buffer = asArrayBuffer(await fs.readFile(sleepSavPath));
    const metadata = await parseSavMetadata(buffer);

    const seenRanges: Array<[number, number]> = [];
    let totalRows = 0;
    let firstBatchVariableCount = 0;

    const result = await parseSavStreamingV2(buffer, 64, async (batch) => {
      seenRanges.push([batch.startRow, batch.endRow]);
      totalRows += batch.rows.length;

      if (seenRanges.length === 1) {
        firstBatchVariableCount = batch.variables?.length || 0;
      }
    });

    expect(totalRows).toBe(metadata.metadata.rowCount);
    expect(result.metadata.rowCount).toBe(metadata.metadata.rowCount);
    expect(firstBatchVariableCount).toBe(metadata.metadata.variables.length);

    for (let i = 1; i < seenRanges.length; i++) {
      expect(seenRanges[i][0]).toBe(seenRanges[i - 1][1]);
    }

    const lastRange = seenRanges[seenRanges.length - 1];
    expect(lastRange[1]).toBe(metadata.metadata.rowCount);
  });
});
