/**
 * LassoSelector
 *
 * SVG overlay enabling lasso (polygon) selection of Sankey nodes.
 * Hold Shift + drag to enter lasso mode; click mode is default.
 *
 * Uses d3-polygon's polygonContains for hit-testing.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { SankeyNode } from '../../../types/harmonization';
import styles from './LassoSelector.module.css';

interface LassoSelectorProps {
  nodes: SankeyNode[];
  /** Width/height of the Sankey SVG coordinate space */
  width: number;
  height: number;
  /** Called when lasso selection is committed */
  onSelectionCommit: (selectedIds: string[]) => void;
  /** Node centers in SVG space, keyed by node id */
  nodeCenters: Map<string, { x: number; y: number }>;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
}

type Point = [number, number];

function polygonContainsPoint(polygon: Point[], point: Point): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export const LassoSelector: React.FC<LassoSelectorProps> = ({
  nodes,
  width,
  height,
  onSelectionCommit,
  nodeCenters,
  isActive,
  onActiveChange,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [dragging, setDragging] = useState(false);

  const getPoint = useCallback(
    (e: React.PointerEvent | PointerEvent): Point => {
      const rect = svgRef.current!.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      return [
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top) * scaleY,
      ];
    },
    [width, height]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isActive) return;
      e.preventDefault();
      svgRef.current!.setPointerCapture(e.pointerId);
      setPoints([getPoint(e)]);
      setDragging(true);
    },
    [isActive, getPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !isActive) return;
      setPoints(prev => [...prev, getPoint(e)]);
    },
    [dragging, isActive, getPoint]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || !isActive) return;
      setDragging(false);

      const finalPolygon = [...points, getPoint(e)];
      if (finalPolygon.length < 3) {
        setPoints([]);
        return;
      }

      // Test all node centers against polygon
      const selected: string[] = [];
      for (const node of nodes) {
        const center = nodeCenters.get(node.id);
        if (center && polygonContainsPoint(finalPolygon, [center.x, center.y])) {
          selected.push(node.id);
        }
      }

      setPoints([]);
      onSelectionCommit(selected);
    },
    [dragging, isActive, points, getPoint, nodes, nodeCenters, onSelectionCommit]
  );

  // Escape to cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isActive) {
        setPoints([]);
        setDragging(false);
        onActiveChange(false);
      }
      if (e.key === 'Shift') {
        onActiveChange(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !dragging) {
        onActiveChange(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isActive, dragging, onActiveChange]);

  const pathD =
    points.length > 1
      ? `M ${points.map(([x, y]) => `${x},${y}`).join(' L ')} Z`
      : '';

  return (
    <svg
      ref={svgRef}
      className={[styles.overlay, isActive ? styles.active : ''].join(' ')}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {pathD && (
        <path
          d={pathD}
          className={styles.lasso}
        />
      )}
      {isActive && !dragging && (
        <text x={8} y={height - 8} className={styles.hint}>
          Click &amp; drag to select nodes
        </text>
      )}
    </svg>
  );
};

export default LassoSelector;
