import { describe, it, expect } from 'vitest';
import { pluralize } from './pluralize';

describe('pluralize', () => {
  it('uses singular for count of 1', () => {
    expect(pluralize(1, 'dataset')).toBe('1 dataset');
  });

  it('uses plural for count other than 1', () => {
    expect(pluralize(0, 'dataset')).toBe('0 datasets');
    expect(pluralize(2, 'dataset')).toBe('2 datasets');
  });

  it('supports custom plural forms', () => {
    expect(pluralize(1, 'analysis', 'analyses')).toBe('1 analysis');
    expect(pluralize(3, 'analysis', 'analyses')).toBe('3 analyses');
  });
});
