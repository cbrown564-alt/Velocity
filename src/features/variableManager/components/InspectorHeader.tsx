import React, { useState, useRef, useCallback } from 'react';
import { Edit2 } from 'lucide-react';
import type { Variable } from '../../../store/slices/dataSlice';
import type { VariableStatsResult } from '../../../types/worker';
import { useVelocityStore } from '../../../store';
import { VariableTypeIcon } from '../../../components/common/VariableTypeIcon';
import styles from '../VariableInspector.module.css';
import { normalizeVariableType, allowsNumericStats } from '../../../types';

export const getTypeBadgeClass = (type: string) => {
    switch (normalizeVariableType(type as any)) {
        case 'categorical':
            return styles.typeBadgeNominal;
        case 'ordered':
            return styles.typeBadgeOrdinal;
        case 'numeric':
            return styles.typeBadgeScale;
        case 'text':
            return styles.typeBadgeText;
        case 'date':
            return styles.typeBadgeDate;
        default:
            return styles.typeBadgeNominal;
    }
};

export const getTypeLabel = (type: string) => {
    switch (normalizeVariableType(type as any)) {
        case 'categorical':
            return 'Category';
        case 'ordered':
            return 'Scale';
        case 'numeric':
            return 'Numeric';
        case 'text':
            return 'Text';
        case 'date':
            return 'Date';
        default:
            return type;
    }
};

interface InspectorHeaderProps {
    variable: Variable;
    stats: VariableStatsResult | null;
    isLoadingStats: boolean;
}

export const InspectorHeader: React.FC<InspectorHeaderProps> = ({ variable, stats, isLoadingStats }) => {
    const { updateVariableMetadata } = useVelocityStore();
    const hasValueLabels = variable.valueLabels && variable.valueLabels.length > 0;

    const displayName = variable.label && variable.label.trim() !== '' ? variable.label : variable.name;

    const totalObservations = stats?.totalCount || 0;
    const missingCount = stats?.missingCount || 0;
    const validCount = Math.max(0, totalObservations - missingCount);
    const percentMissing = totalObservations > 0 ? (missingCount / totalObservations) * 100 : 0;

    const isNumeric = allowsNumericStats(variable.type, variable.orderedScoring);

    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [labelDraft, setLabelDraft] = useState('');
    const [nameDraft, setNameDraft] = useState('');

    const labelInputRef = useRef<HTMLInputElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const startEditLabel = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLabelDraft(displayName);
        setIsEditingLabel(true);
        setTimeout(() => labelInputRef.current?.select(), 0);
    }, [displayName]);

    const commitLabel = useCallback(() => {
        const trimmed = labelDraft.trim();
        if (trimmed && trimmed !== displayName) {
            updateVariableMetadata(variable.id, { label: trimmed });
        }
        setIsEditingLabel(false);
    }, [labelDraft, displayName, variable.id, updateVariableMetadata]);

    const startEditName = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        setNameDraft(variable.name);
        setIsEditingName(true);
        setTimeout(() => nameInputRef.current?.select(), 0);
    }, [variable.name]);

    const commitName = useCallback(() => {
        const trimmed = nameDraft.trim();
        if (trimmed && trimmed !== variable.name) {
            updateVariableMetadata(variable.id, { name: trimmed });
        }
        setIsEditingName(false);
    }, [nameDraft, variable.name, variable.id, updateVariableMetadata]);

    const handleLabelKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitLabel();
        if (e.key === 'Escape') setIsEditingLabel(false);
    };

    const handleNameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') commitName();
        if (e.key === 'Escape') setIsEditingName(false);
    };

    return (
        <div className={styles.header}>
            <div className={styles.headerTitleRow} style={{ alignItems: 'flex-end', marginBottom: '12px' }}>
                <div className={styles.editableTitleContainer} style={{ borderBottom: 'none' }}>
                    {/* Variable Name (Code) */}
                    <div className={styles.editableSubtitleContainer} onClick={!isEditingName ? startEditName : undefined} style={{ marginRight: '8px', marginBottom: '2px' }}>
                        {isEditingName ? (
                            <input
                                ref={nameInputRef}
                                className={styles.inlineEditInputSmall}
                                value={nameDraft}
                                onChange={e => setNameDraft(e.target.value)}
                                onBlur={commitName}
                                onKeyDown={handleNameKeyDown}
                                autoFocus
                            />
                        ) : (
                            <>
                                <span className={styles.variableIdCode} style={{ fontSize: '12px', padding: '3px 8px', backgroundColor: 'var(--bg-surface)' }}>
                                    {variable.name}
                                </span>
                            </>
                        )}
                    </div>
                    {/* Display Name */}
                    <div onClick={!isEditingLabel ? startEditLabel : undefined} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderBottom: '1px dashed transparent', paddingBottom: '2px' }} className={styles.editableTitleContainerHoverTarget}>
                        {isEditingLabel ? (
                            <input
                                ref={labelInputRef}
                                className={styles.inlineEditInput}
                                value={labelDraft}
                                onChange={e => setLabelDraft(e.target.value)}
                                onBlur={commitLabel}
                                onKeyDown={handleLabelKeyDown}
                                autoFocus
                            />
                        ) : (
                            <>
                                <h2 className={styles.variablePrimaryTitle}>{displayName}</h2>
                                <Edit2 className={styles.editIcon} size={14} />
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className={styles.headerSubtitleRow} style={{ justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginBottom: '16px' }}>
                <div className={styles.headerBadges}>
                    <span className={`${styles.typeBadge} ${getTypeBadgeClass(variable.type)}`}>
                        <VariableTypeIcon type={variable.type} size={12} />
                        {getTypeLabel(variable.type)}
                    </span>
                    {!isNumeric && hasValueLabels && (
                        <span className={styles.categoryCountBadge}>
                            {variable.valueLabels!.length} categories
                        </span>
                    )}
                    {isNumeric && stats?.numeric?.mean !== undefined && (
                        <span className={styles.categoryCountBadge} style={{ backgroundColor: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                            Mean: <strong style={{ color: 'var(--text-primary)', marginLeft: '2px' }}>{stats.numeric.mean.toFixed(2)}</strong>
                        </span>
                    )}
                </div>

                {isLoadingStats ? (
                    <div className="animate-pulse flex space-x-2">
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <span>Valid <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{validCount.toLocaleString()}</strong></span>
                        {missingCount > 0 && (
                            <span>Missing <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{missingCount.toLocaleString()} ({Math.round(percentMissing)}%)</strong></span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
