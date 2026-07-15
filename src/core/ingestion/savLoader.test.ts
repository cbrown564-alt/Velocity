import { describe, expect, it } from 'vitest';
import { buildCrosstabRequest } from '../analysis/buildCrosstabRequest';
import { prepareCrosstabOptions } from '../analysis/crosstab/prepare';
import { buildCrosstabQuery } from '../sql/queryBuilder';
import { processMetadata } from './savLoader';

describe('processMetadata label normalization', () => {
  it('removes terminal NUL padding while preserving identifiers and categorical codes', () => {
    const result = processMetadata({
      metadata: {
        rowCount: 1,
        variables: [
          {
            name: 'q1',
            label: 'Question 1\0\0',
            type: 'numeric',
            index: 0,
            valueLabelSetName: 'yes_no',
          },
        ],
        valueLabelSets: {
          yes_no: [
            { value: 0, label: 'No\0' },
            { value: 1, label: 'Yes\0\0' },
          ],
        },
        multipleResponseSets: [
          {
            name: '$CHOICES\0',
            label: 'Choices\0\0',
            type: 'D',
            subvariables: ['q1'],
            countedValue: 1,
          },
        ],
      },
      rows: [[1]],
    });

    expect(result.variables[0]).toMatchObject({
      id: 'q1',
      name: 'q1',
      label: 'Question 1',
      valueLabels: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes' },
      ],
    });
    expect(result.variableSets[0]).toMatchObject({
      id: 'mrset_CHOICES',
      name: 'Choices',
      variableIds: ['q1'],
    });
  });

  it('keeps NUL-padded measure, multiple-response, and grid labels out of generated SQL', () => {
    const variables = [
      { name: 'age', label: 'Age\0', type: 'numeric' as const, index: 0 },
      ...['aware1', 'aware2', 'aware3'].map((name, index) => ({
        name,
        label: `Aware ${index + 1}${'\0'.repeat(index + 1)}`,
        type: 'numeric' as const,
        index: index + 1,
        valueLabelSetName: 'yes_no',
      })),
      ...['rating1', 'rating2', 'rating3'].map((name, index) => ({
        name,
        label: `Rating ${index + 1}${'\0'.repeat(index + 1)}`,
        type: 'numeric' as const,
        index: index + 4,
        valueLabelSetName: 'rating',
      })),
    ];
    const result = processMetadata({
      metadata: {
        rowCount: 2,
        variables,
        valueLabelSets: {
          yes_no: [
            { value: 0, label: 'No\0' },
            { value: 1, label: 'Yes\0\0' },
          ],
          rating: [
            { value: 1, label: 'Low\0' },
            { value: 2, label: 'Medium\0\0' },
            { value: 3, label: 'High\0\0\0' },
          ],
        },
      },
      rows: [
        [22, 1, 0, 1, 1, 2, 3],
        [48, 0, 1, 0, 3, 2, 1],
      ],
    });
    const dataset = {
      id: 'nul-labels',
      name: 'nul-labels.sav',
      rowCount: 2,
      variables: result.variables,
      source: 'sav' as const,
    };
    const multipleSet = result.variableSets.find((set) => set.structure === 'multiple');
    const gridChoice = result.variableSets.find((set) => set.derived && set.id.endsWith('_items'));

    expect(multipleSet).toBeDefined();
    expect(gridChoice).toBeDefined();

    const analysisIds = ['vs_age', multipleSet!.id, gridChoice!.id];
    for (const rowVar of analysisIds) {
      const request = buildCrosstabRequest({
        dataset,
        variableSets: result.variableSets,
        rowVars: [rowVar],
        colVar: null,
        filters: [],
      });
      const options = prepareCrosstabOptions(request.options, request.context);
      const sql = buildCrosstabQuery(options);

      expect(sql).not.toContain('\0');
    }
  });
});

describe('processMetadata ordering', () => {
  it('keeps detected grid sets near their original survey position', () => {
    const result = processMetadata({
      metadata: {
        rowCount: 3,
        variables: [
          { name: 'q1', type: 'numeric', index: 0 },
          { name: 'fatigue1', type: 'numeric', index: 1, valueLabelSetName: 'likert3' },
          { name: 'fatigue2', type: 'numeric', index: 2, valueLabelSetName: 'likert3' },
          { name: 'fatigue3', type: 'numeric', index: 3, valueLabelSetName: 'likert3' },
          { name: 'q2', type: 'numeric', index: 4 },
        ],
        valueLabelSets: {
          likert3: [
            { value: 1, label: 'Low' },
            { value: 2, label: 'Medium' },
            { value: 3, label: 'High' },
          ],
        },
      },
      rows: [
        [1, 1, 2, 3, 10],
        [2, 2, 3, 1, 20],
        [3, 3, 2, 1, 30],
      ],
    });

    const ids = result.variableSets.map((vs) => vs.id);

    const q1Index = ids.indexOf('vs_q1');
    const q2Index = ids.indexOf('vs_q2');
    const detectedGridIndex = ids.indexOf('heuristic_grid_fatigue1_fatigue2_fatigue3');

    expect(q1Index).toBeGreaterThanOrEqual(0);
    expect(q2Index).toBeGreaterThanOrEqual(0);
    expect(detectedGridIndex).toBeGreaterThanOrEqual(0);

    expect(detectedGridIndex).toBeGreaterThan(q1Index);
    expect(detectedGridIndex).toBeLessThan(q2Index);
  });
});
