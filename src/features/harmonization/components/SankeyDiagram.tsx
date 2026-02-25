/**
 * SankeyDiagram
 *
 * D3-based Sankey flow diagram for harmonization variable mapping.
 * Shows source variables on the left, target variables on the right,
 * with flow links proportional to respondent counts.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { select } from 'd3-selection';
import { linkHorizontal } from 'd3-shape';
import type { SankeyData, SankeyNode, SankeyLink } from '../../../types/harmonization';
import { computeNodePositions } from '../../../core/harmonization/sankeyBuilder';
import styles from './SankeyDiagram.module.css';

interface SankeyDiagramProps {
  data: SankeyData;
  selectedMappingId?: string | null;
  onSelectMapping?: (sourceId: string | null) => void;
  width?: number;
  height?: number;
}

const NODE_WIDTH = 16;
const PADDING_X = 120;  // label space on each side
const HEADER_HEIGHT = 28;

export const SankeyDiagram: React.FC<SankeyDiagramProps> = ({
  data,
  selectedMappingId,
  onSelectMapping,
  width = 600,
  height = 400,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const draw = useCallback(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll('*').remove();

    const innerWidth = width - PADDING_X * 2;
    const innerHeight = height - HEADER_HEIGHT - 16;

    const sourceNodes = data.nodes.filter(n => n.column === 'source');
    const targetNodes = data.nodes.filter(n => n.column === 'target');

    const sourcePositions = computeNodePositions(sourceNodes);
    const targetPositions = computeNodePositions(targetNodes);

    const sourcePosMap = new Map(sourcePositions.map(p => [p.id, p]));
    const targetPosMap = new Map(targetPositions.map(p => [p.id, p]));

    // Helper: pixel y-center from normalized position
    const toPixelY = (y0: number, y1: number) =>
      HEADER_HEIGHT + (y0 + y1) / 2 * innerHeight;
    const toPixelY0 = (y: number) => HEADER_HEIGHT + y * innerHeight;
    const toPixelH = (y0: number, y1: number) =>
      Math.max((y1 - y0) * innerHeight, 4);

    const sourceX = PADDING_X;
    const targetX = PADDING_X + innerWidth;

    // Column headers
    const headerG = svg.append('g');
    headerG.append('text')
      .attr('x', sourceX + NODE_WIDTH / 2)
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('class', styles.columnHeader)
      .text('Source Wave');

    headerG.append('text')
      .attr('x', targetX + NODE_WIDTH / 2)
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('class', styles.columnHeader)
      .text('Target Wave');

    // Draw links
    const linkG = svg.append('g');
    for (const link of data.links) {
      const srcPos = sourcePosMap.get(link.sourceId);
      const tgtPos = targetPosMap.get(link.targetId);
      if (!srcPos || !tgtPos) continue;

      const srcY = toPixelY(srcPos.y0, srcPos.y1);
      const tgtY = toPixelY(tgtPos.y0, tgtPos.y1);
      const strokeWidth = Math.max(
        toPixelH(srcPos.y0, srcPos.y1) * 0.6,
        2
      );

      const isSelected = selectedMappingId === link.sourceId.replace('source::', '');

      linkG.append('path')
        .attr('d', linkHorizontal()({
          source: [sourceX + NODE_WIDTH, srcY],
          target: [targetX, tgtY],
        } as any))
        .attr('stroke-width', strokeWidth)
        .attr('class', [
          styles.link,
          link.isInverted ? styles.inverted : '',
          isSelected ? styles.selected : '',
        ].filter(Boolean).join(' '));
    }

    // Draw source nodes
    const drawNodes = (
      nodes: SankeyNode[],
      posMap: Map<string, { id: string; y0: number; y1: number }>,
      x: number,
      isSource: boolean
    ) => {
      for (const node of nodes) {
        const pos = posMap.get(node.id);
        if (!pos) continue;

        const y0 = toPixelY0(pos.y0);
        const h = toPixelH(pos.y0, pos.y1);
        const isSelected = selectedMappingId === node.id.replace('source::', '').replace('target::', '');

        const g = svg.append('g')
          .attr('class', styles.node)
          .style('cursor', 'pointer')
          .on('click', () => {
            if (isSource && onSelectMapping) {
              const varId = node.id.replace('source::', '');
              onSelectMapping(isSelected ? null : varId);
            }
          });

        g.append('rect')
          .attr('x', x)
          .attr('y', y0)
          .attr('width', NODE_WIDTH)
          .attr('height', h)
          .attr('class', [
            styles.nodeRect,
            isSource ? styles.source : styles.target,
            node.isOrphan ? styles.orphan : '',
            isSelected ? styles.selected : '',
          ].filter(Boolean).join(' '));

        // Label
        const labelX = isSource ? x - 6 : x + NODE_WIDTH + 6;
        const labelAnchor = isSource ? 'end' : 'start';
        g.append('text')
          .attr('x', labelX)
          .attr('y', y0 + h / 2)
          .attr('text-anchor', labelAnchor)
          .attr('class', [styles.nodeLabel, node.isOrphan ? styles.orphan : ''].filter(Boolean).join(' '))
          .text(truncate(node.label, 22));
      }
    };

    drawNodes(sourceNodes, sourcePosMap, sourceX, true);
    drawNodes(targetNodes, targetPosMap, targetX, false);
  }, [data, selectedMappingId, onSelectMapping, width, height]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (data.nodes.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <span>Run auto-match to see the Sankey diagram</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <svg
        ref={svgRef}
        className={styles.svg}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      />
    </div>
  );
};

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 1) + '…' : s;
}

export default SankeyDiagram;
