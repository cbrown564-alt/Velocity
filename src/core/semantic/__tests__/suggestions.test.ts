import { describe, it, expect } from 'vitest';
import { suggestAnalyses, suggestHarmonizations } from '../suggestions';
import type { Variable } from '../../../types';
import type { Concept, SemanticAnnotation } from '../../../types/semantic';

// ============================================================================
// Fixtures
// ============================================================================

function makeVar(id: string, name: string): Variable {
  return {
    id,
    name,
    label: name,
    type: 'categorical',
    valueLabels: [],
    missingValues: {},
  };
}

function ann(intent: SemanticAnnotation['measurementIntent'], topic: string, extra: Partial<SemanticAnnotation> = {}): SemanticAnnotation {
  return { measurementIntent: intent, topic, source: 'auto', confidence: 0.85, ...extra };
}

const satVar = makeVar('q5_sat', 'Overall Satisfaction');
const satAnn = ann('attitude', 'satisfaction', { conceptFamily: 'satisfaction' });

const ageVar = makeVar('age', 'Age');
const ageAnn = ann('demographic', 'demographics');

const genderVar = makeVar('gender', 'Gender');
const genderAnn = ann('demographic', 'demographics');

const freqVar = makeVar('freq_purchase', 'Purchase Frequency');
const freqAnn = ann('behavior', 'behavior_frequency');

const waveVar = makeVar('wave', 'Wave Number');
const waveAnn = ann('identifier', 'temporal', { temporalRole: 'wave_id' });

const weightVar = makeVar('wt', 'Weight');
const weightAnn = ann('weight', 'sampling_weight');

const npsVar = makeVar('nps', 'NPS Score');
const npsAnn = ann('attitude', 'nps', { conceptFamily: 'nps' });

// ============================================================================
// Analysis Suggestions
// ============================================================================

