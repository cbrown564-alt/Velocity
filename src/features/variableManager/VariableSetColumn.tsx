/**
 * VariableSetColumn Component
 *
 * Column 3 in the Miller Column navigation.
 * Displays variable sets filtered by the active folder.
 * Supports single-click navigation and multi-select for bulk operations.
 */

import React, { useMemo } from 'react';
import { Hash, Tag, BarChart2, Grid3X3, ChevronRight, EyeOff } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { VariableSet } from '../../store/slices/dataSlice';
import styles from './MillerColumns.module.css';

interface VariableSetItemProps {
    variableSet: VariableSet;
    isActive: boolean;
    isSelected: boolean;
    onClick: (e: React.MouseEvent) => void;
}

const getTypeIcon = (type?: string) => {
    switch (type) {
        case 'nominal':
            return <Tag size={14} />;
        case 'ordinal':
            return <BarChart2 size={14} />;
        case 'scale':
            return <Hash size={14} />;
        default:
            return <Tag size={14} />;
    }
};

const getStructureLabel = (structure: string, count: number) => {
    if (structure === 'single' || count === 1) return null;
    if (structure === 'multi') return `${count} items`;
    if (structure === 'grid') return `${count} cols`;
    return null;
};

const VariableSetItem: React.FC<VariableSetItemProps> = ({
    variableSet,
    isActive,
    isSelected,
    onClick,
}) => {
    const varCount = variableSet.variableIds.length;
    const structureLabel = getStructureLabel(variableSet.structure, varCount);

    return (
        <div
            onClick={onClick}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
            style={{
                backgroundColor: isSelected && !isActive ? 'var(--gray-200)' : undefined,
            }}
        >
            <div className={styles.itemContent}>
                <span className={styles.itemIcon}>
                    {variableSet.structure === 'grid' ? (
                        <Grid3X3 size={14} />
                    ) : (
                        getTypeIcon(variableSet.type)
                    )}
                </span>
                <span className={styles.itemLabel}>
                    {variableSet.name}
                    {variableSet.hidden && (
                        <EyeOff
                            size={12}
                            style={{
                                marginLeft: 6,
                                opacity: 0.5,
                                verticalAlign: 'middle',
                            }}
                        />
                    )}
                </span>
            </div>
            <div className={styles.itemMeta}>
                {structureLabel && (
                    <span className={styles.itemCount}>{structureLabel}</span>
                )}
                <ChevronRight className={styles.itemChevron} size={14} />
            </div>
        </div>
    );
};

export const VariableSetColumn: React.FC = () => {
    const {
        dataset,
        variableSets,
        activeFolderId,
        searchQuery,
        selectedVariableSetId,
        selectedVariableSetIds,
        setSelectedVariableSetId,
        setSelectedVariableId,
        toggleVariableSetSelection,
        selectVariableSetRange,
    } = useVelocityStore();

    // Filter variable sets by folder and search
    const filteredSets = useMemo(() => {
        let sets = variableSets;

        // Filter by folder
        if (activeFolderId === 'ungrouped') {
            sets = sets.filter(vs => !vs.folderId);
        } else if (activeFolderId && activeFolderId !== null) {
            sets = sets.filter(vs => vs.folderId === activeFolderId);
        }

        // Filter by search
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            sets = sets.filter(vs => vs.name.toLowerCase().includes(query));
        }

        return sets;
    }, [variableSets, activeFolderId, searchQuery]);

    const filteredIds = useMemo(() => filteredSets.map(vs => vs.id), [filteredSets]);

    const handleClick = (variableSet: VariableSet, e: React.MouseEvent) => {
        // Handle bulk selection with modifier keys
        if (e.shiftKey) {
            selectVariableSetRange(variableSet.id, filteredIds);
            return;
        }

        if (e.metaKey || e.ctrlKey) {
            toggleVariableSetSelection(variableSet.id, true);
            return;
        }

        // Single click - Miller column navigation
        setSelectedVariableSetId(variableSet.id);

        // Smart column skip: if single-variable set, auto-select the variable
        if (variableSet.variableIds.length === 1) {
            setSelectedVariableId(variableSet.variableIds[0]);
        }
    };

    if (!dataset) {
        return (
            <div className={`${styles.column} ${styles.col3}`}>
                <div className={styles.columnHeader}>
                    <span className={styles.columnTitle}>Variable Sets</span>
                </div>
                <div className={styles.emptyState}>
                    <Tag className={styles.emptyIcon} />
                    <span className={styles.emptyText}>No data loaded</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.column} ${styles.col3}`}>
            <div className={styles.columnHeader}>
                <span className={styles.columnTitle}>Variable Sets</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                    {filteredSets.length}
                </span>
            </div>

            <div className={styles.columnContent}>
                {filteredSets.length > 0 ? (
                    filteredSets.map(vs => (
                        <VariableSetItem
                            key={vs.id}
                            variableSet={vs}
                            isActive={selectedVariableSetId === vs.id}
                            isSelected={selectedVariableSetIds.includes(vs.id)}
                            onClick={(e) => handleClick(vs, e)}
                        />
                    ))
                ) : (
                    <div className={styles.emptyState}>
                        <Tag className={styles.emptyIcon} />
                        <span className={styles.emptyText}>
                            {searchQuery ? 'No matching variables' : 'No variables in folder'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
