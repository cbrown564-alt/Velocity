/**
 * Sankey Data Builder
 *
 * Transforms harmonization mappings + frequency counts into
 * renderable Sankey diagram data.
 * Pure function — zero browser dependencies.
 */

import type { HarmonizationSession, SankeyData, SankeyNode, SankeyLink } from '../../types/harmonization';
import { detectScaleInversion } from './matchEngine';
import type { Variable } from '../../types/index';

export interface VariableFrequencyCounts {
  [variableId: string]: number;
}

/**
 * Builds Sankey diagram data from a harmonization session.
 */
export function buildSankeyData(
  session: HarmonizationSession,
  sourceVars: Variable[],
  targetVars: Variable[],
  sourceCounts: VariableFrequencyCounts,
  targetCounts: VariableFrequencyCounts
): SankeyData {
  const sourceVarMap = new Map(sourceVars.map(v => [v.id, v]));
  const targetVarMap = new Map(targetVars.map(v => [v.id, v]));

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  const addedTargetIds = new Set<string>();

  for (const mapping of session.mappings) {
    if (mapping.status === 'excluded') continue;

    const sourceVar = sourceVarMap.get(mapping.sourceVariableId);
    if (!sourceVar) continue;

    const sourceCount = sourceCounts[mapping.sourceVariableId] ?? 0;

    nodes.push({
      id: `source::${mapping.sourceVariableId}`,
      label: sourceVar.label || sourceVar.name,
      value: sourceCount,
      column: 'source',
      isOrphan: mapping.targetVariableId === null || mapping.status === 'unmapped',
    });

    if (mapping.targetVariableId) {
      const targetVar = targetVarMap.get(mapping.targetVariableId);
      if (!targetVar) continue;

      const targetCount = targetCounts[mapping.targetVariableId] ?? 0;

      if (!addedTargetIds.has(mapping.targetVariableId)) {
        nodes.push({
          id: `target::${mapping.targetVariableId}`,
          label: targetVar.label || targetVar.name,
          value: targetCount,
          column: 'target',
          isOrphan: false,
        });
        addedTargetIds.add(mapping.targetVariableId);
      }

      const isInverted = detectScaleInversion(sourceVar, targetVar);
      const linkValue = Math.min(sourceCount, targetCount);

      links.push({
        sourceId: `source::${mapping.sourceVariableId}`,
        targetId: `target::${mapping.targetVariableId}`,
        value: Math.max(linkValue, 1),
        isInverted,
      });
    }
  }

  // Add orphan target nodes (targets with no source mapping)
  const mappedTargetIds = new Set(
    session.mappings
      .filter(m => m.targetVariableId !== null)
      .map(m => m.targetVariableId!)
  );

  for (const targetVar of targetVars) {
    if (!mappedTargetIds.has(targetVar.id) && !addedTargetIds.has(targetVar.id)) {
      const targetCount = targetCounts[targetVar.id] ?? 0;
      nodes.push({
        id: `target::${targetVar.id}`,
        label: targetVar.label || targetVar.name,
        value: targetCount,
        column: 'target',
        isOrphan: true,
      });
    }
  }

  return { nodes, links };
}

/**
 * Computes vertical layout positions for a column of Sankey nodes.
 * Returns y0/y1 in [0, 1] range for each node.
 */
export function computeNodePositions(
  nodes: SankeyNode[],
  padding = 0.02
): Array<{ id: string; y0: number; y1: number }> {
  const totalValue = nodes.reduce((sum, n) => sum + n.value, 0);
  if (totalValue === 0) {
    const h = (1 - padding * (nodes.length - 1)) / Math.max(nodes.length, 1);
    return nodes.map((n, i) => ({
      id: n.id,
      y0: i * (h + padding),
      y1: i * (h + padding) + h,
    }));
  }

  const totalPadding = padding * (nodes.length - 1);
  const availableHeight = 1 - totalPadding;
  let cursor = 0;
  return nodes.map(n => {
    const h = (n.value / totalValue) * availableHeight;
    const y0 = cursor;
    const y1 = cursor + h;
    cursor = y1 + padding;
    return { id: n.id, y0, y1 };
  });
}
