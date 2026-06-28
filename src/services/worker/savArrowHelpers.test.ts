import { describe, expect, it } from 'vitest';
import {
  buildEmptyVectorsFromMetadata,
  buildVectorsFromBatch,
  clampChunkSize,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  shouldUseStreamingIngestion,
  STREAMING_ROUTE_THRESHOLD_BYTES,
  type SavColumnMetadata,
} from './savArrowHelpers';

describe('shouldUseStreamingIngestion', () => {
  it('keeps files at or below the threshold on the in-memory path', () => {
    expect(shouldUseStreamingIngestion(0)).toBe(false);
    expect(shouldUseStreamingIngestion(STREAMING_ROUTE_THRESHOLD_BYTES)).toBe(false);
  });

  it('routes files above the threshold to the streaming path', () => {
    expect(shouldUseStreamingIngestion(STREAMING_ROUTE_THRESHOLD_BYTES + 1)).toBe(true);
  });

  it('honors forceChunked regardless of size', () => {
    expect(shouldUseStreamingIngestion(0, true)).toBe(true);
    expect(shouldUseStreamingIngestion(STREAMING_ROUTE_THRESHOLD_BYTES, true)).toBe(true);
  });

  it('uses a lower threshold than the legacy 50 MB full-materialization boundary', () => {
    // Phase 3: medium files (8–50 MB) must avoid full row-major materialization.
    const mediumFile = 20 * 1024 * 1024;
    expect(mediumFile).toBeGreaterThan(STREAMING_ROUTE_THRESHOLD_BYTES);
    expect(shouldUseStreamingIngestion(mediumFile)).toBe(true);
  });
});

describe('clampChunkSize', () => {
  it('clamps to the configured bounds and floors fractional sizes', () => {
    expect(clampChunkSize(0)).toBe(MIN_CHUNK_SIZE);
    expect(clampChunkSize(1_000_000)).toBe(MAX_CHUNK_SIZE);
    expect(clampChunkSize(4321.9)).toBe(4321);
  });
});

describe('buildVectorsFromBatch', () => {
  it('transposes row-major batch data into typed Arrow columns', () => {
    const variables: SavColumnMetadata[] = [
      { name: 'age', type: 'numeric' },
      { name: 'city', type: 'string' },
    ];
    const rows: (number | string | null)[][] = [
      [30, 'London'],
      [45, 'Paris'],
      [null, null],
    ];

    const vectors = buildVectorsFromBatch(rows, variables);

    expect(Object.keys(vectors)).toEqual(['age', 'city']);
    expect(vectors.age.length).toBe(3);
    expect(vectors.age.get(0)).toBe(30);
    expect(vectors.age.get(2)).toBeNull();
    expect(vectors.city.get(1)).toBe('Paris');
    expect(vectors.city.get(2)).toBeNull();
  });

  it('falls back to positional column names when metadata is missing', () => {
    const rows: (number | string | null)[][] = [[1, 'x']];
    const vectors = buildVectorsFromBatch(rows, []);
    expect(Object.keys(vectors)).toEqual(['col_0', 'col_1']);
  });
});

describe('buildEmptyVectorsFromMetadata', () => {
  it('produces zero-length typed columns for empty datasets', () => {
    const vectors = buildEmptyVectorsFromMetadata([
      { name: 'weight', type: 'numeric' },
      { name: 'label', type: 'string' },
    ]);
    expect(vectors.weight.length).toBe(0);
    expect(vectors.label.length).toBe(0);
  });
});
