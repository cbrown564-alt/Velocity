/**
 * Wave Detector Tests
 */

import { describe, it, expect } from 'vitest';
import { detectWave } from './waveDetector';
import { wave1Variables, wave2Variables } from '../../test/fixtures/harmonization';

const existingDataset = {
  id: 'dataset-wave1',
  name: 'CustomerSatisfaction_Wave1.sav',
  variables: wave1Variables,
};

describe('detectWave', () => {
  it('returns isLikelyWave=false with no existing datasets', () => {
    const result = detectWave({ name: 'any.sav', variables: [] }, []);
    expect(result.isLikelyWave).toBe(false);
  });

  it('detects a likely wave by filename and variable similarity', () => {
    const result = detectWave({ name: 'CustomerSatisfaction_Wave2.sav', variables: wave2Variables }, [existingDataset]);
    expect(result.isLikelyWave).toBe(true);
    expect(result.matchedDatasetId).toBe('dataset-wave1');
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it('returns low confidence for completely unrelated datasets', () => {
    const unrelated = {
      name: 'EmployeeEngagement_Q3.sav',
      variables: [
        {
          id: 'xyz',
          name: 'DEPT',
          label: 'Department',
          type: 'nominal' as const,
          valueLabels: [],
          missingValues: {},
        },
      ],
    };
    const result = detectWave(unrelated, [existingDataset]);
    expect(result.isLikelyWave).toBe(false);
    expect(result.confidence).toBeLessThan(0.45);
  });

  it('strips wave suffixes before comparing names', () => {
    const result = detectWave({ name: 'BrandTracking_w1.sav', variables: wave1Variables }, [
      { id: 'bt-w2', name: 'BrandTracking_w2.sav', variables: wave2Variables },
    ]);
    expect(result.isLikelyWave).toBe(true);
  });

  it('returns a result object with all required fields', () => {
    const result = detectWave({ name: 'test.sav', variables: wave2Variables }, [existingDataset]);
    expect(typeof result.isLikelyWave).toBe('boolean');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(typeof result.reason).toBe('string');
  });
});
