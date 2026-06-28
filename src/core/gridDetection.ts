/**
 * Grid Detection Heuristics
 *
 * Pure functions for detecting implicit variable sets (grids) in survey data.
 * Extracted from analysisWorker.ts for reuse in CLI and testing contexts.
 */

import { Variable } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface VariableWithIndex {
  variable: Variable;
  index: number;
  valueLabelSetName?: string;
}

// ============================================================================
// Date Format Detection
// ============================================================================

/**
 * Detect if a variable is a date type based on SPSS format specification.
 * Common SPSS date formats: DATE, ADATE, EDATE, SDATE, DATETIME, TIME, etc.
 */
export function isDateFormat(format: string | undefined): boolean {
  if (!format) return false;
  const dateFormats = [
    'DATE',
    'ADATE',
    'EDATE',
    'SDATE',
    'JDATE',
    'QYR',
    'MOYR',
    'WKYR',
    'DATETIME',
    'TIME',
    'DTIME',
    'WKDAY',
    'MONTH',
  ];
  const upperFormat = format.toUpperCase();
  return dateFormats.some((df) => upperFormat.startsWith(df));
}

// ============================================================================
// Positive Value Inference
// ============================================================================

/**
 * Infer which value represents "positive" in binary scales (e.g., Yes/No, True/False)
 */
export function inferPositiveValue(valueLabels: { value: number; label: string }[]): number {
  const positivePatterns = /yes|true|selected|agree|1/i;

  for (const vl of valueLabels) {
    if (positivePatterns.test(vl.label)) {
      return vl.value;
    }
  }

  // Fallback: assume higher value is positive
  return Math.max(...valueLabels.map((vl) => vl.value));
}

// ============================================================================
// Implicit Scale Detection
// ============================================================================

/**
 * Scan data to detect if a numeric variable is implicitly a scale (e.g. 1-10 integers)
 */
export function detectImplicitScale(
  rows: any[][],
  colIndex: number,
  rowCount: number,
): { isScale: boolean; values: number[] } {
  const MAX_SCALE_VALUE = 20;
  const MAX_CARDINALITY = 20;

  const uniqueValues = new Set<number>();
  let nonMissingCount = 0;

  const limit = Math.min(rowCount, 1000);

  for (let i = 0; i < limit; i++) {
    const row = rows[i];
    if (!row) continue;

    const val = row[colIndex];
    if (typeof val !== 'number' || isNaN(val)) continue;

    nonMissingCount++;

    if (!Number.isInteger(val)) return { isScale: false, values: [] };
    if (val < 0 || val > MAX_SCALE_VALUE) return { isScale: false, values: [] };

    uniqueValues.add(val);
    if (uniqueValues.size > MAX_CARDINALITY) return { isScale: false, values: [] };
  }

  if (nonMissingCount === 0 || uniqueValues.size < 2) return { isScale: false, values: [] };

  return {
    isScale: true,
    values: Array.from(uniqueValues).sort((a, b) => a - b),
  };
}

// ============================================================================
// Word Similarity
// ============================================================================

/**
 * Calculate Jaccard similarity coefficient for two sets of strings (words)
 */
