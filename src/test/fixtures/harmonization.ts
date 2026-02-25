/**
 * Harmonization Test Fixtures
 *
 * Two mock wave datasets with overlapping and drifting variables
 * for use in harmonization engine tests.
 */

import type { Variable } from '../../types/index';
import type { HarmonizationSession } from '../../types/harmonization';

// Wave 1 variables
export const wave1Variables: Variable[] = [
  {
    id: 'w1_q1',
    name: 'Q1',
    label: 'Overall satisfaction with our service',
    type: 'scale',
    valueLabels: [
      { value: 1, label: 'Very Dissatisfied' },
      { value: 2, label: 'Dissatisfied' },
      { value: 3, label: 'Neutral' },
      { value: 4, label: 'Satisfied' },
      { value: 5, label: 'Very Satisfied' },
    ],
    missingValues: { discrete: [99] },
  },
  {
    id: 'w1_q2',
    name: 'Q2',
    label: 'How often do you use our product?',
    type: 'ordinal',
    valueLabels: [
      { value: 1, label: 'Never' },
      { value: 2, label: 'Rarely' },
      { value: 3, label: 'Sometimes' },
      { value: 4, label: 'Often' },
      { value: 5, label: 'Always' },
    ],
    missingValues: {},
  },
  {
    id: 'w1_q3',
    name: 'Q3',
    label: 'Gender',
    type: 'nominal',
    valueLabels: [
      { value: 1, label: 'Male' },
      { value: 2, label: 'Female' },
      { value: 3, label: 'Non-binary' },
    ],
    missingValues: {},
  },
  {
    id: 'w1_age',
    name: 'AGE',
    label: 'Age of respondent',
    type: 'numeric',
    valueLabels: [],
    missingValues: { discrete: [99] },
  },
  {
    id: 'w1_q4',
    name: 'Q4',
    label: 'Net Promoter Score',
    type: 'scale',
    valueLabels: [],
    missingValues: {},
  },
];

// Wave 2 variables (some renamed, some drifted)
export const wave2Variables: Variable[] = [
  {
    id: 'w2_q1',
    name: 'Q1',
    label: 'Overall satisfaction with our service',
    type: 'scale',
    valueLabels: [
      { value: 1, label: 'Very Dissatisfied' },
      { value: 2, label: 'Dissatisfied' },
      { value: 3, label: 'Neutral' },
      { value: 4, label: 'Satisfied' },
      { value: 5, label: 'Very Satisfied' },
    ],
    missingValues: { discrete: [99] },
  },
  {
    id: 'w2_q2_renamed',
    name: 'Q2A',
    label: 'How frequently do you use our product?',
    type: 'ordinal',
    valueLabels: [
      { value: 1, label: 'Never' },
      { value: 2, label: 'Rarely' },
      { value: 3, label: 'Sometimes' },
      { value: 4, label: 'Often' },
      { value: 5, label: 'Always' },
    ],
    missingValues: {},
  },
  {
    id: 'w2_gender',
    name: 'GENDER',
    label: 'Gender identity',
    type: 'nominal',
    valueLabels: [
      { value: 1, label: 'Male' },
      { value: 2, label: 'Female' },
      { value: 3, label: 'Non-binary' },
      { value: 4, label: 'Prefer not to say' },
    ],
    missingValues: {},
  },
  {
    id: 'w2_age',
    name: 'AGE',
    label: 'Age of respondent',
    type: 'numeric',
    valueLabels: [],
    missingValues: { discrete: [99] },
  },
  {
    id: 'w2_q5_new',
    name: 'Q5',
    label: 'Customer effort score',
    type: 'scale',
    valueLabels: [
      { value: 1, label: 'Very Easy' },
      { value: 2, label: 'Easy' },
      { value: 3, label: 'Neutral' },
      { value: 4, label: 'Difficult' },
      { value: 5, label: 'Very Difficult' },
    ],
    missingValues: {},
  },
];

// Inverted scale variables for testing scale inversion detection
export const invertedScaleSource: Variable = {
  id: 'inv_src',
  name: 'AGREE_SCALE',
  label: 'Agreement scale (low=disagree)',
  type: 'scale',
  valueLabels: [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly Agree' },
  ],
  missingValues: {},
};

export const invertedScaleTarget: Variable = {
  id: 'inv_tgt',
  name: 'AGREE_SCALE',
  label: 'Agreement scale (high=disagree)',
  type: 'scale',
  valueLabels: [
    { value: 1, label: 'Strongly Agree' },
    { value: 2, label: 'Agree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Disagree' },
    { value: 5, label: 'Strongly Disagree' },
  ],
  missingValues: {},
};

// Mock session for Sankey builder tests
export const mockHarmonizationSession: HarmonizationSession = {
  id: 'session-test-1',
  sourceDatasetId: 'dataset-wave1',
  targetDatasetId: 'dataset-wave2',
  mappings: [
    {
      id: 'w1_q1::w2_q1',
      sourceVariableId: 'w1_q1',
      targetVariableId: 'w2_q1',
      status: 'auto_matched',
      score: {
        total: 0.95,
        nameSimilarity: 1.0,
        labelSimilarity: 1.0,
        typeMatch: 1.0,
        valueLabelOverlap: 1.0,
      },
      valueMappings: [
        { sourceValue: 1, sourceLabel: 'Very Dissatisfied', targetValue: 1, targetLabel: 'Very Dissatisfied' },
        { sourceValue: 2, sourceLabel: 'Dissatisfied', targetValue: 2, targetLabel: 'Dissatisfied' },
        { sourceValue: 3, sourceLabel: 'Neutral', targetValue: 3, targetLabel: 'Neutral' },
        { sourceValue: 4, sourceLabel: 'Satisfied', targetValue: 4, targetLabel: 'Satisfied' },
        { sourceValue: 5, sourceLabel: 'Very Satisfied', targetValue: 5, targetLabel: 'Very Satisfied' },
      ],
      warnings: [],
      confirmed: false,
    },
    {
      id: 'w1_q2::w2_q2_renamed',
      sourceVariableId: 'w1_q2',
      targetVariableId: 'w2_q2_renamed',
      status: 'auto_matched',
      score: {
        total: 0.72,
        nameSimilarity: 0.7,
        labelSimilarity: 0.8,
        typeMatch: 1.0,
        valueLabelOverlap: 1.0,
      },
      valueMappings: [],
      warnings: [],
      confirmed: false,
    },
    {
      id: 'w1_q4::unmapped',
      sourceVariableId: 'w1_q4',
      targetVariableId: null,
      status: 'unmapped',
      score: null,
      valueMappings: [],
      warnings: [],
      confirmed: false,
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  outputTableName: null,
};
