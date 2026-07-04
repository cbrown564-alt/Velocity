/**
 * Shared formatters for chart axis ticks and bar value labels.
 * Bar geometry always uses counts; label mode switches axis tick labels and bar value labels.
 */

export type ChartLabelDisplayMode = 'count' | 'percent' | 'none';

/** Whether axis ticks should be formatted as percentages (0–1 domain). */
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

export interface ValueAxisTickOptions {
  /** Largest count in the chart (unpadded domain maximum). */
  peakCount: number;
  /** Respondent / cell base for single-column distributions. */
  grandTotal?: number;
  /** True when a column banner splits the chart (cross-tab). */
  hasColumnBreak?: boolean;
}

/**
 * Format a value-axis tick while bar geometry stays count-based.
 * Percent ticks are a linear rescale of the count axis so bar positions are unchanged.
 */
export function formatValueAxisTick(
  labelMode: ChartLabelDisplayMode,
  tick: number,
  options: ValueAxisTickOptions,
): string {
  if (labelMode === 'percent') {
    const { peakCount, grandTotal = 0, hasColumnBreak = false } = options;
    const reference = hasColumnBreak ? peakCount : grandTotal > 0 ? grandTotal : peakCount;
    if (reference <= 0) return '0%';
    return formatAxisTick('percent', tick / reference);
  }
  return formatAxisTick('count', tick);
}

/** Peak count across grouped cells, or the tallest single-series bar. */
export function resolvePeakCount(values: number[]): number {
  return values.reduce((peak, value) => (value > peak ? value : peak), 0) || 1;
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
