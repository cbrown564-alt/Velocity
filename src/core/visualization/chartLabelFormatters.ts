/**
 * Shared formatters for chart axis ticks and bar value labels.
 * Keeps percent vs count semantics consistent across renderers.
 */

export type ChartLabelDisplayMode = 'count' | 'percent' | 'none';

/** Whether the axis domain represents 0–100 percent scale. */
export function isPercentAxisMode(labelMode: ChartLabelDisplayMode): boolean {
  return labelMode === 'percent';
}

/** Format a linear axis tick (domain 0–1 when percent, raw counts otherwise). */
export function formatAxisTick(labelMode: ChartLabelDisplayMode, tick: number): string {
  if (isPercentAxisMode(labelMode)) {
    return `${Math.round(tick * 100)}%`;
  }
  return tick.toLocaleString();
}

/** Format the value shown on or beside a bar. */
export function formatBarValueLabel(labelMode: ChartLabelDisplayMode, count: number, percent: number): string | null {
  if (labelMode === 'none') return null;
  if (isPercentAxisMode(labelMode)) {
    return `${Math.round(percent)}%`;
  }
  return count.toLocaleString();
}

/** Tooltip text when bars show percent — includes raw count for context. */
export function formatBarTooltip(label: string, count: number, percent: number): string {
  return `${label}: ${Math.round(percent)}% (n=${count.toLocaleString()})`;
}

/** Estimate pixel width for SVG legend layout (approximate, 11px body font). */
export function estimateLegendItemWidth(label: string, minWidth = 72): number {
  const textWidth = Math.max(label.length, 1) * 6.5;
  return Math.max(minWidth, 18 + textWidth);
}

/** Layout legend items left-to-right with spacing; returns cumulative positions. */
export function layoutLegendItems(
  labels: string[],
  options?: { minItemWidth?: number; gap?: number },
): { x: number; width: number }[] {
  const minItemWidth = options?.minItemWidth ?? 72;
  const gap = options?.gap ?? 16;
  let x = 0;
  return labels.map((label) => {
    const width = estimateLegendItemWidth(label, minItemWidth);
    const item = { x, width };
    x += width + gap;
    return item;
  });
}