export function calculateWordSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.toLowerCase().split(/[\s\-_]+/));
  const words2 = new Set(str2.toLowerCase().split(/[\s\-_]+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Heuristic to check if two variables likely belong to the same grid based on labels
 */
export function areLabelsRelated(label1: string, label2: string): boolean {
  const l1 = label1.trim();
  const l2 = label2.trim();

  const words1 = l1.split(/[\s\-_]+/);
  const words2 = l2.split(/[\s\-_]+/);

  if (words1.length > 0 && words2.length > 0) {
    if (words1[0].length >= 2 && words1[0].toLowerCase() === words2[0].toLowerCase()) {
      return true;
    }
  }

  return calculateWordSimilarity(l1, l2) > 0.3;
}

// ============================================================================
// Sequential Pattern Detection
// ============================================================================

/**
 * Detect by position: consecutive variables in the original file
 */
export function detectByPosition(vars: VariableWithIndex[]): Variable[][] {
  if (vars.length < 3) return [];

  const sorted = [...vars].sort((a, b) => a.index - b.index);

  const groups: Variable[][] = [];
  let currentGroup: Variable[] = [sorted[0].variable];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    if (curr.index - prev.index <= 2) {
      currentGroup.push(curr.variable);
    } else {
      if (currentGroup.length >= 3) {
        groups.push([...currentGroup]);
      }
      currentGroup = [curr.variable];
    }
  }

  if (currentGroup.length >= 3) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Detect by naming: sequential numeric suffixes (e.g., Q1, Q2, Q3)
 */
export function detectByNaming(vars: Variable[]): Variable[][] {
  if (vars.length < 3) return [];

  const patterns = vars
    .map((v) => {
      const match = v.name.match(/^([a-zA-Z_]+?)(\d+)$/);
      if (!match) return null;
      return { variable: v, prefix: match[1], number: parseInt(match[2], 10) };
    })
    .filter((p): p is { variable: Variable; prefix: string; number: number } => p !== null);

  if (patterns.length < 3) return [];

  const byPrefix = new Map<string, typeof patterns>();
  for (const p of patterns) {
    if (!byPrefix.has(p.prefix)) byPrefix.set(p.prefix, []);
    byPrefix.get(p.prefix)!.push(p);
  }

  const groups: Variable[][] = [];
  for (const group of byPrefix.values()) {
    if (group.length < 3) continue;

    group.sort((a, b) => a.number - b.number);

    const numbers = group.map((g) => g.number);
    const range = numbers[numbers.length - 1] - numbers[0];

    if (range === numbers.length - 1 || range < numbers.length * 2) {
      const vars = group.map((g) => g.variable);
      groups.push(vars);
    }
  }

  return groups;
}

/**
 * Detect sequential patterns using both position and naming methods
 */
export function detectSequentialPattern(vars: VariableWithIndex[]): Variable[][] {
  const positionGroups = detectByPosition(vars);

  if (positionGroups.length > 0) {
    return positionGroups;
  }

  const nameGroups = detectByNaming(vars.map((v) => v.variable));
  return nameGroups;
}

// ============================================================================
// Numeric Grid Detection
// ============================================================================

/**
 * Numeric Grid Detection
 * Stricter grouping for unlabeled numeric variables.
 * Requires:
 * 1. Proximity (Index gap <= 2)
 * 2. Shared Naming/Label Pattern
 * 3. Shared Data Scale (Min/Max/Cardinality)
 */
export function detectNumericGrids(
  vars: VariableWithIndex[],
  rows: any[][],
  metaVars: any[],
  rowCount: number,
): Variable[][] {
  if (vars.length < 3) return [];

  const sorted = [...vars].sort((a, b) => a.index - b.index);

  const groups: Variable[][] = [];
  let currentGroup: VariableWithIndex[] = [sorted[0]];

  const getScaleInfo = (vIndex: number, pIndex: number) => {
    return detectImplicitScale(rows, pIndex, rowCount);
  };

  let currentScale = getScaleInfo(sorted[0].index, sorted[0].index);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const isNeighbor = curr.index - prev.index <= 2;
    const labelsRelated = areLabelsRelated(curr.variable.label, prev.variable.label);
    const currScale = getScaleInfo(curr.index, curr.index);

    let scaleMatches = false;
    if (currentScale.isScale && currScale.isScale) {
      const min1 = currentScale.values[0];
      const max1 = currentScale.values[currentScale.values.length - 1];
      const min2 = currScale.values[0];
      const max2 = currScale.values[currScale.values.length - 1];
      scaleMatches = min1 === min2 && max1 === max2;
    } else if (!currentScale.isScale && !currScale.isScale) {
      scaleMatches = false;
    }

    const shouldGroup = isNeighbor && scaleMatches && labelsRelated;

    if (shouldGroup) {
      currentGroup.push(curr);
    } else {
      if (currentGroup.length >= 3) {
        groups.push(currentGroup.map((v) => v.variable));
      }
      currentGroup = [curr];
      currentScale = currScale;
    }
  }

  if (currentGroup.length >= 3) {
    groups.push(currentGroup.map((v) => v.variable));
  }

  return groups;
}
