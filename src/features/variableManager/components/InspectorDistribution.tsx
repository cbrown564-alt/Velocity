import React, { useMemo, useRef } from 'react';
import type { Variable } from '../../../store/slices/dataSlice';
import type { VariableStatsResult } from '../../../types/worker';
import { isOrderedType, normalizeVariableType } from '../../../types';
import { HorizontalBarRenderer, HistogramRenderer, VerticalBarRenderer } from '../../../components/charts/renderers';
import { useResizeObserver } from '../../../hooks/useResizeObserver';
import styles from '../VariableInspector.module.css';

interface InspectorDistributionProps {
    variable: Variable;
    stats: VariableStatsResult | null;
    isNumericVariable: boolean;
    selectedKeys: Set<string>;
    setSelectedKeys: (keys: Set<string>) => void;
    onContextMenu: (event: { selected: any[]; position: { x: number; y: number } }) => void;
    hoveredKey?: string | null;
    onHoverChange?: (key: string | null) => void;
}

export const InspectorDistribution: React.FC<InspectorDistributionProps> = ({
    variable,
    stats,
    isNumericVariable,
    selectedKeys,
    setSelectedKeys,
    onContextMenu,
    hoveredKey,
    onHoverChange
}) => {
    // Responsive chart width
    const containerRef = useRef<HTMLDivElement>(null);
    const { width: containerWidth } = useResizeObserver(containerRef);
    const chartWidth = Math.max(280, containerWidth); // section has no horizontal padding

    const isMissingValue = (value: number | string | null): boolean => {
        if (value === null) return true;
        if (!variable?.missingValues) return false;
        const numericValue = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(numericValue)) {
            if (variable.missingValues.discrete?.includes(numericValue)) return true;
            if (variable.missingValues.range) {
                const low = Math.min(variable.missingValues.range.low, variable.missingValues.range.high);
                const high = Math.max(variable.missingValues.range.low, variable.missingValues.range.high);
                if (numericValue >= low && numericValue <= high) return true;
            }
        }
        return false;
    };

    // Prepare data for Nominal/Ordinal Charts (HorizontalBarRenderer)
    const nominalChartData = useMemo(() => {
        if (!stats || !variable || isNumericVariable) return null;
        const hasValueLabels = variable.valueLabels && variable.valueLabels.length > 0;
        const validBase = Math.max(0, (stats.totalCount || 0) - (stats.missingCount || 0));

        // Sort data based on variable type
        const sortedFrequencies = stats.frequencies.filter((freq) => !isMissingValue(freq.value));
        if (isOrderedType(variable.type) || normalizeVariableType(variable.type as any) === 'numeric') {
            // For ordinal/scale, sort by value (code) to preserve natural order
            sortedFrequencies.sort((a, b) => {
                if (typeof a.value === 'number' && typeof b.value === 'number') return a.value - b.value;
                return String(a.value).localeCompare(String(b.value));
            });
        } else {
            // For nominal/other, sort by count descending (most frequent first)
            sortedFrequencies.sort((a, b) => b.count - a.count);
        }

        const data = sortedFrequencies.map((freq) => {
            const label = hasValueLabels
                ? variable.valueLabels.find(vl => vl.value === freq.value)?.label || String(freq.value)
                : String(freq.value);

            return {
                label,
                value: freq.count,
                percent: validBase > 0 ? (freq.count / validBase) * 100 : 0,
                code: freq.value,
                isMissing: false,
            };
        });

        return {
            series: [{
                id: 'default',
                label: 'Count',
                data,
            }],
        } as any;
    }, [stats, variable, isNumericVariable]);

    const nominalItemCount = nominalChartData?.series?.[0]?.data?.length ?? 0;
    const useColumnChart = !isNumericVariable && nominalItemCount > 5;

    // Prepare data for Histogram (HistogramRenderer)
    const histogramData = useMemo(() => {
        const numericStats = stats?.numeric;
        if (!numericStats || !variable || !isNumericVariable) return null;
        const validBase = Math.max(0, (stats?.totalCount || 0) - (stats?.missingCount || 0));

        const data = numericStats.histogramBins.map(bin => {
            return {
                label: `${bin.x0} - ${bin.x1}`,
                value: bin.count,
                percent: validBase > 0 ? (bin.count / validBase) * 100 : 0,
                rawValue: String(bin.x0),
                originalBin: bin,
                isMissing: false
            };
        });

        return {
            rows: data,
            series: [{
                id: 'default',
                label: 'Frequency',
                data
            }]
        } as any;
    }, [stats, variable, isNumericVariable]);


    if ((!nominalChartData && !histogramData) || !variable) return null;

    return (
        <div className={styles.chartSection} ref={containerRef}>
            <h3 className={styles.chartSectionTitle}>
                Distribution
                {!isNumericVariable && (
                    <span style={{
                        fontSize: '10px',
                        color: 'var(--text-tertiary)',
                        fontWeight: 400,
                        textTransform: 'none',
                        letterSpacing: 'normal',
                        fontStyle: 'italic'
                    }}>
                        (drag to select, right-click to group)
                    </span>
                )}
            </h3>
            {/* Rendering logic */}
            {isNumericVariable && histogramData ? (
                <div style={{ width: '100%', minHeight: 180 }}>
                    <HistogramRenderer
                        width={chartWidth}
                        height={180}
                        processedData={histogramData}
                        interactive={true}
                        variableStats={stats} // Pass stats for optimized bin rendering
                        onContextMenu={onContextMenu}
                        hoveredKey={hoveredKey}
                        onHoverChange={onHoverChange}
                    />
                </div>
            ) : nominalChartData ? (
                <div style={{ width: '100%' }}>
                    {useColumnChart ? (
                        <VerticalBarRenderer
                            width={chartWidth}
                            height={220}
                            processedData={nominalChartData}
                            interactive={true}
                            selectedKeys={selectedKeys}
                            onSelectionChange={setSelectedKeys}
                            onContextMenu={onContextMenu}
                        />
                    ) : (
                        <HorizontalBarRenderer
                            width={chartWidth}
                            height={Math.max(180, nominalChartData.series[0].data.length * 28)}
                            processedData={nominalChartData}
                            interactive={true}
                            selectedKeys={selectedKeys}
                            onSelectionChange={setSelectedKeys}
                            onContextMenu={onContextMenu}
                            hoveredKey={hoveredKey}
                            onHoverChange={onHoverChange}
                        />
                    )}
                </div>
            ) : null}
        </div>
    );
};
