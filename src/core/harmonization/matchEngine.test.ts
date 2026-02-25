/**
 * Match Engine Tests
 */

import { describe, it, expect } from 'vitest';
import {
  jaroWinklerSimilarity,
  valueLabelOverlap,
  typeCompatibility,
  detectScaleInversion,
  detectDataLoss,
  scoreVariablePair,
  autoMatchVariables,
  generateValueMappings,
} from './matchEngine';
import {
  wave1Variables,
  wave2Variables,
  invertedScaleSource,
  invertedScaleTarget,
} from '../../test/fixtures/harmonization';

describe('jaroWinklerSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(jaroWinklerSimilarity('Q1', 'Q1')).toBe(1);
    expect(jaroWinklerSimilarity('satisfaction', 'satisfaction')).toBe(1);
  });

  it('returns 0 for empty vs non-empty strings', () => {
    expect(jaroWinklerSimilarity('', 'hello')).toBe(0);
    expect(jaroWinklerSimilarity('hello', '')).toBe(0);
  });

  it('returns high similarity for close matches', () => {
    expect(jaroWinklerSimilarity('Q2', 'Q2A')).toBeGreaterThan(0.8);
    expect(jaroWinklerSimilarity('satisfaction', 'satifaction')).toBeGreaterThan(0.9);
  });

  it('is case-insensitive', () => {
    expect(jaroWinklerSimilarity('GENDER', 'gender')).toBe(1);
    expect(jaroWinklerSimilarity('AGE', 'age')).toBe(1);
  });

  it('gives prefix bonus for common prefixes', () => {
    const withPrefix = jaroWinklerSimilarity('ABCDEF', 'ABCXYZ');
    const withoutPrefix = jaroWinklerSimilarity('ABCDEF', 'XYZDEF');
    expect(withPrefix).toBeGreaterThan(withoutPrefix);
  });
});

describe('valueLabelOverlap', () => {
  it('returns 1 for identical value label sets', () => {
    const labels = wave1Variables[0].valueLabels;
    expect(valueLabelOverlap(labels, labels)).toBe(1);
  });

  it('returns 1 for two empty sets', () => {
    expect(valueLabelOverlap([], [])).toBe(1);
  });

  it('returns 0 for one empty set', () => {
    expect(valueLabelOverlap([], wave1Variables[0].valueLabels)).toBe(0);
  });

  it('computes partial overlap correctly', () => {
    const a = [
      { value: 1, label: 'Never' },
      { value: 2, label: 'Rarely' },
      { value: 3, label: 'Sometimes' },
    ];
    const b = [
      { value: 1, label: 'Never' },
      { value: 2, label: 'Rarely' },
      { value: 3, label: 'Often' },
      { value: 4, label: 'Always' },
    ];
    // Intersection: Never, Rarely (2); Union: 5
    expect(valueLabelOverlap(a, b)).toBeCloseTo(2 / 5);
  });

  it('is case-insensitive', () => {
    const a = [{ value: 1, label: 'Never' }];
    const b = [{ value: 1, label: 'never' }];
    expect(valueLabelOverlap(a, b)).toBe(1);
  });
});

describe('typeCompatibility', () => {
  it('returns 1.0 for same types', () => {
    expect(typeCompatibility('nominal', 'nominal')).toBe(1.0);
    expect(typeCompatibility('scale', 'scale')).toBe(1.0);
  });

  it('returns 0.5 for compatible types', () => {
    expect(typeCompatibility('ordinal', 'scale')).toBe(0.5);
    expect(typeCompatibility('scale', 'numeric')).toBe(0.5);
    expect(typeCompatibility('nominal', 'ordinal')).toBe(0.5);
  });

  it('returns 0.0 for incompatible types', () => {
    expect(typeCompatibility('nominal', 'numeric')).toBe(0.0);
    expect(typeCompatibility('text', 'scale')).toBe(0.0);
  });
});

describe('detectScaleInversion', () => {
  it('detects inverted Likert scales', () => {
    expect(detectScaleInversion(invertedScaleSource, invertedScaleTarget)).toBe(true);
  });

  it('returns false for non-inverted scales', () => {
    const source = wave1Variables[0];
    const target = wave2Variables[0];
    expect(detectScaleInversion(source, target)).toBe(false);
  });

  it('returns false when value labels are empty', () => {
    const source = wave1Variables[3]; // AGE — no value labels
    const target = wave2Variables[3]; // AGE — no value labels
    expect(detectScaleInversion(source, target)).toBe(false);
  });
});

