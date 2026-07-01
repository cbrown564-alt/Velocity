/**
 * Column (horizontal) virtualization for the crosstab table (Phase 4 Task 3).
 *
 * Row virtualization (Task 2) windows the `<tbody>` for tall tables. Very wide
 * banners — tens of body columns — are the other large-result shape: every
 * column renders a header cell plus one cell per visible row, and the
 * proportional percentage widths (`computeCrosstabColumnWidths`) squeeze each
 * column too thin to read while still paying the full DOM/motion cost.
 *
 * Above the column threshold the table switches from proportional percentage
 * widths to a uniform fixed pixel width per data column (the horizontal analog
 * of the fixed row-height assumption row virtualization already makes) and
 * windows the columns: only the on-screen slice of body columns is rendered,
 * with left/right spacer cells carrying the width of the off-screen columns so
 * the horizontal scrollbar stays correct. The always-present row-label column
 * and the trailing Total column are never windowed. Tables at or below the
 * threshold keep the proportional-width, render-every-column path unchanged, so
 * ordinary crosstabs are untouched.
 *
 * The one bounded limitation mirrors row virtualization: drag-to-merge a column
 * still works for on-screen columns (drag start and drop target are both under
 * the cursor), but a multi-select merge whose *source* columns are scrolled off
 * the horizontal viewport cannot be picked up while off-screen — scroll them
 * into view first.
 */

/** Above this many body columns, DataTable windows the columns. Sized well above
 *  typical banners (6–15 columns) so ordinary crosstabs keep their proportional
 *  widths; only genuinely wide banners switch to fixed-width windowing. */
export const VIRTUALIZE_COL_THRESHOLD = 30;

/** Fixed width (px) of each data column when columns are virtualized. Roomy
 *  enough for the stacked `%` + `n=` cell content the proportional path floors
 *  at `NUMERIC_FLOOR` characters. */
export const VIRTUALIZED_COL_WIDTH = 112;

/** Fixed width (px) of the always-rendered row-label column when virtualizing. */
export const VIRTUALIZED_ROW_LABEL_WIDTH = 240;

/** Fixed width (px) of the trailing Total column when virtualizing. */
export const VIRTUALIZED_TOTAL_COL_WIDTH = 100;

/** Viewport width assumed before the scroll container has been measured. */
export const DEFAULT_VIEWPORT_WIDTH = 1000;

/** Extra columns rendered left and right of the viewport for smooth scrolling. */
export const COL_OVERSCAN = 4;

export function shouldVirtualizeCols(colCount: number): boolean {
  return colCount > VIRTUALIZE_COL_THRESHOLD;
}

/** Total natural width (px) of a column-virtualized table: the row-label column,
 *  every data column at its fixed width, and the trailing Total column. Constant
 *  regardless of scroll position, so the horizontal scrollbar stays stable. */
export function virtualizedTableWidth(colCount: number, hasTotalColumn: boolean): number {
  return (
    VIRTUALIZED_ROW_LABEL_WIDTH + colCount * VIRTUALIZED_COL_WIDTH + (hasTotalColumn ? VIRTUALIZED_TOTAL_COL_WIDTH : 0)
  );
}

export interface ColWindow {
  /** First rendered column index (inclusive). */
  startIndex: number;
  /** One past the last rendered column index (exclusive). */
  endIndex: number;
  /** Width of the left spacer cell (px). */
  leftPadding: number;
  /** Width of the right spacer cell (px). */
  rightPadding: number;
}

/**
 * Compute the window of columns to render from the horizontal scroll position.
 *
 * `leftOffset` is the width of the always-rendered row-label column: the first
 * data column begins at content-x `leftOffset`, so a data column is only clear
 * of the left edge once the scroll position has passed it. Spacer padding is
 * data-column-relative (index × colWidth), independent of the row label.
 */
export function computeColWindow(params: {
  scrollLeft: number;
  viewportWidth: number;
  colWidth: number;
  colCount: number;
  overscan?: number;
  leftOffset?: number;
}): ColWindow {
  const { scrollLeft, viewportWidth, colWidth, colCount } = params;
  const overscan = params.overscan ?? COL_OVERSCAN;
  const leftOffset = params.leftOffset ?? 0;

  if (colCount <= 0 || colWidth <= 0) {
    return { startIndex: 0, endIndex: Math.max(0, colCount), leftPadding: 0, rightPadding: 0 };
  }

  const firstVisible = Math.floor((scrollLeft - leftOffset) / colWidth);
  const visibleCount = Math.ceil(viewportWidth / colWidth);

  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(colCount, Math.max(0, firstVisible) + visibleCount + overscan);

  return {
    startIndex,
    endIndex,
    leftPadding: startIndex * colWidth,
    rightPadding: Math.max(0, (colCount - endIndex) * colWidth),
  };
}
