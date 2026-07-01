import type { TableRowNode } from '../../../core/analysis/treeBuilder';

/**
 * Row virtualization for the crosstab table (Phase 4 Task 2).
 *
 * The crosstab is a semantic `<table>` with a sticky `<thead>`, fixed column
 * widths, recursive expandable rows, and drag-to-merge keyed off DOM
 * `data-merge-*` attributes. Rather than replace that structure with a
 * div-based windowing list (which would break sticky headers, column widths,
 * and drag positioning), large tables keep the table and window only the
 * `<tbody>`: the tree is flattened into the currently-visible row order, a
 * window of rows is rendered, and top/bottom spacer `<tr>`s preserve the total
 * scroll height. Tables below the threshold render every row as before, so the
 * common case is unchanged.
 */

/** Above this many visible (flattened) rows, DataTable windows the body. */
export const VIRTUALIZE_ROW_THRESHOLD = 100;

/** Estimated body-row height per density (px). Rows are near-uniform, so a
 *  fixed estimate (the react-window FixedSizeList approach) is sufficient;
 *  multi-line labels introduce minor, bounded scroll drift. */
export const ESTIMATED_ROW_HEIGHT: Record<'compact' | 'generous', number> = {
  compact: 33,
  generous: 45,
};

/** Viewport height assumed before the scroll container has been measured. */
export const DEFAULT_VIEWPORT_HEIGHT = 600;

/** Extra rows rendered above and below the viewport for smooth scrolling. */
export const ROW_OVERSCAN = 8;

/**
 * Depth-first flatten of the row tree into the order rows are displayed,
 * including a node's children only when it is expanded. A node is expanded by
 * default unless `expandedKeys` explicitly marks it collapsed — this mirrors
 * `CrosstabRow`'s `expandedKeys[row.key] ?? true`.
 */
export function flattenVisibleRows(rows: TableRowNode[], expandedKeys: Record<string, boolean>): TableRowNode[] {
  const out: TableRowNode[] = [];
  const walk = (nodes: TableRowNode[]): void => {
    for (const node of nodes) {
      out.push(node);
      if (node.children.length > 0 && (expandedKeys[node.key] ?? true)) {
        walk(node.children);
      }
    }
  };
  walk(rows);
  return out;
}

export function shouldVirtualizeRows(flatRowCount: number): boolean {
  return flatRowCount > VIRTUALIZE_ROW_THRESHOLD;
}

export interface RowWindow {
  /** First rendered row index (inclusive). */
  startIndex: number;
  /** One past the last rendered row index (exclusive). */
  endIndex: number;
  /** Height of the top spacer row (px). */
  topPadding: number;
  /** Height of the bottom spacer row (px). */
  bottomPadding: number;
}

/**
 * Compute the window of rows to render from the scroll position.
 *
 * `headerOffset` accounts for the sticky header occupying the top of the scroll
 * container: a body row is only clear of the header once it has scrolled past
 * it. Spacer padding is body-relative (index × rowHeight), independent of the
 * header.
 */
export function computeRowWindow(params: {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  rowCount: number;
  overscan?: number;
  headerOffset?: number;
}): RowWindow {
  const { scrollTop, viewportHeight, rowHeight, rowCount } = params;
  const overscan = params.overscan ?? ROW_OVERSCAN;
  const headerOffset = params.headerOffset ?? 0;

  if (rowCount <= 0 || rowHeight <= 0) {
    return { startIndex: 0, endIndex: Math.max(0, rowCount), topPadding: 0, bottomPadding: 0 };
  }

  const firstVisible = Math.floor((scrollTop - headerOffset) / rowHeight);
  const visibleCount = Math.ceil(viewportHeight / rowHeight);

  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(rowCount, Math.max(0, firstVisible) + visibleCount + overscan);

  return {
    startIndex,
    endIndex,
    topPadding: startIndex * rowHeight,
    bottomPadding: Math.max(0, (rowCount - endIndex) * rowHeight),
  };
}
