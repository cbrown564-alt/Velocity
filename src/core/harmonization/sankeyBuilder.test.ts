/**
 * Sankey Builder Tests
 */

import { describe, it, expect } from 'vitest';
import { buildSankeyData, computeNodePositions } from './sankeyBuilder';
import { wave1Variables, wave2Variables, mockHarmonizationSession } from '../../test/fixtures/harmonization';
import type { SankeyNode } from '../../types/harmonization';

const sourceCounts = {
  w1_q1: 500,
  w1_q2: 490,
  w1_q3: 500,
  w1_age: 498,
  w1_q4: 450,
};

const targetCounts = {
  w2_q1: 480,
  w2_q2_renamed: 475,
  w2_gender: 480,
  w2_age: 480,
  w2_q5_new: 460,
};

describe('buildSankeyData', () => {
  it('generates nodes and links', () => {
    const result = buildSankeyData(
      mockHarmonizationSession,
      wave1Variables,
      wave2Variables,
      sourceCounts,
      targetCounts,
    );
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(Array.isArray(result.links)).toBe(true);
  });

  it('marks orphan source nodes correctly', () => {
    const result = buildSankeyData(
      mockHarmonizationSession,
      wave1Variables,
      wave2Variables,
      sourceCounts,
      targetCounts,
    );
    const q4Node = result.nodes.find((n) => n.id === 'source::w1_q4');
    expect(q4Node?.isOrphan).toBe(true);
  });

  it('marks matched nodes as non-orphan', () => {
    const result = buildSankeyData(
      mockHarmonizationSession,
      wave1Variables,
      wave2Variables,
      sourceCounts,
      targetCounts,
    );
    const q1Node = result.nodes.find((n) => n.id === 'source::w1_q1');
    expect(q1Node?.isOrphan).toBe(false);
  });

  it('generates links only for matched pairs', () => {
    const result = buildSankeyData(
      mockHarmonizationSession,
      wave1Variables,
      wave2Variables,
      sourceCounts,
      targetCounts,
    );
    // w1_q1→w2_q1 and w1_q2→w2_q2_renamed
    expect(result.links).toHaveLength(2);
  });

  it('sets link value to min of source and target counts', () => {
    const result = buildSankeyData(
      mockHarmonizationSession,
      wave1Variables,
      wave2Variables,
      sourceCounts,
      targetCounts,
    );
    const q1Link = result.links.find((l) => l.sourceId === 'source::w1_q1' && l.targetId === 'target::w2_q1');
    // min(500, 480) = 480
    expect(q1Link?.value).toBe(480);
  });

  it('includes orphan target nodes not present in any mapping', () => {
    const result = buildSankeyData(
      mockHarmonizationSession,
      wave1Variables,
      wave2Variables,
      sourceCounts,
      targetCounts,
    );
    const orphanTarget = result.nodes.find((n) => n.id === 'target::w2_q5_new');
    expect(orphanTarget).toBeDefined();
    expect(orphanTarget?.isOrphan).toBe(true);
  });
});

describe('computeNodePositions', () => {
  it('returns correct count of positions', () => {
    const nodes: SankeyNode[] = [
      { id: 'a', label: 'A', value: 100, column: 'source', isOrphan: false },
      { id: 'b', label: 'B', value: 200, column: 'source', isOrphan: false },
      { id: 'c', label: 'C', value: 300, column: 'source', isOrphan: false },
    ];
    const positions = computeNodePositions(nodes);
    expect(positions).toHaveLength(3);
  });

  it('last node y1 is close to 1', () => {
    const nodes: SankeyNode[] = [
      { id: 'a', label: 'A', value: 100, column: 'source', isOrphan: false },
      { id: 'b', label: 'B', value: 200, column: 'source', isOrphan: false },
      { id: 'c', label: 'C', value: 300, column: 'source', isOrphan: false },
    ];
    const positions = computeNodePositions(nodes);
    expect(positions[positions.length - 1].y1).toBeCloseTo(1, 1);
  });

  it('distributes equally for zero-value nodes', () => {
    const nodes: SankeyNode[] = [
      { id: 'a', label: 'A', value: 0, column: 'source', isOrphan: false },
      { id: 'b', label: 'B', value: 0, column: 'source', isOrphan: false },
    ];
    const positions = computeNodePositions(nodes);
    const h0 = positions[0].y1 - positions[0].y0;
    const h1 = positions[1].y1 - positions[1].y0;
    expect(h0).toBeCloseTo(h1, 5);
  });

  it('does not overlap nodes', () => {
    const nodes: SankeyNode[] = [
      { id: 'a', label: 'A', value: 100, column: 'source', isOrphan: false },
      { id: 'b', label: 'B', value: 200, column: 'source', isOrphan: false },
      { id: 'c', label: 'C', value: 50, column: 'source', isOrphan: false },
    ];
    const positions = computeNodePositions(nodes);
    for (let i = 0; i < positions.length - 1; i++) {
      expect(positions[i].y1).toBeLessThanOrEqual(positions[i + 1].y0);
    }
  });
});
