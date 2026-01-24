/**
 * Chart color palette definitions.
 * Maps to CSS variables defined in index.css for consistency with the design system.
 */
export const CHART_PALETTE = [
    'var(--color-terracotta)',   // #E07A5F
    'var(--color-success)',      // #52796F
    'var(--color-warning)',      // #F4A261
    'var(--color-info)',         // #84A59D
    'var(--gray-600)',           // #57534E
    'var(--color-primary)',      // Fallback
];

/**
 * Returns a color for a given index, cycling through the palette.
 */
export const getChartColor = (index: number): string => {
    return CHART_PALETTE[index % CHART_PALETTE.length];
};
