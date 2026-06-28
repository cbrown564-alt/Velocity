import { Variable, Respondent } from './types';

/**
 * Mock Dataset Variables
 * Updated to conform to arch_02_data_model.md Variable interface
 */
export const VARIABLES: Variable[] = [
  {
    id: 'gender',
    name: 'gender',
    label: 'Gender',
    type: 'categorical',
    valueLabels: [
      { value: 1, label: 'Female' },
      { value: 2, label: 'Male' },
    ],
    missingValues: {},
  },
  {
    id: 'age_group',
    name: 'age_group',
    label: 'Age Group',
    type: 'ordered',
    orderedStyle: 'sequence',
    orderedScoring: 'categorical_only',
    valueLabels: [
      { value: 1, label: '18-24' },
      { value: 2, label: '25-34' },
      { value: 3, label: '35-44' },
      { value: 4, label: '45-54' },
      { value: 5, label: '55+' },
    ],
    missingValues: {},
  },
  {
    id: 'region',
    name: 'region',
    label: 'Region',
    type: 'categorical',
    valueLabels: [
      { value: 1, label: 'North' },
      { value: 2, label: 'South' },
      { value: 3, label: 'East' },
      { value: 4, label: 'West' },
      { value: 5, label: 'International' },
    ],
    missingValues: {},
  },
  {
    id: 'nps_segment',
    name: 'nps_segment',
    label: 'NPS Segment',
    type: 'ordered',
    orderedStyle: 'sequence',
    orderedScoring: 'categorical_only',
    valueLabels: [
      { value: 1, label: 'Detractor' },
      { value: 2, label: 'Passive' },
      { value: 3, label: 'Promoter' },
    ],
    missingValues: {},
  },
  {
    id: 'intent_to_buy',
    name: 'intent_to_buy',
    label: 'Intent to Buy',
    type: 'ordered',
    orderedStyle: 'rating',
    orderedScoring: 'allow_numeric_stats',
    valueLabels: [
      { value: 1, label: 'Very Unlikely' },
      { value: 2, label: 'Unlikely' },
      { value: 3, label: 'Neutral' },
      { value: 4, label: 'Likely' },
      { value: 5, label: 'Very Likely' },
    ],
    missingValues: {},
  },
  {
    id: 'product_sat',
    name: 'product_sat',
    label: 'Product Satisfaction',
    type: 'numeric',
    valueLabels: [],
    missingValues: { discrete: [-99] },
  },
];

const AGE_OPTIONS = ['18-24', '25-34', '35-44', '45-54', '55+'];
const INTENT_OPTIONS = ['Very Unlikely', 'Unlikely', 'Neutral', 'Likely', 'Very Likely'];
const REGIONS = ['North', 'South', 'East', 'West', 'International'];

const GENERATE_DATA = (count: number): Respondent[] => {
  const data: Respondent[] = [];

  for (let i = 0; i < count; i++) {
    const npsScore = Math.floor(Math.random() * 11);
    let npsSegment = 'Passive';
    if (npsScore <= 6) npsSegment = 'Detractor';
    if (npsScore >= 9) npsSegment = 'Promoter';

    data.push({
      id: `resp_${i}`,
      gender: Math.random() > 0.5 ? 'Female' : 'Male',
      age_group: AGE_OPTIONS[Math.floor(Math.random() * AGE_OPTIONS.length)],
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
      nps_segment: npsSegment,
      intent_to_buy: INTENT_OPTIONS[Math.floor(Math.random() * INTENT_OPTIONS.length)],
      product_sat: Math.floor(Math.random() * 5) + 1,
    });
  }
  return data;
};

export const MOCK_DATASET = {
  variables: VARIABLES,
  data: GENERATE_DATA(250),
};
