import React, { useState, useRef, useCallback } from 'react';
import { Edit2 } from 'lucide-react';
import type { Variable } from '../../../store/slices/dataSlice';
import { useVelocityStore } from '../../../store';
import { VariableTypeIcon } from '../../../components/common/VariableTypeIcon';
import styles from '../VariableInspector.module.css';
import { normalizeVariableType } from '../../../types';

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
}

export const InspectorHeader: React.FC<InspectorHeaderProps> = ({ variable }) => {
    const { updateVariableMetadata } = useVelocityStore();
    const hasValueLabels = variable.valueLabels && variable.valueLabels.length > 0;

    const displayName = variable.label && variable.label.trim() !== '' ? variable.label : variable.name;
    const showSecondaryName = displayName !== variable.name;

    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [labelDraft, setLabelDraft] = useState('');
    const [nameDraft, setNameDraft] = useState('');

    const labelInputRef = useRef<HTMLInputElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const startEditLabel = useCallback(() => {
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

    const startEditName = useCallback(() => {
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
            <div className={styles.headerTitleRow}>
                <div className={styles.editableTitleContainer} onClick={!isEditingLabel ? startEditLabel : undefined}>
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
                <div className={styles.headerBadges}>
                    <span className={`${styles.typeBadge} ${getTypeBadgeClass(variable.type)}`}>
                        <VariableTypeIcon type={variable.type} size={12} />
                        {getTypeLabel(variable.type)}
                    </span>
                    {hasValueLabels && (
                        <span className={styles.categoryCountBadge}>
                            {variable.valueLabels!.length} categories
                        </span>
                    )}
                </div>
            </div>

            <div className={styles.headerSubtitleRow}>
                {showSecondaryName && (
                    <div className={styles.editableSubtitleContainer} onClick={!isEditingName ? startEditName : undefined}>
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
                                <span className={styles.variableIdCode}>
                                    {variable.name}
                                </span>
                                <Edit2 className={styles.editIconSmall} size={12} />
                            </>
                        )}
                    </div>
                )}
                {!showSecondaryName && (
                    <span className={styles.variableIdCode}>
                        {variable.id}
                    </span>
                )}
            </div>
        </div>
    );
};
