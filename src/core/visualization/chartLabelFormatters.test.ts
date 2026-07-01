import { describe, expect, it } from 'vitest';
import {
  formatAxisTick,
  formatBarTooltip,
  formatBarValueLabel,
  isPercentAxisMode,
  layoutLegendItems,
} from './chartLabelFormatters';

describe('chartLabelFormatters', () => {
  it('detects percent axis mode', () => {
    expect(isPercentAxisMode('percent')).toBe(true);
    expect(isPercentAxisMode('count')).toBe(false);
    expect(isPercentAxisMode('none')).toBe(false);
  });

  it('formats axis ticks for percent and count modes', () => {
    expect(formatAxisTick('percent', 0.5)).toBe('50%');
    expect(formatAxisTick('percent', 1)).toBe('100%');
    expect(formatAxisTick('count', 1200)).toBe('1,200');
  });

  it('formats bar labels as percent when axis is percent scale', () => {
    expect(formatBarValueLabel('percent', 45, 45.2)).toBe('45%');
    expect(formatBarValueLabel('count', 45, 45.2)).toBe('45');
    expect(formatBarValueLabel('none', 45, 45.2)).toBeNull();
  });

  it('builds tooltip with count when bars show percent', () => {
    expect(formatBarTooltip('Married/defacto', 82, 45.7)).toBe('Married/defacto: 46% (n=82)');
  });

  it('lays out legend items with widths that fit long labels', () => {
    const layout = layoutLegendItems(['Male', 'Married/defacto']);
    expect(layout).toHaveLength(2);
    expect(layout[0]!.x).toBe(0);
    expect(layout[1]!.x).toBeGreaterThan(layout[0]!.width);
    expect(layout[1]!.width).toBeGreaterThan(layout[0]!.width);
  });
});
