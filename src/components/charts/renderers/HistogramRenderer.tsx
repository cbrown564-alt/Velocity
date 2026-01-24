import React, { useMemo } from 'react';
import { BaseChartRendererProps } from '../../../types/charts';
import { D3Histogram, BinData } from '../D3Histogram';

/**
 * Histogram Renderer Adapter
 * Adapts the generic ProcessedAnalysisData to the specific format required by D3Histogram.
 * Assumes that processedData.rows represent the bins.
 */
export const HistogramRenderer: React.FC<BaseChartRendererProps> = ({
    width,
    height,
    colors,
    processedData,
    interactive,
}) => {
    const { rows } = processedData;

    // Convert ProcessedRows to BinData
    const bins = useMemo((): BinData[] => {
        return rows.map((row, i) => {
            const count = row.total;
            let x0 = 0;
            let x1 = 1;

            // Try to parse range from label (e.g. "10 - 20")
            const rangeMatch = row.label.match(/([\d\.]+)\s*-\s*([\d\.]+)/);
            if (rangeMatch) {
                x0 = parseFloat(rangeMatch[1]);
                x1 = parseFloat(rangeMatch[2]);
            } else {
                // Fallback: assume rawValue is the start or center
                const val = parseFloat(row.rawValue);
                if (!isNaN(val)) {
                    x0 = val;
                    // Try to guess width from next row or reasonable default
                    const nextRow = rows[i + 1];
                    const nextVal = nextRow ? parseFloat(nextRow.rawValue) : NaN;

                    if (!isNaN(nextVal)) {
                        x1 = nextVal;
                    } else {
                        // Estimate from previous
                        const prevRow = rows[i - 1];
                        const prevVal = prevRow ? parseFloat(prevRow.rawValue) : NaN;
                        if (!isNaN(prevVal)) {
                            const diff = x0 - prevVal;
                            x1 = x0 + diff;
                        } else {
                            x1 = x0 + 1; // Arbitrary 1-unit width
                        }
                    }
                }
            }

            return {
                x0,
                x1,
                count,
                selected: false // Selection state management could be added here
            };
        });
    }, [rows]);

    return (
        <D3Histogram
            width={width}
            height={height}
            precomputedBins={bins}
            color={colors ? colors[0] : undefined}
            className="overflow-visible"
        />
    );
};
