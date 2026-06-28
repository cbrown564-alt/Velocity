import { describe, it, expect } from 'vitest';
import { suggestAnalyses, suggestBreaks, suggestHarmonizations } from '../suggestions';
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

function ann(
  intent: SemanticAnnotation['measurementIntent'],
  topic: string,
  extra: Partial<SemanticAnnotation> = {},
): SemanticAnnotation {
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
      (s) =>
        s.analysisType === 'crosstab' && Array.isArray(s.config.rowVars) && (s.config.rowVars as string[]).length >= 2,
    );
    expect(multiRow).toBeDefined();
  });

  it('behavior × demographic → medium-priority crosstab', () => {
    const suggestions = suggestAnalyses([
      { variable: freqVar, annotation: freqAnn },
      { variable: genderVar, annotation: genderAnn },
    ]);
    const behaviorCross = suggestions.find(
      (s) => s.analysisType === 'crosstab' && (s.config.rowVars as string[])[0] === 'freq_purchase',
    );
    expect(behaviorCross?.priority).toBe('medium');
  });

  it('temporal × attitude → trend analysis suggestion', () => {
    const suggestions = suggestAnalyses([
      { variable: satVar, annotation: satAnn },
      { variable: waveVar, annotation: waveAnn },
    ]);
    const trend = suggestions.find((s) => s.analysisType === 'crosstab' && s.config.colVar === 'wave');
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
      (s) => s.analysisType === 'crosstab' && (s.config.rowVars as string[])[0] === 'nps' && s.priority === 'high',
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

// ============================================================================
// Break Variable Suggestions
// ============================================================================

function makeVarWithLabels(id: string, name: string, labels: { value: number; label: string }[]): Variable {
  return { id, name, label: name, type: 'nominal', valueLabels: labels, missingValues: {} };
}

describe('suggestBreaks', () => {
  const genderVarWithLabels = makeVarWithLabels('gender', 'Gender', [
    { value: 1, label: 'Male' },
    { value: 2, label: 'Female' },
  ]);
  const ageVarWithLabels = makeVarWithLabels('age_group', 'Age Group', [
    { value: 1, label: '18-24' },
    { value: 2, label: '25-34' },
    { value: 3, label: '35-44' },
    { value: 4, label: '45-54' },
    { value: 5, label: '55+' },
  ]);
  const regionVar = makeVarWithLabels('region', 'Region', [
    { value: 1, label: 'North' },
    { value: 2, label: 'South' },
    { value: 3, label: 'East' },
    { value: 4, label: 'West' },
  ]);

  it('ranks demographic variables highest', () => {
    const topic = { variable: satVar, annotation: satAnn };
    const allVars = [
      topic,
      { variable: genderVarWithLabels, annotation: ann('demographic', 'demographics') },
      { variable: freqVar, annotation: freqAnn },
    ];
    const suggestions = suggestBreaks(topic, allVars);
    expect(suggestions[0].variable.id).toBe('gender');
    expect(suggestions[0].score).toBeGreaterThan(0.5);
  });

  it('excludes the topic variable itself', () => {
    const topic = { variable: satVar, annotation: satAnn };
    const allVars = [topic, { variable: genderVarWithLabels, annotation: ann('demographic', 'demographics') }];
    const suggestions = suggestBreaks(topic, allVars);
    const ids = suggestions.map((s) => s.variable.id);
    expect(ids).not.toContain('q5_sat');
  });

  it('excludes weight, identifier, and open_end variables', () => {
    const topic = { variable: satVar, annotation: satAnn };
    const allVars = [
      topic,
      { variable: weightVar, annotation: weightAnn },
      { variable: makeVar('rid', 'RespondentID'), annotation: ann('identifier', 'id') },
      { variable: makeVar('oe', 'Comments'), annotation: ann('open_end', 'comments') },
      { variable: genderVarWithLabels, annotation: ann('demographic', 'demographics') },
    ];
    const suggestions = suggestBreaks(topic, allVars);
    const ids = suggestions.map((s) => s.variable.id);
    expect(ids).not.toContain('wt');
    expect(ids).not.toContain('rid');
    expect(ids).not.toContain('oe');
    expect(ids).toContain('gender');
  });

  it('gives cardinality bonus for 2-8 value labels', () => {
    const topic = { variable: satVar, annotation: satAnn };
    const allVars = [
      topic,
      { variable: genderVarWithLabels, annotation: ann('demographic', 'demographics') },
      { variable: ageVarWithLabels, annotation: ann('demographic', 'demographics') },
    ];
    const suggestions = suggestBreaks(topic, allVars);
    // Both are demographic with good cardinality, both should have high scores
    expect(suggestions.length).toBe(2);
    expect(suggestions[0].score).toBeGreaterThan(0.6);
  });

  it('gives name pattern bonus', () => {
    const topic = { variable: satVar, annotation: satAnn };
    // regionVar has no annotation but matches name pattern and has value labels
    const allVars = [topic, { variable: regionVar, annotation: undefined }];
    const suggestions = suggestBreaks(topic, allVars);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].rationale).toContain('name matches');
  });

  it('respects limit option', () => {
    const topic = { variable: satVar, annotation: satAnn };
    const allVars = [
      topic,
      { variable: genderVarWithLabels, annotation: ann('demographic', 'demographics') },
      { variable: ageVarWithLabels, annotation: ann('demographic', 'demographics') },
      { variable: regionVar, annotation: ann('demographic', 'demographics') },
    ];
    const suggestions = suggestBreaks(topic, allVars, { limit: 2 });
    expect(suggestions.length).toBe(2);
  });

  it('sorts by score descending', () => {
    const topic = { variable: satVar, annotation: satAnn };
    const allVars = [
      topic,
      { variable: genderVarWithLabels, annotation: ann('demographic', 'demographics') },
      { variable: freqVar, annotation: freqAnn },
      { variable: regionVar, annotation: ann('classification', 'region') },
    ];
    const suggestions = suggestBreaks(topic, allVars);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].score).toBeGreaterThanOrEqual(suggestions[i].score);
    }
  });

  it('returns empty for variables with no scoring signals', () => {
    const topic = { variable: satVar, annotation: satAnn };
    const noSignalVar = makeVar('q99', 'q99_internal');
    const allVars = [topic, { variable: noSignalVar, annotation: ann('attitude', 'satisfaction') }];
    // attitude intent gives no score, no value labels, no name pattern
    const suggestions = suggestBreaks(topic, allVars);
    expect(suggestions).toHaveLength(0);
  });
});
