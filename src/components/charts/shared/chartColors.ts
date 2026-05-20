/**
 * Chart color palette definitions.
 * Maps to CSS variables defined in index.css for consistency with the design system.
 */
export const CHART_PALETTE = [
    'var(--viz-palette-1)',
    'var(--viz-palette-2)',
    'var(--viz-palette-3)',
    'var(--viz-palette-4)',
    'var(--viz-palette-5)',
    'var(--viz-palette-6)',
];

/** Opacity for filled bar/column segments — matches grouped bar renderers. */
export const CHART_BAR_FILL_OPACITY = 0.8;

/** Text on filled bar segments (light on saturated fills). */
export const CHART_BAR_INNER_LABEL_FILL = 'var(--text-inverse)';

/**
 * Returns a color for a given index, cycling through the palette.
 */
export const getChartColor = (index: number): string => {
    return CHART_PALETTE[index % CHART_PALETTE.length];
};
