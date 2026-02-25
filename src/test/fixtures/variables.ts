/**
 * Test Fixtures
 * 
 * Reusable mock data matching arch_02_data_model.md schemas.
 * Used across unit, component, and integration tests.
 */

import type { Variable, Dataset, ValueLabel, Filter, Recode, VariableSet } from '../../types';

// ============================================================================
// Value Labels
// ============================================================================

export const genderValueLabels: ValueLabel[] = [
    { value: 1, label: 'Male' },
    { value: 2, label: 'Female' },
    { value: 3, label: 'Non-binary' },
];

export const satisfactionValueLabels: ValueLabel[] = [
    { value: 1, label: 'Very Dissatisfied' },
    { value: 2, label: 'Dissatisfied' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Satisfied' },
    { value: 5, label: 'Very Satisfied' },
];

// ============================================================================
// Variables
// ============================================================================

export const mockNominalVariable: Variable = {
    id: 'var_gender',
    name: 'Q1_Gender',
    label: 'Gender',
    type: 'categorical',
    valueLabels: genderValueLabels,
    missingValues: { discrete: [-1, -99] },
};

export const mockOrdinalVariable: Variable = {
    id: 'var_satisfaction',
    name: 'Q2_Satisfaction',
    label: 'Overall Satisfaction',
    type: 'ordered',
    orderedStyle: 'sequence',
    orderedScoring: 'categorical_only',
    valueLabels: satisfactionValueLabels,
    missingValues: { discrete: [-1] },
};

export const mockScaleVariable: Variable = {
    id: 'var_age',
    name: 'Q3_Age',
    label: 'Age (years)',
    type: 'numeric',
    valueLabels: [],
    missingValues: { range: { low: -99, high: -1 } },
};

export const mockVariables: Variable[] = [
    mockNominalVariable,
    mockOrdinalVariable,
    mockScaleVariable,
];

// ============================================================================
// Dataset
// ============================================================================

export const mockDataset: Dataset = {
    id: 'dataset_001',
    name: 'survey_wave_1.sav',
    rowCount: 1000,
    variables: mockVariables,
    weightVariable: undefined,
    source: 'sav',
};

export const mockWeightedDataset: Dataset = {
    ...mockDataset,
    id: 'dataset_002',
    name: 'survey_weighted.sav',
    weightVariable: 'weight_var',
};

// ============================================================================
// Filters
// ============================================================================

export const mockEqualityFilter: Filter = {
    id: 'filter_001',
    variableId: 'var_gender',
    operator: 'eq',
    value: 1,
};

export const mockInFilter: Filter = {
    id: 'filter_002',
    variableId: 'var_satisfaction',
    operator: 'in',
    value: [4, 5],
};

export const mockRangeFilter: Filter = {
    id: 'filter_003',
    variableId: 'var_age',
    operator: 'gt',
    value: 18,
};

// ============================================================================
// Variable Sets
// ============================================================================

export const mockVariableSet: VariableSet = {
    id: 'varset_001',
    name: 'Brand Ratings',
    variableIds: ['var_brand_1', 'var_brand_2', 'var_brand_3'],
    structure: 'grid',
    type: 'numeric', // Assuming ratings are numeric
};

export const mockNominalSet: VariableSet = {
    id: 'set_gender',
    name: 'Gender',
    variableIds: ['var_gender'],
    structure: 'single',
    type: 'categorical',
};

export const mockOrdinalSet: VariableSet = {
    id: 'set_satisfaction',
    name: 'Overall Satisfaction',
    variableIds: ['var_satisfaction'],
    structure: 'single',
    type: 'ordered',
    orderedStyle: 'sequence',
    orderedScoring: 'categorical_only',
};

export const mockScaleSet: VariableSet = {
    id: 'set_age',
    name: 'Age (years)',
    variableIds: ['var_age'],
    structure: 'single',
    type: 'numeric',
};

// ============================================================================
// Recodes
// ============================================================================

export const mockAgeBinRecode: Recode = {
    id: 'recode_001',
    sourceVariableId: 'var_age',
    targetVariableName: 'Age_Group',
    mappings: [
        { sourceValues: [18, 19, 20, 21, 22, 23, 24], targetValue: 1, targetLabel: '18-24' },
        { sourceValues: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34], targetValue: 2, targetLabel: '25-34' },
        { sourceValues: [35, 36, 37, 38, 39, 40, 41, 42, 43, 44], targetValue: 3, targetLabel: '35-44' },
    ],
};
