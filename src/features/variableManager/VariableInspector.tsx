/**
 * VariableInspector Component
 *
 * Column 5 in the Miller Column navigation.
 * Displays full metadata and distribution for the selected variable.
 * Shows real distribution data from DuckDB queries.
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Info } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { Variable } from '../../store/slices/dataSlice';
import type { VariableStatsResult } from '../../types/worker';
import type { BarDatum, BinData } from '../../types/charts';
import { allowsNumericStats } from '../../types';
import { ChartContextMenu } from '../../components/overlays/ChartContextMenu';
import { InputModal } from '../../components/overlays/InputModal';
import styles from './VariableInspector.module.css';

// Sub-components
import { InspectorHeader } from './components/InspectorHeader';
import { InspectorStats } from './components/InspectorStats';
import { InspectorDistribution } from './components/InspectorDistribution';

interface VariableInspectorProps {
    className?: string;
}

// Context menu state for chart interactions
interface ContextMenuState {
    isOpen: boolean;
    position: { x: number; y: number };
    selected: any[]; // Allow generic items (BarDatum or BinData with metadata)
}

export const VariableInspector: React.FC<VariableInspectorProps> = ({ className }) => {
    const {
        dataset,
        selectedVariableId,
        getVariableStats,
        variableStats,
        variableStatsLoading,
        recodeVariable,
        getUniqueValues,
    } = useVelocityStore();

    // Context menu state for chart interactions
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        isOpen: false,
        position: { x: 0, y: 0 },
        selected: [],
    });

    // Close context menu
    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, isOpen: false }));
    }, []);

    // State for group name input modal
    const [showGroupNameModal, setShowGroupNameModal] = useState(false);
    const [pendingGroupSelection, setPendingGroupSelection] = useState<BarDatum[]>([]);
    const [pendingBinSelection, setPendingBinSelection] = useState<BinData[]>([]);
    const [isCreatingRecode, setIsCreatingRecode] = useState(false);

    // State for chart selection
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    // State for cross-highlighting
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);

    // Get the selected variable
    const variable = useMemo((): Variable | null => {
        if (!selectedVariableId || !dataset) return null;
        return dataset.variables.find(v => v.id === selectedVariableId) || null;
    }, [selectedVariableId, dataset]);

    // Get stats for the selected variable
    const stats: VariableStatsResult | null = selectedVariableId
        ? variableStats[selectedVariableId] || null
        : null;
    const isLoadingStats = selectedVariableId
        ? variableStatsLoading[selectedVariableId] || false
        : false;

    // Reset selection when variable changes
    useEffect(() => {
        setSelectedKeys(new Set());
    }, [selectedVariableId]);

    // Fetch stats when variable is selected
    useEffect(() => {
        if (!selectedVariableId || isLoadingStats) return;

        const needsStats = !stats;
        const needsNumericStats = allowsNumericStats(variable?.type, variable?.orderedScoring) && stats && !stats.numeric;

        if (needsStats || needsNumericStats) {
            getVariableStats(selectedVariableId).catch(err => {
                console.warn('[VariableInspector] Failed to fetch stats:', err);
            });
        }
    }, [selectedVariableId, stats, isLoadingStats, getVariableStats, variable?.type, variable?.orderedScoring]);

    // Check if variable is numeric/numeric type
    const isNumericVariable = allowsNumericStats(variable?.type, variable?.orderedScoring);

    // Handle generic chart context menu
    const handleContextMenu = useCallback((event: { selected: any[]; position: { x: number; y: number } }) => {
        if (event.selected.length === 0) return;

        setContextMenu({
            isOpen: true,
            position: event.position,
            selected: event.selected,
        });
    }, []);

    // Handle context menu actions - show modal to get group name
    const handleCreateGroup = useCallback(() => {
        if (contextMenu.selected.length > 0 && variable) {
            // Determine if we are grouping bins (histogram) or categories (bar) based on data shape
            const isBinData = contextMenu.selected.some(d => d.originalBin); // Check for marker we added

            if (isBinData) {
                setPendingBinSelection(contextMenu.selected.map(d => d.originalBin)); // Extract original bins
                setPendingGroupSelection([]);
            } else {
                setPendingGroupSelection([...contextMenu.selected]);
                setPendingBinSelection([]);
            }
            setShowGroupNameModal(true);
        }
        closeContextMenu();
    }, [contextMenu.selected, variable, closeContextMenu]);

    // Handle group name submission - create the recode
    const handleGroupNameSubmit = useCallback(async (groupName: string) => {
        if (!variable) return;

        // Check if this is a binning recode (from histogram) or categorical (from bar chart)
        const isBinning = pendingBinSelection.length > 0;

        if (!isBinning && pendingGroupSelection.length === 0) return;

        setIsCreatingRecode(true);
        try {
            if (isBinning) {
                // Create binning recode from histogram bins
                // Sort bins by x0 to ensure proper ordering
                const sortedBins = [...pendingBinSelection].sort((a, b) => a.x0 - b.x0);
                const minVal = sortedBins[0].x0;
                const maxVal = sortedBins[sortedBins.length - 1].x1;

                const rules = [{
                    min: minVal,
                    max: maxVal,
                    label: groupName,
                }];

                const newVarName = `${variable.name}_binned`;
                await recodeVariable(variable.id, newVarName, {
                    mode: 'binning',
                    rules,
                });

                console.log('[VariableInspector] Created binning recode:', {
                    source: variable.name,
                    newVar: newVarName,
                    groupName,
                    range: `${minVal} - ${maxVal}`,
                });

                setPendingBinSelection([]);
            } else {
                // Categorical recode from bar chart
                const allValues = await getUniqueValues(variable.id);

                const mappings: Record<string, string> = {};
                const selectedCodes = new Set(pendingGroupSelection.map(d => String(d.code)));

                for (const val of allValues) {
                    if (selectedCodes.has(String(val))) {
                        mappings[val] = groupName;
                    } else {
                        mappings[val] = val;
                    }
                }

                const newVarName = `${variable.name}_grouped`;
                await recodeVariable(variable.id, newVarName, {
                    mode: 'categorical',
                    mappings,
                });

                console.log('[VariableInspector] Created categorical recode:', {
                    source: variable.name,
                    newVar: newVarName,
                    groupName,
                    groupedValues: pendingGroupSelection.map(d => d.label),
                });

                setPendingGroupSelection([]);
            }
        } catch (error) {
            console.error('[VariableInspector] Failed to create recode:', error);
        } finally {
            setIsCreatingRecode(false);
        }
    }, [variable, pendingGroupSelection, pendingBinSelection, getUniqueValues, recodeVariable]);


    // If no variable selected, show empty state
    if (!variable) {
        return (
            <div className={`${styles.inspector} ${className || ''}`}>
                <div className={styles.emptyState}>
                    <Info className={styles.emptyIcon} />
                    <h3 className={styles.emptyTitle}>No Variable Selected</h3>
                    <p className={styles.emptyText}>
                        Select a variable to view its details
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.inspector} ${className || ''}`}>
            {/* Header */}
            <InspectorHeader variable={variable} />

            {/* Content feed: Chart -> Dictionary */}
            <div className={styles.content}>

                {/* 1. Visual Shape (Chart) first for quick scanning */}
                <InspectorDistribution
                    variable={variable}
                    stats={stats}
                    isNumericVariable={isNumericVariable}
                    selectedKeys={selectedKeys}
                    setSelectedKeys={setSelectedKeys}
                    onContextMenu={handleContextMenu}
                    hoveredKey={hoveredKey}
                    onHoverChange={setHoveredKey}
                />

                {/* 2. Simplified Stats and Dictionary */}
                {/* Cross-highlighting is only meaningful for categorical variables
                    (bar chart ↔ table). For numeric variables the histogram uses
                    bin-range keys that never match the table's integer code keys,
                    which would cause all histogram bars to dim on table hover. */}
                <InspectorStats
                    variable={variable}
                    stats={stats}
                    isLoadingStats={isLoadingStats}
                    hoveredKey={isNumericVariable ? undefined : hoveredKey}
                    onHoverChange={isNumericVariable ? undefined : setHoveredKey}
                />
            </div>

            {/* Shared Chart Context Menu */}
            <ChartContextMenu
                isOpen={contextMenu.isOpen}
                position={contextMenu.position}
                title={contextMenu.selected.length === 1 && contextMenu.selected[0].label
                    ? contextMenu.selected[0].label
                    : `${contextMenu.selected.length} items selected`}
                subtitle={contextMenu.selected.length > 1 ? 'Multiple values' : undefined}
                options={[
                    {
                        label: contextMenu.selected.length > 1 ? 'Group these values' : 'Create group from this value',
                        onClick: handleCreateGroup,
                    }
                ]}
                onClose={closeContextMenu}
            />

            {/* Group Name Input Modal */}
            <InputModal
                isOpen={showGroupNameModal}
                onClose={() => {
                    setShowGroupNameModal(false);
                    setPendingGroupSelection([]);
                    setPendingBinSelection([]);
                }}
                onSubmit={handleGroupNameSubmit}
                title="Name this group"
                placeholder="e.g., Low Income, Age 18-34..."
                initialValue=""
                submitLabel={isCreatingRecode ? 'Creating...' : 'Create Group'}
            />
        </div>
    );
};
