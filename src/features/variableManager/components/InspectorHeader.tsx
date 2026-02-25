import React from 'react';
import { Edit2 } from 'lucide-react';
import type { Variable } from '../../../store/slices/dataSlice';
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
    const hasValueLabels = variable.valueLabels && variable.valueLabels.length > 0;

    // Determine what to show for the primary title. If there's no label, fallback to name.
    const displayName = variable.label && variable.label.trim() !== '' ? variable.label : variable.name;
    const showSecondaryName = displayName !== variable.name;

    return (
        <div className={styles.header}>
            <div className={styles.headerTitleRow}>
                <div className={styles.editableTitleContainer}>
                    <h2 className={styles.variablePrimaryTitle}>{displayName}</h2>
                    <Edit2 className={styles.editIcon} size={14} />
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
                    <div className={styles.editableSubtitleContainer}>
                        <span className={styles.variableIdCode}>
                            {variable.name}
                        </span>
                        <Edit2 className={styles.editIconSmall} size={12} />
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
