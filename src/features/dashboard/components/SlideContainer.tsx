import React from 'react';
import { useVelocityStore } from '../../../store';
import { AnalysisChart } from '../../../components/charts/AnalysisChart';
import { DataTable } from './DataTable';
import { AnalysisChartConfig } from '../../../types/charts';

interface SlideContainerProps {
    className?: string;
}

/**
 * Renders the active slide's layout and content.
 * For Phase 2.5, this primarily supports 'focus' mode (single cell).
 */
export const SlideContainer: React.FC<SlideContainerProps> = ({ className = '' }) => {
    const activeSlideId = useVelocityStore((state) => state.activeSlideId);
    const slides = useVelocityStore((state) => state.slides);
    const activeSlide = slides.find((s) => s.id === activeSlideId);

    // Data access
    const chartData = useVelocityStore((state) => state.queryResult);
    const tableConfig = useVelocityStore((state) => state.tableConfig);
    const variableSets = useVelocityStore((state) => state.variableSets);
    const viewMode = useVelocityStore((state) => state.viewMode);

    // Resolve variable objects for DataTable
    const rowVariables = tableConfig.rowVars
        .map(id => variableSets.find(vs => vs.id === id)) // Assuming variableSets mostly match
        .filter(Boolean) as any[]; // Need actual Variable[] 
    // Simplified for MVP: forcing type or skipping

    // Actually DataTable wants Variable[], not VariableSet[].
    // We need to map from ID to Variable.
    // This logic should be in a selector or helper.
    // For now, let's just make it compilable.
    const allVariables = useVelocityStore(state => state.dataset?.variables || []);
    const getVars = (ids: string[]) => ids.map(id => allVariables.find(v => v.id === id)).filter(Boolean) as any[];

    const resolvedRowVars = getVars(tableConfig.rowVars);
    const resolvedColVar = tableConfig.colVar ? getVars([tableConfig.colVar])[0] : null;

    if (!activeSlide) {
        return <div className="p-4 text-gray-500">No active slide</div>;
    }

    // Focus mode logic: Render the first cell full screen
    const cell = activeSlide.cells[0];
    if (!cell) {
        return <div className="p-4 text-gray-500">Empty slide</div>;
    }

    const renderCellContent = () => {
        // Use global viewMode for MVP backward compatibility, falling back to cell type
        const contentType = viewMode || cell.content.type;

        switch (contentType) {
            case 'chart':
                // Construct config. In future this comes from the cell state
                const config: AnalysisChartConfig = {
                    type: cell.content.chartType || 'horizontal-bar',
                    enableVisualETL: true
                };
                return (
                    <div className="w-full h-full p-4 bg-white rounded-lg shadow-sm border border-stone-200">
                        <AnalysisChart data={chartData} config={config} />
                    </div>
                );
            case 'table':
                // Render legacy table - assuming it handles its own data fetching for now
                // In future, we pass props
                return (
                    <div className="w-full h-full bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
                        {/* 
                         We pass a special prop or context to tell DataTable to fit this container 
                         if needed, but for now standard render is fine.
                       */}
                        <DataTable
                            data={chartData}
                            rowVariables={resolvedRowVars}
                            colVariable={resolvedColVar}
                            totalCount={0} // TODO: Get total count from store
                        />
                    </div>
                );
            default:
                return <div>Unknown content type</div>;
        }
    };

    return (
        <div className={`flex-1 flex flex-col h-full bg-stone-50 ${className}`}>
            {/* Slide Header (Title) could go here */}
            <div className="flex-1 overflow-hidden p-4">
                {renderCellContent()}
            </div>
        </div>
    );
};
