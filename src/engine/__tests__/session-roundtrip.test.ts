// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { VelocityEngine } from '../VelocityEngine';

describe('VelocityEngine session round-trip', () => {
  let sourceEngine: VelocityEngine;
  let targetEngine: VelocityEngine;

  beforeAll(async () => {
    const dataDir = path.resolve(__dirname, '../../../test_data');
    sourceEngine = await VelocityEngine.create({ runtime: 'node', dataDir, engineVersion: 'test-roundtrip' });
    targetEngine = await VelocityEngine.create({ runtime: 'node', dataDir, engineVersion: 'test-roundtrip' });
  });

  afterAll(async () => {
    await sourceEngine.close();
    await targetEngine.close();
  });

  it('preserves filters, weight, slides, sections, and semantic state across export/import', async () => {
    await sourceEngine.loadFile('sleep.sav');

    sourceEngine.addFilter({
      id: 'filter-sex',
      variableId: 'sex',
      operator: 'eq',
      value: 1,
    });
    sourceEngine.setWeight('weight');
    sourceEngine.annotateVariable('sex', {
      topic: 'demographics',
      measurementIntent: 'demographic',
      source: 'agent',
      confidence: 1,
    });
    sourceEngine.annotateVariable('qualsleep', {
      topic: 'sleep_quality',
      measurementIntent: 'outcome',
      source: 'agent',
      confidence: 1,
    });

    const concept = sourceEngine.createConcept({
      name: 'Sleep Quality',
      aliases: ['sleep satisfaction'],
    });
    sourceEngine.linkVariableToConcept('qualsleep', concept.data.id);

    const builtDeck = await sourceEngine.buildDeck({
      title: 'Sleep Round Trip',
      sections: [
        {
          title: 'Overview',
          slides: [
            {
              rowVars: ['qualsleep'],
              colVar: 'sex',
              weightVar: 'weight',
              visualizationType: 'chart',
              notes: 'Round-trip session should preserve this slide.',
            },
          ],
        },
      ],
    });
    expect(builtDeck.data.errors).toHaveLength(0);
    sourceEngine.commitDeck(builtDeck.data);

    const exported = await sourceEngine.exportSession();
    expect(exported.operation).toBe('exportSession');
    expect(exported.data.semantic?.annotations.sex?.topic).toBe('demographics');

    await targetEngine.loadFile('sleep.sav');
    targetEngine.annotateVariable('sex', {
      topic: 'local_topic',
      measurementIntent: 'demographic',
      source: 'manual',
      confidence: 1,
    });
    const localConcept = targetEngine.createConcept({ name: 'Local Concept' });

    const imported = await targetEngine.importSession(exported.data);
    expect(imported.operation).toBe('importSession');
    expect(imported.data.missingVariableIds).toEqual([]);
    expect(imported.data.droppedFilterIds).toEqual([]);

    const description = targetEngine.describe();
    expect(description.data.activeFilters).toEqual([
      {
        id: 'filter-sex',
        variableId: 'sex',
        operator: 'eq',
        value: 1,
      },
    ]);
    expect(description.data.weightVariable).toBe('weight');

    const restoredSession = targetEngine.getSession();
    expect(restoredSession.data.slides).toHaveLength(1);
    expect(restoredSession.data.sections).toHaveLength(1);
    const restoredSlide = restoredSession.data.slides[0];
    const restoredRowSetId = restoredSlide?.analysisState.rowVars[0];
    const restoredColSetId = restoredSlide?.analysisState.colVar;
    const variableSetsById = new Map(description.data.variableSets.map((item) => [item.id, item]));

    expect(restoredRowSetId).toBeTruthy();
    expect(variableSetsById.get(restoredRowSetId!)?.variableIds).toContain('qualsleep');
    expect(restoredColSetId).toBeTruthy();
    expect(variableSetsById.get(restoredColSetId!)?.variableIds).toContain('sex');

    const importedAnnotation = targetEngine.getAnnotation('sex');
    expect(importedAnnotation.data?.topic).toBe('demographics');

    const concepts = targetEngine.listConcepts();
    expect(concepts.data.map((item) => item.name)).toEqual(
      expect.arrayContaining(['Sleep Quality', 'Local Concept'])
    );
    expect(concepts.data.map((item) => item.id)).toContain(localConcept.data.id);
  }, 30000);
});
