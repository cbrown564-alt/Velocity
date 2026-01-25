import { Variable } from '../types';
import { ChartRecommendation, ChartType } from '../types/charts';

interface RecommenderContext {
    rowVars: Variable[];
    colVar: Variable | null;
    /** The variable set structure (e.g., is it a Grid?) */
    isGrid?: boolean;
    /** Are we looking at a Multiple Response set? */
    isMultiResponse?: boolean;
}

/**
 * Determines the best chart type for a given data configuration.
 * Follows the rules defined in arch_05_visualisation_engine.md.
 */
export function recommendChart(context: RecommenderContext): ChartRecommendation {
    const { rowVars, colVar, isGrid, isMultiResponse } = context;
    const primaryRowVar = rowVars[0];

    // 1. Grid (Multiple Statements)
    if (isGrid) {
        return {
            default: 'diverging-bar',
            alternatives: ['stacked-bar', 'grouped-bar'],
            reason: 'Likert grids are best viewed as diverging bars.',
        };
    }

    // 2. Multiple Response
    if (isMultiResponse) {
        return {
            default: 'horizontal-bar',
            alternatives: ['lollipop', 'vertical-bar'],
            reason: 'Multiple response data is best ranked by frequency.',
        };
    }

    // 3. Cross-Tab (Variable x Variable)
    if (colVar) {
        // If we have a column variable, we are comparing groups
        if (primaryRowVar?.type === 'nominal' || primaryRowVar?.type === 'ordinal') {
            const isLikert = colVar.type === 'ordinal' || colVar.type === 'numeric';
            return {
                default: isLikert ? 'diverging-bar' : 'grouped-bar',
                alternatives: ['stacked-bar', 'grouped-bar', 'diverging-bar'],
                reason: 'Comparing nominal/ordinal groups across columns.',
            };
        }
        // Numeric x Nominal (e.g. Age by Gender) -> Box Plot
        if (primaryRowVar?.type === 'numeric') {
            return {
                default: 'grouped-box-plot',
                // Note: violin/ridgeline require grouped histogram data from backend (not yet implemented)
                alternatives: ['box-plot'],
                reason: 'Comparing distributions across groups.',
            };
        }
    }

    // 4. Two Scales (Scatter)
    if (primaryRowVar?.type === 'numeric' && colVar?.type === 'numeric') {
        return {
            default: 'scatter',
            // Note: hexbin requires raw (x,y) pairs, currently backend aggregates
            alternatives: [],
            reason: 'Exploring relationship between two numeric variables.',
        };
    }

    // 4. Single Variable Analysis
    if (primaryRowVar) {
        switch (primaryRowVar.type) {
            case 'nominal':
                return {
                    default: 'horizontal-bar',
                    alternatives: ['vertical-bar', 'donut'],
                    reason: 'Nominal data is best viewed as a ranked list.',
                };
            case 'ordinal':
                return {
                    default: 'horizontal-bar',
                    alternatives: ['stacked-bar', 'vertical-bar'], // Diverging bar removed for single ordinal
                    reason: 'Ordinal data can be viewed as bars or distributions.',
                };
            case 'scale':
                return {
                    default: 'diverging-bar',
                    alternatives: ['stacked-bar', 'vertical-bar', 'horizontal-bar'],
                    reason: 'Scale data (Likert/Ratings) is best viewed as diverging bars.',
                };
            case 'numeric':
                return {
                    default: 'histogram',
                    alternatives: ['box-plot'],
                    reason: 'Numeric variables show distribution.',
                };
        }
    }

    // Fallback
    return {
        default: 'horizontal-bar',
        alternatives: [],
        reason: 'Default fallback.',
    };
}
