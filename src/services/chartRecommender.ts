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
            default: 'stacked-bar',
            alternatives: ['grouped-bar', 'stacked-bar-100'],
            reason: 'Grid variables show composition across statements.',
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
            return {
                default: 'grouped-bar',
                alternatives: ['stacked-bar-100', 'stacked-bar'],
                reason: 'Comparing nominal/ordinal groups across columns.',
            };
        }
        // Scale x Nominal (e.g. Age by Gender) -> Box Plot
        if (primaryRowVar?.type === 'scale') {
            return {
                default: 'grouped-box-plot',
                alternatives: ['violin', 'ridgeline'],
                reason: 'Comparing distributions across groups.',
            };
        }
    }

    // 4. Two Scales (Scatter)
    if (primaryRowVar?.type === 'scale' && colVar?.type === 'scale') {
        return {
            default: 'scatter',
            alternatives: ['hexbin'],
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
                    default: 'horizontal-bar', // TODO: Identify if it should be diverging
                    alternatives: ['vertical-bar', 'diverging-bar'],
                    reason: 'Ordinal data preserves order.',
                };
            case 'scale':
                return {
                    default: 'histogram',
                    alternatives: ['box-plot'],
                    reason: 'Scale variables show distribution.',
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
