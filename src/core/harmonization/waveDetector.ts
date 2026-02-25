/**
 * Wave Detector
 *
 * Import-time heuristics to detect whether a newly loaded dataset
 * is likely a follow-up wave of an existing project.
 *
 * Pure functions — no browser APIs, fully testable.
 */

import type { WaveDetectionResult } from '../../types/harmonization';
import type { Variable } from '../../types/index';
import { jaroWinklerSimilarity } from './matchEngine';

export interface DatasetSummary {
  id: string;
  name: string;
  variables: Variable[];
  projectId?: string;
}

export interface NewDatasetSummary {
  name: string;
  variables: Variable[];
}

const MEDIUM_CONFIDENCE_THRESHOLD = 0.45;
const VARIABLE_OVERLAP_HIGH = 0.7;
const VARIABLE_OVERLAP_MEDIUM = 0.4;

/**
 * Detects whether a newly loaded dataset is likely a wave of an existing dataset.
 *
 * Heuristics:
 * 1. Filename similarity (Jaro-Winkler on stripped base names)
 * 2. Variable name overlap (Jaccard)
 */
export function detectWave(
  newDataset: NewDatasetSummary,
  existingDatasets: DatasetSummary[]
): WaveDetectionResult {
  if (existingDatasets.length === 0) {
    return { isLikelyWave: false, confidence: 0, matchedDatasetId: null, reason: 'No existing datasets' };
  }

  let bestConfidence = 0;
  let bestDatasetId: string | null = null;
  let bestReason = '';

  const newName = stripWaveSuffix(newDataset.name);
  const newVarNames = new Set(newDataset.variables.map(v => v.name.toLowerCase()));

  for (const existing of existingDatasets) {
    const existingName = stripWaveSuffix(existing.name);
    const existingVarNames = new Set(existing.variables.map(v => v.name.toLowerCase()));

    const nameSim = jaroWinklerSimilarity(newName, existingName);
    const overlap = jaccardOverlap(newVarNames, existingVarNames);

    let confidence = 0;
    let reason = '';

    if (nameSim > 0.85 && overlap > VARIABLE_OVERLAP_HIGH) {
      confidence = 0.95;
      reason = `Very similar filename and ${Math.round(overlap * 100)}% variable overlap`;
    } else if (nameSim > 0.7 && overlap > VARIABLE_OVERLAP_MEDIUM) {
      confidence = 0.75;
      reason = `Similar filename and ${Math.round(overlap * 100)}% variable overlap`;
    } else if (overlap > VARIABLE_OVERLAP_HIGH) {
      confidence = 0.7;
      reason = `${Math.round(overlap * 100)}% variable name overlap`;
    } else if (nameSim > 0.85) {
      confidence = 0.5;
      reason = `Very similar filename`;
    } else if (overlap > VARIABLE_OVERLAP_MEDIUM) {
      confidence = 0.45;
      reason = `${Math.round(overlap * 100)}% variable overlap`;
    }

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestDatasetId = existing.id;
      bestReason = reason;
    }
  }

  return {
    isLikelyWave: bestConfidence >= MEDIUM_CONFIDENCE_THRESHOLD,
    confidence: bestConfidence,
    matchedDatasetId: bestDatasetId,
    reason: bestReason || 'Low similarity to existing datasets',
  };
}

// ============================================================================
// Helpers
// ============================================================================

function stripWaveSuffix(name: string): string {
  return name
    .replace(/\.(sav|csv|xlsx?)$/i, '')
    .replace(/[_\s-]?wave?\s*\d+$/i, '')
    .replace(/[_\s-]?w\d+$/i, '')
    .replace(/[_\s-]?\d{4}$/i, '')
    .toLowerCase()
    .trim();
}

function jaccardOverlap(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
