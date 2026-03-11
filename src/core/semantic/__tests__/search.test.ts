import { describe, it, expect } from 'vitest';
import { buildSearchIndex, searchVariables, searchVariablesAcrossDatasets } from '../search';
import type { Variable } from '../../../types';
import type { Concept, SemanticAnnotation } from '../../../types/semantic';

// ============================================================================
// Fixtures
// ============================================================================

function makeVar(id: string, name: string, label: string, valueLabels: { value: number; label: string }[] = []): Variable {
  return {
    id,
    name,
    label,
    type: 'categorical',
    valueLabels,
    missingValues: {},
  };
}

const satVar = makeVar('q5_sat', 'Q5_satisfaction', 'Overall Satisfaction', [
  { value: 1, label: 'Very Dissatisfied' },
  { value: 5, label: 'Very Satisfied' },
]);

const ageVar = makeVar('age', 'age', 'Age of respondent');
const genderVar = makeVar('gender', 'gender', 'Gender', [
  { value: 1, label: 'Male' },
  { value: 2, label: 'Female' },
]);
const brandVar = makeVar('brand_aware', 'brand_aware', 'Brand Awareness', [
  { value: 1, label: 'Aware' },
  { value: 2, label: 'Not Aware' },
]);
const npsVar = makeVar('nps', 'nps', 'Net Promoter Score - How likely to recommend?');
const openEndVar = makeVar('q99_oe', 'q99_oe', 'Any other comments (open end)');

const annotations = new Map<string, SemanticAnnotation>([
  ['q5_sat', { topic: 'satisfaction', measurementIntent: 'attitude', conceptFamily: 'satisfaction', source: 'auto', confidence: 0.9 }],
  ['age', { topic: 'demographics', measurementIntent: 'demographic', source: 'auto', confidence: 0.7 }],
  ['gender', { topic: 'demographics', measurementIntent: 'demographic', conceptFamily: 'gender', source: 'auto', confidence: 0.9 }],
  ['brand_aware', { topic: 'brand_awareness', measurementIntent: 'awareness', source: 'auto', confidence: 0.8 }],
  ['nps', { topic: 'nps', measurementIntent: 'attitude', conceptFamily: 'nps', source: 'auto', confidence: 0.85 }],
  ['q99_oe', { topic: 'open_ended', measurementIntent: 'open_end', source: 'auto', confidence: 0.8 }],
]);

const satisfactionConcept: Concept = {
  id: 'c1',
  name: 'satisfaction',
  aliases: ['sat', 'overall satisfaction'],
  variableRefs: [{ datasetId: 'ds1', variableId: 'q5_sat', matchConfidence: 0.9 }],
};

const allVars = [satVar, ageVar, genderVar, brandVar, npsVar, openEndVar];

function buildIndex(concepts: Concept[] = [satisfactionConcept]) {
  return buildSearchIndex(allVars, 'ds1', annotations, concepts);
}

// ============================================================================
// Tests
// ============================================================================

describe('searchVariables', () => {
  it('finds satisfaction variable by label keyword', () => {
    const index = buildIndex();
    const results = searchVariables('satisfaction', index);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].variable.id).toBe('q5_sat');
  });

  it('finds gender variable by topic "demographics"', () => {
    const index = buildIndex([]);
    const results = searchVariables('demographics', index);
    const ids = results.map((r) => r.variable.id);
    expect(ids).toContain('gender');
    expect(ids).toContain('age');
  });

  it('finds by concept alias', () => {
    const index = buildIndex();
    const results = searchVariables('sat', index);
    const ids = results.map((r) => r.variable.id);
    expect(ids).toContain('q5_sat');
  });

  it('returns empty for empty query', () => {
    const index = buildIndex();
    const results = searchVariables('', index);
    expect(results).toHaveLength(0);
  });

  it('returns empty for whitespace-only query', () => {
    const index = buildIndex();
    const results = searchVariables('   ', index);
    expect(results).toHaveLength(0);
  });

  it('relevance scores are between 0 and 1', () => {
    const index = buildIndex();
    const results = searchVariables('satisfaction', index);
    for (const r of results) {
      expect(r.relevance).toBeGreaterThan(0);
      expect(r.relevance).toBeLessThanOrEqual(1);
    }
  });

  it('results are sorted by relevance (descending)', () => {
    const index = buildIndex();
    const results = searchVariables('satisfaction', index);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].relevance).toBeGreaterThanOrEqual(results[i].relevance);
    }
  });

  it('respects the limit parameter', () => {
    const index = buildIndex();
    const results = searchVariables('a', index, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('reports matchedOn fields', () => {
    const index = buildIndex();
    const results = searchVariables('satisfaction', index);
    expect(results[0].matchedOn.length).toBeGreaterThan(0);
  });

  it('finds brand awareness by keyword "awareness"', () => {
    const index = buildIndex([]);
    const results = searchVariables('awareness', index);
    const ids = results.map((r) => r.variable.id);
    expect(ids).toContain('brand_aware');
  });

  it('finds NPS by topic', () => {
    const index = buildIndex([]);
    const results = searchVariables('nps', index);
    expect(results[0]?.variable.id).toBe('nps');
  });
});

describe('searchVariablesAcrossDatasets', () => {
  it('merges results from multiple indexes', () => {
    const satVar2 = makeVar('sat_wave2', 'sat_wave2', 'Overall Satisfaction (Wave 2)');
    const annotations2 = new Map<string, SemanticAnnotation>([
      ['sat_wave2', { topic: 'satisfaction', measurementIntent: 'attitude', conceptFamily: 'satisfaction', source: 'auto', confidence: 0.88 }],
    ]);
    const satConcept2: Concept = {
      id: 'c2',
      name: 'satisfaction',
      aliases: [],
      variableRefs: [{ datasetId: 'ds2', variableId: 'sat_wave2', matchConfidence: 0.88 }],
    };

    const index1 = buildIndex([satisfactionConcept]);
    const index2 = buildSearchIndex([satVar2], 'ds2', annotations2, [satConcept2]);

    const results = searchVariablesAcrossDatasets('satisfaction', [index1, index2]);
    const ids = results.map((r) => r.variable.id);
    expect(ids).toContain('q5_sat');
    expect(ids).toContain('sat_wave2');
  });

  it('still limits total results', () => {
    const index1 = buildIndex();
    const index2 = buildIndex();
    const results = searchVariablesAcrossDatasets('a', [index1, index2], 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
