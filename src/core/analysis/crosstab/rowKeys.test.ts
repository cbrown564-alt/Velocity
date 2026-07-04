import { describe, expect, it } from 'vitest';
import { prefixNestedCrosstabRows } from './rowKeys';

describe('prefixNestedCrosstabRows', () => {
  it('inserts the measure label as rowKey_0 and shifts nested keys', () => {
    const [prefixed] = prefixNestedCrosstabRows(
      [{ rowKey_0: 'East', colKey: 'Male', count: 10 }],
      'Age (years)',
    );

    expect(prefixed.rowKey_0).toBe('Age (years)');
    expect(prefixed.rowKey_1).toBe('East');
    expect(prefixed.colKey).toBe('Male');
    expect(prefixed.count).toBe(10);
  });
});
