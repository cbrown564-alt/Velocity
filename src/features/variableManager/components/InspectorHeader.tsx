import React from 'react';
import type { Variable } from '../../../store/slices/dataSlice';
import styles from '../VariableInspector.module.css';

interface InspectorHeaderProps {
    variable: Variable;
}

export const InspectorHeader: React.FC<InspectorHeaderProps> = ({ variable }) => {
    return (
        <div className={styles.header}>
            <h2 className={styles.variableName}>{variable.name}</h2>
            {variable.label && variable.label !== variable.name && (
                <p className={styles.variableLabel}>{variable.label}</p>
            )}
        </div>
    );
};