describe('detectDataLoss', () => {
  it('returns orphan source values not in target', () => {
    // w1_q3 has values 1,2,3; w2_gender has values 1,2,3,4
    // Source values 1,2,3 are all present in target — no data loss from source
    const losses = detectDataLoss(wave1Variables[2], wave2Variables[2]);
    expect(losses).toHaveLength(0);
  });

  it('returns empty array for variables with no value labels', () => {
    expect(detectDataLoss(wave1Variables[3], wave2Variables[3])).toHaveLength(0);
  });
});

describe('scoreVariablePair', () => {
  it('returns high score for identical variables', () => {
    const score = scoreVariablePair(wave1Variables[0], wave2Variables[0]);
    expect(score.total).toBeGreaterThan(0.9);
    expect(score.nameSimilarity).toBe(1);
    expect(score.typeMatch).toBe(1);
  });

  it('returns moderate score for similar variables', () => {
    const score = scoreVariablePair(wave1Variables[1], wave2Variables[1]);
    expect(score.total).toBeGreaterThan(0.5);
    expect(score.total).toBeLessThan(1.0);
  });

  it('returns low score for unrelated variables', () => {
    // NPS (numeric, no labels) vs Gender (nominal, labels)
    const score = scoreVariablePair(wave1Variables[4], wave2Variables[2]);
    expect(score.total).toBeLessThan(0.5);
  });

  it('respects custom weights', () => {
    const nameHeavyWeights = { name: 0.9, label: 0.05, type: 0.025, valueLabels: 0.025 };
    const score = scoreVariablePair(wave1Variables[0], wave2Variables[0], nameHeavyWeights);
    expect(score.total).toBeGreaterThan(0.9);
  });
});

describe('autoMatchVariables', () => {
  it('matches identical variables correctly', () => {
    const mappings = autoMatchVariables(wave1Variables, wave2Variables);

    const q1Match = mappings.find(m => m.sourceVariableId === 'w1_q1');
    expect(q1Match?.targetVariableId).toBe('w2_q1');
    expect(q1Match?.status).toBe('auto_matched');

    const ageMatch = mappings.find(m => m.sourceVariableId === 'w1_age');
    expect(ageMatch?.targetVariableId).toBe('w2_age');
  });

  it('produces an unmapped entry when threshold is raised above all scores', () => {
    // At high threshold (0.9), Q4 (NPS) has no target scoring that high
    const mappings = autoMatchVariables(wave1Variables, wave2Variables, undefined, 0.9);

    const q4Match = mappings.find(m => m.sourceVariableId === 'w1_q4');
    expect(q4Match?.status).toBe('unmapped');
    expect(q4Match?.targetVariableId).toBeNull();
  });

  it('does not double-assign the same target variable', () => {
    const mappings = autoMatchVariables(wave1Variables, wave2Variables);
    const assignedTargets = mappings
      .filter(m => m.targetVariableId !== null)
      .map(m => m.targetVariableId);
    const uniqueTargets = new Set(assignedTargets);
    expect(assignedTargets.length).toBe(uniqueTargets.size);
  });

  it('respects threshold and leaves low-score pairs unmapped', () => {
    const mappings = autoMatchVariables(wave1Variables, wave2Variables, undefined, 0.99);
    const matched = mappings.filter(m => m.status === 'auto_matched');
    for (const m of matched) {
      expect(m.score!.total).toBeGreaterThanOrEqual(0.99);
    }
  });

  it('generates warnings for inverted scales', () => {
    const mappings = autoMatchVariables([invertedScaleSource], [invertedScaleTarget]);
    const mapping = mappings[0];
    const inversionWarning = mapping.warnings.find(w => w.kind === 'scale_inversion');
    expect(inversionWarning).toBeDefined();
  });
});

describe('generateValueMappings', () => {
  it('generates identity mappings for matching value labels', () => {
    const mappings = generateValueMappings(wave1Variables[0], wave2Variables[0]);
    for (const m of mappings) {
      expect(m.sourceValue).toBe(m.targetValue);
    }
  });

  it('handles variables with no value labels', () => {
    const mappings = generateValueMappings(wave1Variables[3], wave2Variables[3]);
    expect(Array.isArray(mappings)).toBe(true);
  });
});
