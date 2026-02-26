import { describe, expect, it } from 'vitest';
import { processMetadata } from './savLoader';

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

    const ids = result.variableSets.map(vs => vs.id);

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
