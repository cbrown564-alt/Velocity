import React, { useMemo, useRef } from 'react';
import type { Variable } from '../../../store/slices/dataSlice';
import type { VariableStatsResult } from '../../../types/worker';
import { HorizontalBarRenderer, HistogramRenderer } from '../../../components/charts/renderers';
import { useResizeObserver } from '../../../hooks/useResizeObserver';
import styles from '../VariableInspector.module.css';

interface InspectorDistributionProps {
    variable: Variable;
    stats: VariableStatsResult | null;
    isNumericVariable: boolean;
    selectedKeys: Set<string>;
    setSelectedKeys: (keys: Set<string>) => void;
    onContextMenu: (event: { selected: any[]; position: { x: number; y: number } }) => void;
}

export const InspectorDistribution: React.FC<InspectorDistributionProps> = ({
    variable,
    stats,
    isNumericVariable,
    selectedKeys,
    setSelectedKeys,
    onContextMenu
}) => {
    // Responsive chart width
    const containerRef = useRef<HTMLDivElement>(null);
    const { width: containerWidth } = useResizeObserver(containerRef);
    const chartWidth = Math.max(280, containerWidth - 32); // Subtract padding

    // Prepare data for Nominal/Ordinal Charts (HorizontalBarRenderer)
    const nominalChartData = useMemo(() => {
        if (!stats || !variable || isNumericVariable) return null;
        const hasValueLabels = variable.valueLabels && variable.valueLabels.length > 0;

        // Sort data based on variable type
        const sortedFrequencies = [...stats.frequencies];
        if (variable.type === 'ordinal' || variable.type === 'scale') {
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
                percent: (freq.count / stats.totalCount) * 100,
                code: freq.value,
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

    // Prepare data for Histogram (HistogramRenderer)
    const histogramData = useMemo(() => {
        const numericStats = stats?.numeric;
        if (!numericStats || !variable || !isNumericVariable) return null;

        const data = numericStats.histogramBins.map(bin => ({
            label: `${bin.x0} - ${bin.x1}`,
            value: bin.count,
            percent: (bin.count / (stats?.totalCount || 1)) * 100,
            rawValue: String(bin.x0),
            originalBin: bin
        }));

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
        <div className={styles.section} ref={containerRef}>
            <h3 className={styles.sectionTitle}>
                Distribution
                <span style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--gray-400)',
                    fontWeight: 400,
                    marginLeft: 'var(--space-2)',
                }}>
                    (drag to select, right-click to group)
                </span>
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
                    />
                </div>
            ) : nominalChartData ? (
                <div style={{ width: '100%' }}>
                    <HorizontalBarRenderer
                        width={chartWidth}
                        height={Math.max(180, nominalChartData.series[0].data.length * 28)}
                        processedData={nominalChartData}
                        interactive={true}
                        selectedKeys={selectedKeys}
                        onSelectionChange={setSelectedKeys}
                        onContextMenu={onContextMenu}
                    />
                </div>
            ) : null}
        </div>
    );
};