describe('suggestAnalyses', () => {
  it('attitude × demographic → high-priority crosstab', () => {
    const suggestions = suggestAnalyses([
      { variable: satVar, annotation: satAnn },
      { variable: ageVar, annotation: ageAnn },
    ]);
    const crosstab = suggestions.find((s) => s.analysisType === 'crosstab' && s.priority === 'high');
    expect(crosstab).toBeDefined();
    expect(crosstab?.config).toMatchObject({ rowVars: ['q5_sat'], colVar: 'age' });
  });

  it('two attitude scales → suggest multi-row crosstab', () => {
    const satVar2 = makeVar('q6_sat', 'Product Satisfaction');
    const suggestions = suggestAnalyses([
      { variable: satVar, annotation: satAnn },
      { variable: satVar2, annotation: satAnn },
      { variable: ageVar, annotation: ageAnn },
    ]);
    const multiRow = suggestions.find(
      (s) => s.analysisType === 'crosstab' && Array.isArray(s.config.rowVars) && (s.config.rowVars as string[]).length >= 2
    );
    expect(multiRow).toBeDefined();
  });

  it('behavior × demographic → medium-priority crosstab', () => {
    const suggestions = suggestAnalyses([
      { variable: freqVar, annotation: freqAnn },
      { variable: genderVar, annotation: genderAnn },
    ]);
    const behaviorCross = suggestions.find(
      (s) => s.analysisType === 'crosstab' && (s.config.rowVars as string[])[0] === 'freq_purchase'
    );
    expect(behaviorCross?.priority).toBe('medium');
  });

  it('temporal × attitude → trend analysis suggestion', () => {
    const suggestions = suggestAnalyses([
      { variable: satVar, annotation: satAnn },
      { variable: waveVar, annotation: waveAnn },
    ]);
    const trend = suggestions.find(
      (s) => s.analysisType === 'crosstab' && s.config.colVar === 'wave'
    );
    expect(trend).toBeDefined();
    expect(trend?.rationale).toMatch(/trend|wave|time/i);
  });

  it('weight variable → suggests weighted analysis', () => {
    const suggestions = suggestAnalyses([
      { variable: satVar, annotation: satAnn },
      { variable: weightVar, annotation: weightAnn },
    ]);
    const weighted = suggestions.find((s) => s.config.weightVar === 'wt');
    expect(weighted).toBeDefined();
  });

  it('NPS × demographic → high-priority suggestion', () => {
    const suggestions = suggestAnalyses([
      { variable: npsVar, annotation: npsAnn },
      { variable: ageVar, annotation: ageAnn },
    ]);
    const npsCross = suggestions.find(
      (s) => s.analysisType === 'crosstab' && (s.config.rowVars as string[])[0] === 'nps' && s.priority === 'high'
    );
    expect(npsCross).toBeDefined();
  });

  it('results are sorted high → medium → low priority', () => {
    const suggestions = suggestAnalyses([
      { variable: satVar, annotation: satAnn },
      { variable: ageVar, annotation: ageAnn },
      { variable: weightVar, annotation: weightAnn },
    ]);
    const order = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < suggestions.length; i++) {
      expect(order[suggestions[i - 1].priority]).toBeLessThanOrEqual(order[suggestions[i].priority]);
    }
  });

  it('returns empty array for empty variable list', () => {
    expect(suggestAnalyses([])).toHaveLength(0);
  });

  it('no duplicate suggestions', () => {
    const suggestions = suggestAnalyses([
      { variable: satVar, annotation: satAnn },
      { variable: ageVar, annotation: ageAnn },
    ]);
    const seen = new Set<string>();
    for (const s of suggestions) {
      const key = JSON.stringify({ type: s.analysisType, config: s.config });
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

// ============================================================================
// Harmonization Suggestions
// ============================================================================

describe('suggestHarmonizations', () => {
  it('suggests harmonization when concept spans two datasets', () => {
    const concept: Concept = {
      id: 'c1',
      name: 'Overall Satisfaction',
      aliases: [],
      canonicalScale: { points: 5, direction: 'ascending' },
      variableRefs: [
        { datasetId: 'wave1', variableId: 'q5_satisfaction', matchConfidence: 0.9 },
        { datasetId: 'wave2', variableId: 'sat_overall', matchConfidence: 0.85 },
      ],
    };

    const suggestions = suggestHarmonizations([concept]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].concept.name).toBe('Overall Satisfaction');
    expect(suggestions[0].confidence).toBeGreaterThan(0);
    expect(suggestions[0].rationale).toBeTruthy();
  });

  it('does not suggest harmonization for single-dataset concept', () => {
    const concept: Concept = {
      id: 'c2',
      name: 'Local Concept',
      aliases: [],
      variableRefs: [
        { datasetId: 'wave1', variableId: 'q1', matchConfidence: 0.9 },
        { datasetId: 'wave1', variableId: 'q2', matchConfidence: 0.85 },
      ],
    };

    expect(suggestHarmonizations([concept])).toHaveLength(0);
  });

  it('returns empty for no concepts', () => {
    expect(suggestHarmonizations([])).toHaveLength(0);
  });

  it('sorts by confidence descending', () => {
    const c1: Concept = {
      id: 'c1',
      name: 'High Confidence',
      aliases: [],
      variableRefs: [
        { datasetId: 'ds1', variableId: 'v1', matchConfidence: 0.95 },
        { datasetId: 'ds2', variableId: 'v2', matchConfidence: 0.93 },
      ],
    };
    const c2: Concept = {
      id: 'c2',
      name: 'Low Confidence',
      aliases: [],
      variableRefs: [
        { datasetId: 'ds1', variableId: 'v3', matchConfidence: 0.6 },
        { datasetId: 'ds2', variableId: 'v4', matchConfidence: 0.5 },
      ],
    };
    const suggestions = suggestHarmonizations([c2, c1]);
    expect(suggestions[0].confidence).toBeGreaterThanOrEqual(suggestions[1].confidence);
  });

  it('includes scale info in rationale when canonicalScale is set', () => {
    const concept: Concept = {
      id: 'c3',
      name: 'NPS',
      aliases: [],
      canonicalScale: { points: 10, direction: 'ascending' },
      variableRefs: [
        { datasetId: 'ds1', variableId: 'nps_q', matchConfidence: 0.9 },
        { datasetId: 'ds2', variableId: 'recommend', matchConfidence: 0.85 },
      ],
    };
    const suggestions = suggestHarmonizations([concept]);
    expect(suggestions[0].rationale).toContain('10');
  });
});
