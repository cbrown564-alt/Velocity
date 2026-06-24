import { Variable } from '../../types';
import { isCategoricalType, isOrderedType, normalizeVariableType } from '../../types';
import { ChartRecommendation, ChartType } from '../../types/charts';
import type { MeasurementIntent } from '../../types/semantic';

interface RecommenderContext {
    rowVars: Variable[];
    colVar: Variable | null;
    /** The variable set structure (e.g., is it a Grid?) */
    isGrid?: boolean;
    /** Are we looking at a Multiple Response set? */
    isMultiResponse?: boolean;
    /** Phase 4: Semantic context for smarter recommendations */
    semanticIntent?: MeasurementIntent;
    semanticTopic?: string;
    temporalRole?: 'wave_id' | 'timestamp' | 'period' | null;
}

/**
 * Determines the best chart type for a given data configuration.
 * Follows the rules defined in arch_05_visualisation_engine.md.
 */
export function recommendChart(context: RecommenderContext): ChartRecommendation {
    const { rowVars, colVar, isGrid, isMultiResponse, semanticIntent, semanticTopic, temporalRole } = context;
    const primaryRowVar = rowVars[0];

    // Phase 4: Semantic overrides — apply before structural rules
    // NPS → prefer a dedicated horizontal-bar (NPS bands: Detractors/Passives/Promoters)
    if (semanticTopic === 'nps') {
        return {
            default: 'horizontal-bar',
            alternatives: ['stacked-bar', 'vertical-bar'],
            reason: 'NPS data is best visualized as a promoter/passive/detractor breakdown.',
        };
    }

    // Attitude + temporal (wave/period) → line chart for trend
    if (semanticIntent === 'attitude' && temporalRole != null) {
        return {
            default: 'horizontal-bar',
            alternatives: ['diverging-bar', 'stacked-bar'],
            reason: 'Attitude over time is best shown as a trend or wave comparison.',
        };
    }

    // Demographic breakdown with attitude → grouped-bar for clarity
    if (semanticIntent === 'demographic' && colVar?.semantic?.measurementIntent === 'attitude') {
        return {
            default: 'grouped-bar',
            alternatives: ['grouped-column', 'stacked-bar'],
            reason: 'Demographic breakdown of attitude scale.',
        };
    }

    // 1. Grid (Multiple Statements)
    // Detected via synthetic variables (Source Grid ID present)
    const isSyntheticGrid = primaryRowVar?.synthetic && primaryRowVar?.sourceGridId && colVar?.synthetic && colVar?.sourceGridId;

    if (isSyntheticGrid || isGrid) { // Keep isGrid for backward compatibility during migration
        if (primaryRowVar?.type === 'numeric') {
            return {
                default: 'grouped-box-plot',
                alternatives: ['violin', 'ridgeline', 'box-plot'],
                reason: 'Numeric grids are best viewed as distribution comparisons.',
            };
        }

        return {
            default: 'diverging-bar',
            alternatives: ['grouped-bar', 'grouped-column'],
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

    // 3. Two Scales (Scatter)
    if (primaryRowVar?.type === 'numeric' && colVar?.type === 'numeric') {
        return {
            default: 'scatter',
            // Note: hexbin requires raw (x,y) pairs, currently backend aggregates
            alternatives: ['hexbin'],
            reason: 'Exploring relationship between two numeric variables.',
        };
    }

    // 4. Numeric vs Categorical (Distributions)
    // Symmetric: Numeric in Rows OR Numeric in Column
    if (colVar) {
        const hasNumeric = primaryRowVar?.type === 'numeric' || colVar.type === 'numeric';
        const hasCategorical = (primaryRowVar ? (isCategoricalType(primaryRowVar.type) || isOrderedType(primaryRowVar.type)) : false) ||
            (isCategoricalType(colVar.type) || isOrderedType(colVar.type));

        if (hasNumeric && hasCategorical) {
            return {
                default: 'grouped-box-plot',
                alternatives: ['violin', 'ridgeline'],
                reason: 'Comparing distributions across groups.',
            };
        }
    }

    // 5. Categorical vs Categorical (Cross-Tab)
    if (colVar) {
        // If we have a column variable, we are comparing groups
        if (primaryRowVar && (isCategoricalType(primaryRowVar.type) || isOrderedType(primaryRowVar.type))) {
            if (isOrderedType(primaryRowVar.type) && primaryRowVar.orderedStyle === 'rating') {
                return {
                    default: 'diverging-bar',
                    alternatives: ['stacked-bar', 'grouped-bar', 'grouped-column'],
                    reason: 'Comparing rating-scale groups across columns.',
                };
            }
            return {
                default: 'grouped-bar',
                alternatives: ['grouped-column', 'stacked-bar', 'diverging-bar'],
                reason: 'Comparing categorical/ordered groups across columns.',
            };
        }
    }

    // 5. Single Variable Analysis
    if (primaryRowVar) {
        switch (normalizeVariableType(primaryRowVar.type)) {
            case 'categorical':
                return {
                    default: 'horizontal-bar',
                    alternatives: ['vertical-bar', 'donut'],
                    reason: 'Categorical data is best viewed as a ranked list.',
                };
            case 'ordered':
                if (primaryRowVar.orderedStyle === 'sequence') {
                    return {
                        default: 'horizontal-bar',
                        alternatives: ['stacked-bar', 'vertical-bar', 'donut'],
                        reason: 'Ordered sequence data is best viewed as ranked bars.',
                    };
                }
                return {
                    default: 'diverging-bar',
                    alternatives: ['stacked-bar', 'vertical-bar', 'horizontal-bar'],
                    reason: 'Ordered data (e.g. scales) is best viewed as diverging bars.',
                };
            case 'numeric':
                return {
                    default: 'histogram',
                    alternatives: ['box-plot', 'violin'],
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
