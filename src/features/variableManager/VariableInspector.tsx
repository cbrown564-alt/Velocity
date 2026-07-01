/**
 * VariableInspector Component
 *
 * Column 5 in the Miller Column navigation.
 * Displays full metadata and distribution for the selected variable.
 * Shows real distribution data from DuckDB queries.
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { Info, MousePointerClick } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { Variable } from '../../types/dataset';
import type { VariableStatsResult } from '../../types/worker';
import type { BarDatum, BinData } from '../../types/charts';
import { allowsNumericStats, normalizeVariableType } from '../../types';
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
  const dataset = useVelocityStore((state) => state.dataset);
  const selectedVariableId = useVelocityStore((state) => state.selectedVariableId);
  const getVariableStats = useVelocityStore((state) => state.getVariableStats);
  const variableStats = useVelocityStore((state) => state.variableStats);
  const variableStatsLoading = useVelocityStore((state) => state.variableStatsLoading);
  const recodeVariable = useVelocityStore((state) => state.recodeVariable);
  const deleteGroupedVariable = useVelocityStore((state) => state.deleteGroupedVariable);
  const splitGroupValue = useVelocityStore((state) => state.splitGroupValue);
  const getUniqueValues = useVelocityStore((state) => state.getUniqueValues);
  const setSelectedVariableId = useVelocityStore((state) => state.setSelectedVariableId);
  const transformLog = useVelocityStore((state) => state.transformLog);

  // Context menu state for chart interactions
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    position: { x: 0, y: 0 },
    selected: [],
  });

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
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
    return dataset.variables.find((v) => v.id === selectedVariableId) || null;
  }, [selectedVariableId, dataset]);

  // Get stats for the selected variable
  const stats: VariableStatsResult | null = selectedVariableId ? variableStats[selectedVariableId] || null : null;
  const isLoadingStats = selectedVariableId ? variableStatsLoading[selectedVariableId] || false : false;

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
      getVariableStats(selectedVariableId).catch((err) => {
        console.warn('[VariableInspector] Failed to fetch stats:', err);
      });
    }
  }, [selectedVariableId, stats, isLoadingStats, getVariableStats, variable?.type, variable?.orderedScoring]);

  // Histogram rendering should be reserved for true numeric variables only.
  const isNumericVariable = normalizeVariableType(variable?.type) === 'numeric';

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
      const isBinData = contextMenu.selected.some((d) => d.originalBin); // Check for marker we added

      if (isBinData) {
        setPendingBinSelection(contextMenu.selected.map((d) => d.originalBin)); // Extract original bins
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
  const handleGroupNameSubmit = useCallback(
    async (groupName: string) => {
      if (!variable) return;

      // Check if this is a binning recode (from histogram) or categorical (from bar chart)
      const isBinning = pendingBinSelection.length > 0;

      if (!isBinning && pendingGroupSelection.length === 0) return;

      setIsCreatingRecode(true);
      try {
        let newVarId: string | null = null;

        if (isBinning) {
          // Create binning recode from histogram bins
          // Sort bins by x0 to ensure proper ordering
          const sortedBins = [...pendingBinSelection].sort((a, b) => a.x0 - b.x0);
          const minVal = sortedBins[0].x0;
          const maxVal = sortedBins[sortedBins.length - 1].x1;

          const rules = [
            {
              min: minVal,
              max: maxVal,
              label: groupName,
            },
          ];

          const newVarName = `${variable.name}_binned`;
          newVarId = await recodeVariable(variable.id, newVarName, {
            mode: 'binning',
            rules,
          });

          setPendingBinSelection([]);
        } else {
          // Categorical recode from bar chart
          const allValues = await getUniqueValues(variable.id);

          const mappings: Record<string, string> = {};
          const selectedCodes = new Set(pendingGroupSelection.map((d) => String(d.code)));

          for (const val of allValues) {
            if (selectedCodes.has(String(val))) {
              mappings[val] = groupName;
            } else {
              // Preserve existing label so unmapped values don't revert to raw codes
              const existingLabel = variable.valueLabels?.find((vl) => String(vl.value) === String(val))?.label;
              mappings[val] = existingLabel ?? String(val);
            }
          }

          const newVarName = `${variable.name}_grouped`;
          newVarId = await recodeVariable(variable.id, newVarName, {
            mode: 'categorical',
            mappings,
          });

          setPendingGroupSelection([]);
        }

        // Switch the inspector to the newly created variable so the user
        // can immediately see it without having to hunt for it in the list.
        if (newVarId) {
          setSelectedVariableId(newVarId);
        }
      } catch (error) {
        console.error('[VariableInspector] Failed to create recode:', error);
      } finally {
        setIsCreatingRecode(false);
      }
    },
    [variable, pendingGroupSelection, pendingBinSelection, getUniqueValues, recodeVariable, setSelectedVariableId],
  );

  // Detect whether the currently-selected variable is a grouped (derived) variable
  const activeTransform = useMemo(
    () => (variable ? transformLog.find((t) => t.newColId === variable.id) : undefined),
    [variable, transformLog],
  );
  const isGroupedVariable = Boolean(activeTransform);

  // Returns true if a label maps to more than one source code (i.e. is genuinely grouped)
  const isGroupedValue = useCallback(
    (label: string): boolean => {
      if (!activeTransform?.config.mappings) return false;
      return Object.values(activeTransform.config.mappings).filter((v) => v === label).length > 1;
    },
    [activeTransform],
  );

  const handleDeleteGroup = useCallback(async () => {
    if (!variable || !activeTransform) return;
    closeContextMenu();
    try {
      await deleteGroupedVariable(variable.id);
    } catch (err) {
      console.error('[VariableInspector] Failed to delete grouped variable:', err);
    }
  }, [variable, activeTransform, deleteGroupedVariable, closeContextMenu]);

  const handleSplitGroup = useCallback(
    async (groupValue: string) => {
      if (!variable || !activeTransform) return;
      closeContextMenu();
      try {
        await splitGroupValue(variable.id, groupValue);
      } catch (err) {
        console.error('[VariableInspector] Failed to split group value:', err);
      }
    },
    [variable, activeTransform, splitGroupValue, closeContextMenu],
  );

  // If no variable selected, show empty state
  if (!variable) {
    return (
      <div className={`${styles.inspector} ${className || ''}`} data-testid="variable-inspector-empty">
        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrap}>
            <MousePointerClick className={styles.emptyIcon} aria-hidden />
          </div>
          <h3 className={styles.emptyTitle}>Select a variable</h3>
          <p className={styles.emptyText}>
            Click any variable in the list to inspect its distribution, value labels, and recoding options.
          </p>
          <p className={styles.emptyHint}>
            <Info size={14} aria-hidden />
            <span>Tip: press D to open Variable Manager from the analysis canvas.</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.inspector} ${className || ''}`}>
      {/* Header */}
      <InspectorHeader variable={variable} stats={stats} isLoadingStats={isLoadingStats} />

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
        title={
          contextMenu.selected.length === 1 && contextMenu.selected[0].label
            ? contextMenu.selected[0].label
            : `${contextMenu.selected.length} items selected`
        }
        subtitle={contextMenu.selected.length > 1 ? 'Multiple values' : undefined}
        options={[
          {
            label: contextMenu.selected.length > 1 ? 'Group these values' : 'Create group from this value',
            onClick: handleCreateGroup,
          },
          ...(isGroupedVariable
            ? [
                {
                  label: 'Delete group variable',
                  onClick: handleDeleteGroup,
                  danger: true as const,
                },
              ]
            : []),
          ...(isGroupedVariable && contextMenu.selected.length === 1 && isGroupedValue(contextMenu.selected[0]?.label)
            ? [
                {
                  label: `Split "${contextMenu.selected[0].label}" back to original values`,
                  onClick: () => handleSplitGroup(contextMenu.selected[0].label),
                },
              ]
            : []),
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
