/**
 * Variable and variable-set normalization helpers.
 */

import { normalizeVariableType } from '../../../types';
import type { Variable, VariableSet } from '../../../types/dataset';

export function normalizeVariable(variable: Variable): Variable {
    const normalizedType = normalizeVariableType(variable.type);
    const next: Variable = {
        ...variable,
        type: normalizedType,
    };

    if (normalizedType !== 'ordered') {
        delete next.orderedStyle;
        delete next.orderedScoring;
        return next;
    }

    if (!next.orderedStyle) {
        next.orderedStyle = variable.type === 'scale' ? 'rating' : 'sequence';
    }
    if (!next.orderedScoring) {
        next.orderedScoring = variable.type === 'scale' ? 'allow_numeric_stats' : 'categorical_only';
    }
    return next;
}

export function normalizeVariableSet(variableSet: VariableSet): VariableSet {
    if (!variableSet.type) return variableSet;
    const normalizedType = normalizeVariableType(variableSet.type);
    const next: VariableSet = {
        ...variableSet,
        type: normalizedType,
    };

    if (normalizedType !== 'ordered') {
        delete next.orderedStyle;
        delete next.orderedScoring;
        return next;
    }

    if (!next.orderedStyle) {
        next.orderedStyle = variableSet.type === 'scale' ? 'rating' : 'sequence';
    }
    if (!next.orderedScoring) {
        next.orderedScoring = variableSet.type === 'scale' ? 'allow_numeric_stats' : 'categorical_only';
    }
    return next;
}

export function buildVariableSetsFromVariables(variables: Variable[]): VariableSet[] {
    return variables
        .filter((variable) => !variable.synthetic)
        .map((variable) => ({
            id: crypto.randomUUID(),
            name: variable.label || variable.name,
            variableIds: [variable.id],
            structure: 'single' as const,
            type: variable.type,
        }));
}
