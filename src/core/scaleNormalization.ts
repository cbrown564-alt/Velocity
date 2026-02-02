/**
 * Scale Normalization
 *
 * Fills in gaps for endpoint-labeled scales in survey data.
 * Some datasets (like SPSS) only label the endpoints of a scale
 * (e.g., 1="Not at all", 10="Very much"). This module detects and fills those gaps.
 *
 * Extracted from analysisWorker.ts for reuse in CLI and testing contexts.
 */

import { Variable, VariableType } from '../types';
import { inferVariableType } from '../services/dataHeuristics';

export interface ColumnLookup {
  findColumnIndex(variableName: string): number;
}

export interface RowData {
  rows: any[][];
}

/**
 * Fill in gaps for endpoint-labeled scales.
 *
 * Mutates the variables array in place: updates valueLabels and type
 * for variables that have exactly 2 value labels spanning a range.
 *
 * @param variables - Array of variables to process (mutated in place)
 * @param rows - Row-major data array
 * @param findColumnIndex - Function to find the column index for a variable name
 */
export function fillEndpointLabelGaps(
  variables: Variable[],
  rows: any[][],
  findColumnIndex: (variableName: string) => number
): void {
  for (let i = 0; i < variables.length; i++) {
    const v = variables[i];

    if (v.valueLabels.length === 2 && v.type !== 'text' && v.type !== 'date') {
      const vals = v.valueLabels.map(vl => vl.value).sort((a, b) => a - b);
      const min = vals[0]!;
      const max = vals[1]!;

      if (typeof min === 'number' && typeof max === 'number' && max - min > 1) {
        const colIndex = findColumnIndex(v.name);
        if (colIndex !== -1) {
          const uniqueValues = new Set<number>();

          for (const row of rows) {
            const val = row[colIndex];
            if (typeof val === 'number' && val >= min && val <= max) {
              uniqueValues.add(val);
            }
          }

          if (uniqueValues.size > 2) {
            const sortedUnique = Array.from(uniqueValues).sort((a, b) => a - b);
            const newLabels = [...v.valueLabels];

            for (const val of sortedUnique) {
              if (!newLabels.some(l => l.value === val)) {
                newLabels.push({ value: val, label: val.toString() });
              }
            }

            v.valueLabels = newLabels.sort((a, b) => a.value - b.value);
            v.type = 'scale';

            const inferred = inferVariableType(v.valueLabels);
            if (inferred !== 'nominal') {
              v.type = inferred;
            }
          }
        }
      }
    }
  }
}
