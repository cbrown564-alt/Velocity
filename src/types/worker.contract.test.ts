import { describe, expect, it } from 'vitest';
import type { WorkerRequest, WorkerResponse } from './worker';

describe('worker protocol contracts', () => {
  it('accepts typed runAnalysis requests for known analysis ids', () => {
    const request = {
      type: 'runAnalysis',
      id: 'crosstab',
      config: {
        options: {
          rowVars: ['gender'],
          colVar: 'region',
          filters: [],
          weightVar: 'weight',
        },
        context: {
          variables: {},
          variableSets: {},
        },
      },
    } satisfies WorkerRequest;

    expect(request.id).toBe('crosstab');
  });

  it('supports queryResult rows carrying both unweighted and weighted bases', () => {
    const response = {
      type: 'queryResult',
      durationMs: 12,
      data: [
        {
          rowKey_0: 'A',
          colKey: 'Total',
          count: 10,
          weightedCount: 12.5,
          sumSqWeights: 16.25,
        },
      ],
    } satisfies WorkerResponse;

    expect(response.type).toBe('queryResult');
    expect(response.data[0].count).toBe(10);
  });
});
