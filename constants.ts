import { DataSet, Respondent, Variable } from './types';

export const VARIABLES: Variable[] = [
  { id: 'gender', label: 'Gender', type: 'categorical' },
  { id: 'age_group', label: 'Age Group', type: 'ordinal', options: ['18-24', '25-34', '35-44', '45-54', '55+'] },
  { id: 'region', label: 'Region', type: 'categorical' },
  { id: 'nps_segment', label: 'NPS Segment', type: 'ordinal', options: ['Detractor', 'Passive', 'Promoter'] },
  { id: 'intent_to_buy', label: 'Intent to Buy', type: 'ordinal', options: ['Very Unlikely', 'Unlikely', 'Neutral', 'Likely', 'Very Likely'] },
  { id: 'product_sat', label: 'Product Satisfaction', type: 'numeric' },
];

const GENERATE_DATA = (count: number): Respondent[] => {
  const data: Respondent[] = [];
  const regions = ['North', 'South', 'East', 'West', 'International'];
  
  for (let i = 0; i < count; i++) {
    const npsScore = Math.floor(Math.random() * 11);
    let npsSegment = 'Passive';
    if (npsScore <= 6) npsSegment = 'Detractor';
    if (npsScore >= 9) npsSegment = 'Promoter';

    data.push({
      id: `resp_${i}`,
      gender: Math.random() > 0.5 ? 'Female' : 'Male',
      age_group: VARIABLES[1].options![Math.floor(Math.random() * VARIABLES[1].options!.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      nps_segment: npsSegment,
      intent_to_buy: VARIABLES[4].options![Math.floor(Math.random() * VARIABLES[4].options!.length)],
      product_sat: Math.floor(Math.random() * 5) + 1,
    });
  }
  return data;
};

export const MOCK_DATASET: DataSet = {
  variables: VARIABLES,
  data: GENERATE_DATA(250),
};
