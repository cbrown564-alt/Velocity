import { describe, it, expect, beforeEach } from 'vitest';
import { ConceptStore } from '../concepts';

describe('ConceptStore', () => {
  let store: ConceptStore;

  beforeEach(() => {
    store = new ConceptStore();
  });

  // ---- Create & List -------------------------------------------------------

  it('creates a concept and returns it', () => {
    const concept = store.createConcept({ name: 'Overall Satisfaction' });
    expect(concept.id).toBeTruthy();
    expect(concept.name).toBe('Overall Satisfaction');
    expect(concept.aliases).toEqual([]);
    expect(concept.variableRefs).toEqual([]);
  });

  it('lists created concepts', () => {
    store.createConcept({ name: 'NPS' });
    store.createConcept({ name: 'Brand Awareness' });
    expect(store.listConcepts()).toHaveLength(2);
  });

  it('stores canonicalScale', () => {
    const concept = store.createConcept({
      name: 'Satisfaction (10pt)',
      canonicalScale: {
        points: 10,
        direction: 'ascending',
        anchors: { low: 'Not satisfied', high: 'Extremely satisfied' },
      },
    });
    expect(concept.canonicalScale?.points).toBe(10);
    expect(concept.canonicalScale?.anchors?.high).toBe('Extremely satisfied');
  });

  // ---- Get & Delete --------------------------------------------------------

  it('retrieves concept by id', () => {
    const created = store.createConcept({ name: 'Test' });
    const retrieved = store.getConcept(created.id);
    expect(retrieved?.name).toBe('Test');
  });

  it('returns undefined for unknown id', () => {
    expect(store.getConcept('nonexistent')).toBeUndefined();
  });

  it('deletes a concept', () => {
    const c = store.createConcept({ name: 'Temp' });
    store.deleteConcept(c.id);
    expect(store.getConcept(c.id)).toBeUndefined();
    expect(store.listConcepts()).toHaveLength(0);
  });

  // ---- Aliases -------------------------------------------------------------

  it('adds an alias without duplicates', () => {
    const c = store.createConcept({ name: 'Satisfaction' });
    store.addAlias(c.id, 'sat');
    store.addAlias(c.id, 'sat'); // duplicate
    expect(store.getConcept(c.id)?.aliases).toEqual(['sat']);
  });

  it('throws when adding alias to unknown concept', () => {
    expect(() => store.addAlias('bad-id', 'alias')).toThrow();
  });

  // ---- Variable Linking ----------------------------------------------------

  it('links a variable to a concept', () => {
    const c = store.createConcept({ name: 'Satisfaction' });
    store.linkVariable(c.id, { datasetId: 'ds1', variableId: 'q5', matchConfidence: 0.9 });
    const concept = store.getConcept(c.id)!;
    expect(concept.variableRefs).toHaveLength(1);
    expect(concept.variableRefs[0].variableId).toBe('q5');
  });

  it('does not duplicate variable refs on re-link', () => {
    const c = store.createConcept({ name: 'NPS' });
    store.linkVariable(c.id, { datasetId: 'ds1', variableId: 'nps', matchConfidence: 0.8 });
    store.linkVariable(c.id, { datasetId: 'ds1', variableId: 'nps', matchConfidence: 0.95 });
    expect(store.getConcept(c.id)!.variableRefs).toHaveLength(1);
    // Should update to highest confidence
    expect(store.getConcept(c.id)!.variableRefs[0].matchConfidence).toBe(0.95);
  });

  it('unlinks a variable from a concept', () => {
    const c = store.createConcept({ name: 'Satisfaction' });
    store.linkVariable(c.id, { datasetId: 'ds1', variableId: 'q5', matchConfidence: 0.9 });
    store.unlinkVariable(c.id, 'ds1', 'q5');
    expect(store.getConcept(c.id)!.variableRefs).toHaveLength(0);
  });

  it('conceptsForVariable finds concepts linked to that variable', () => {
    const c1 = store.createConcept({ name: 'Satisfaction' });
    const c2 = store.createConcept({ name: 'NPS' });
    store.linkVariable(c1.id, { datasetId: 'ds1', variableId: 'sat', matchConfidence: 0.9 });
    store.linkVariable(c2.id, { datasetId: 'ds1', variableId: 'nps', matchConfidence: 0.8 });

    const result = store.conceptsForVariable('ds1', 'sat');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Satisfaction');
  });

  // ---- Find by Name --------------------------------------------------------

  it('finds concept by exact name', () => {
    store.createConcept({ name: 'Brand Awareness' });
    const result = store.findByName('Brand Awareness');
    expect(result).toHaveLength(1);
  });

  it('finds concept by alias', () => {
    const c = store.createConcept({ name: 'Satisfaction', aliases: ['sat', 'overall sat'] });
    const result = store.findByName('sat');
    expect(result[0].id).toBe(c.id);
  });

  it('returns empty array for unknown name', () => {
    expect(store.findByName('nonexistent')).toHaveLength(0);
  });

  // ---- Merge ---------------------------------------------------------------

  it('merges two concepts, consolidating variable refs', () => {
    const c1 = store.createConcept({ name: 'Overall Satisfaction' });
    const c2 = store.createConcept({ name: 'Sat Overall', aliases: ['sat'] });
    store.linkVariable(c1.id, { datasetId: 'ds1', variableId: 'q5', matchConfidence: 0.9 });
    store.linkVariable(c2.id, { datasetId: 'ds2', variableId: 'sat_q1', matchConfidence: 0.85 });

    const merged = store.mergeConcepts(c1.id, c2.id);
    expect(merged.variableRefs).toHaveLength(2);
    expect(merged.aliases).toContain('Sat Overall');
    expect(merged.aliases).toContain('sat');
    // Source concept should be deleted
    expect(store.getConcept(c2.id)).toBeUndefined();
    expect(store.listConcepts()).toHaveLength(1);
  });

  it('throws when merging with unknown concept ids', () => {
    const c = store.createConcept({ name: 'Test' });
    expect(() => store.mergeConcepts(c.id, 'bad')).toThrow();
    expect(() => store.mergeConcepts('bad', c.id)).toThrow();
  });

  // ---- Serialization -------------------------------------------------------

  it('serializes and deserializes concepts', () => {
    const c = store.createConcept({ name: 'Satisfaction', aliases: ['sat'] });
    store.linkVariable(c.id, { datasetId: 'ds1', variableId: 'q5', matchConfidence: 0.9 });
    const json = store.toJSON();

    const store2 = new ConceptStore();
    store2.fromJSON(json);
    expect(store2.listConcepts()).toHaveLength(1);
    expect(store2.getConcept(c.id)?.name).toBe('Satisfaction');
    expect(store2.getConcept(c.id)?.variableRefs).toHaveLength(1);
  });

  it('clear() empties the store', () => {
    store.createConcept({ name: 'A' });
    store.createConcept({ name: 'B' });
    store.clear();
    expect(store.listConcepts()).toHaveLength(0);
  });
});
