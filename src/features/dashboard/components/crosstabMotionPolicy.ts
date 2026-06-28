import type { TableRowNode } from '../../../core/analysis/treeBuilder';

/**
 * Per-cell entry animations in the crosstab (the `AnimatedNumber`, the fade-in
 * metadata wrapper, the significance spring-lock, and the Mission Control
 * phosphor ghost) each mount their own Framer Motion instance. On large result
 * matrices the sheer number of cells animating at once after a query completes
 * is what makes the table jank, even when DuckDB itself is fast — DuckDB
 * returning quickly does not help if the UI then mounts a thousand motion
 * values on the main thread.
 *
 * Above this many rendered cells (row nodes × body columns) we suppress those
 * entry animations and render static cells so large tables stay responsive.
 *
 * Sized so ordinary survey crosstabs keep their entry animation — a 5-point
 * Likert × a 6-column banner is 30 cells; a 20-row categorical × a 10-column
 * banner is 200 cells — while wide banners and long multi-level tables (which
 * are the cases that actually jank) drop it.
 */
export const MAX_ANIMATED_CROSSTAB_CELLS = 500;

/**
 * Count every node in the row tree, including expanded child rows. Child rows
 * render by default (a row is expanded unless explicitly collapsed), so the
 * full node count is the relevant upper bound on simultaneously-rendered rows.
 */
export function countTreeNodes(nodes: TableRowNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children.length > 0) {
      count += countTreeNodes(node.children);
    }
  }
  return count;
}

/**
 * Whether a crosstab result is small enough to animate its cells.
 *
 * @param rowNodeCount total number of row nodes (see {@link countTreeNodes})
 * @param columnCount  number of body columns (excluding the row-label column)
 */
export function shouldAnimateCrosstab(rowNodeCount: number, columnCount: number): boolean {
  return rowNodeCount * Math.max(columnCount, 1) <= MAX_ANIMATED_CROSSTAB_CELLS;
}
