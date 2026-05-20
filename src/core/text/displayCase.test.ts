import { describe, expect, it } from 'vitest';
import { toTitleCase, toUiCaps } from './displayCase';

describe('toTitleCase', () => {
  it('preserves New Slide placeholder', () => {
    expect(toTitleCase('New Slide')).toBe('New Slide');
  });

  it('title-cases row by column titles', () => {
    expect(toTitleCase('gender by region')).toBe('Gender by Region');
  });

  it('title-cases multi-row hierarchies', () => {
    expect(toTitleCase('age > brand by region')).toBe('Age > Brand by Region');
  });

  it('leaves already-cased labels stable', () => {
    expect(toTitleCase('Age > Brand by Region')).toBe('Age > Brand by Region');
  });
});

describe('toUiCaps', () => {
  it('uppercases axis header labels', () => {
    expect(toUiCaps('East')).toBe('EAST');
  });
});
