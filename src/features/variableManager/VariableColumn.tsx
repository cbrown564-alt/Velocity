/**
 * VariableColumn Component
 *
 * Column 4 in the Miller Column navigation.
 * Displays individual variables within a selected Variable Set.
 * Only shown for multi-variable sets (grids, multi-response).
 */

import React, { useMemo } from 'react';
import { Hash, Tag, BarChart2, ChevronRight } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { Variable } from '../../store/slices/dataSlice';
import styles from './MillerColumns.module.css';

interface VariableItemProps {
    variable: Variable;
    isActive: boolean;
    onClick: () => void;
}

const getTypeIcon = (type: string) => {
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

const VariableItem: React.FC<VariableItemProps> = ({
    variable,
    isActive,
    onClick,
}) => {
    return (
        <div
            onClick={onClick}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
        >
            <div className={styles.itemContent}>
                <span className={styles.itemIcon}>
                    {getTypeIcon(variable.type)}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <span className={styles.itemLabel}>{variable.label || variable.name}</span>
                    {variable.label && variable.label !== variable.name && (
                        <div
                            style={{
                                fontSize: 'var(--text-xs)',
                                color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--gray-400)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {variable.name}
                        </div>
                    )}
                </div>
            </div>
            <div className={styles.itemMeta}>
                <ChevronRight className={styles.itemChevron} size={14} />
            </div>
        </div>
    );
};

export const VariableColumn: React.FC = () => {
    const {
        dataset,
        variableSets,
        selectedVariableSetId,
        selectedVariableId,
        setSelectedVariableId,
    } = useVelocityStore();

    // Get the selected variable set
    const selectedSet = useMemo(() => {
        if (!selectedVariableSetId) return null;
        return variableSets.find(vs => vs.id === selectedVariableSetId) || null;
    }, [variableSets, selectedVariableSetId]);

    // Get variables for the selected set
    const variables = useMemo(() => {
        if (!selectedSet || !dataset) return [];
        return selectedSet.variableIds
            .map(id => dataset.variables.find(v => v.id === id))
            .filter((v): v is Variable => v !== undefined);
    }, [selectedSet, dataset]);

    // Determine if this column should be shown
    // Only show for multi-variable sets (more than 1 variable)
    const shouldShow = selectedSet && selectedSet.variableIds.length > 1;

    if (!shouldShow) {
        return (
            <div className={`${styles.column} ${styles.col4} ${styles.columnHidden}`} />
        );
    }

    const handleSelect = (variableId: string) => {
        setSelectedVariableId(variableId);
    };

    return (
        <div className={`${styles.column} ${styles.col4}`}>
            <div className={styles.columnHeader}>
                <span className={styles.columnTitle}>Variables</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-400)' }}>
                    {variables.length}
                </span>
            </div>

            <div className={styles.columnContent}>
                {variables.length > 0 ? (
                    variables.map(variable => (
                        <VariableItem
                            key={variable.id}
                            variable={variable}
                            isActive={selectedVariableId === variable.id}
                            onClick={() => handleSelect(variable.id)}
                        />
                    ))
                ) : (
                    <div className={styles.emptyState}>
                        <Tag className={styles.emptyIcon} />
                        <span className={styles.emptyText}>No variables</span>
                    </div>
                )}
            </div>
        </div>
    );
};
