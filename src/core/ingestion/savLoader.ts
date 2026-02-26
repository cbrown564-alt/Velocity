/**
 * SAV Loader - Metadata Processing
 *
 * Pure functions for processing parsed SAV metadata into Velocity's
 * Variable and VariableSet structures. Platform-independent: works with
 * both browser (ReadStat-WASM) and Node (readstat native) parsers.
 *
 * Extracted from analysisWorker.ts for reuse in CLI and testing contexts.
 */

import { Variable, VariableSet, VariableType } from '../../types';
import { isDateFormat, inferPositiveValue, detectImplicitScale, detectSequentialPattern, detectNumericGrids, VariableWithIndex } from '../gridDetection';
import { fillEndpointLabelGaps } from '../scaleNormalization';
import { inferVariableTyping } from '../../services/dataHeuristics';
import { generateSyntheticGridVariables } from '../../services/gridUtils';

// ============================================================================
// Input types (parser-agnostic)
// ============================================================================

export interface ParsedVariableMeta {
  name: string;
  label?: string;
  type: 'numeric' | 'string';
  format?: string;
  index: number;
  valueLabelSetName?: string;
}

export interface MultipleResponseSet {
  name: string;
  label?: string;
  type: 'C' | 'D';
  subvariables: string[];
  countedValue?: number;
}

export interface ParsedSavMetadata {
  variables: ParsedVariableMeta[];
  valueLabelSets: Record<string, { value: number; label: string }[]>;
  multipleResponseSets?: MultipleResponseSet[];
  rowCount: number;
}

export interface ParsedSavData {
  metadata: ParsedSavMetadata;
  rows: any[][];
}

// ============================================================================
// Output types
// ============================================================================

export interface ProcessedSavResult {
  variables: Variable[];
  variableSets: VariableSet[];
}

// ============================================================================
// Main processing function
// ============================================================================

/**
 * Process parsed SAV metadata into Velocity Variables and VariableSets.
 *
 * This is the core ingestion pipeline:
 * 1. Map raw metadata to Variable objects with type inference
 * 2. Fill endpoint-labeled scale gaps
 * 3. Create VariableSets from explicit MR sets
 * 4. Detect implicit grids via heuristics
 * 5. Generate synthetic grid variables
 */
export function processMetadata(data: ParsedSavData): ProcessedSavResult {
  const { metadata, rows } = data;
  const variableIndexById = new Map<string, number>();
  for (const parsed of metadata.variables) {
    variableIndexById.set(parsed.name, parsed.index);
  }

  // Step 1: Convert variables
  const variables: Variable[] = metadata.variables.map(v => {
    const id = v.name;

    let valueLabels: { value: number; label: string }[] = [];
    if (v.valueLabelSetName && metadata.valueLabelSets[v.valueLabelSetName]) {
      valueLabels = metadata.valueLabelSets[v.valueLabelSetName].map(vl => ({
        value: vl.value,
        label: vl.label
      }));
    }

    let type: VariableType;
    let orderedStyle: 'rating' | 'sequence' | undefined;
    let orderedScoring: 'categorical_only' | 'allow_numeric_stats' | undefined;

    if (v.type === 'string') {
      type = 'text';
    } else if (v.format && isDateFormat(v.format)) {
      type = 'date';
    } else if (valueLabels.length > 0) {
      const inferred = inferVariableTyping(valueLabels);
      type = inferred.type;
      orderedStyle = inferred.orderedStyle;
      orderedScoring = inferred.orderedScoring;
    } else {
      type = 'numeric';
    }

    return {
      id,
      name: v.name,
      label: v.label || v.name,
      type,
      orderedStyle,
      orderedScoring,
      valueLabels,
      missingValues: { discrete: [], range: undefined }
    };
  });

  // Step 2: Gap filling
  fillEndpointLabelGaps(
    variables,
    rows,
    (name) => metadata.variables.findIndex(pv => pv.name === name)
  );

  // Build variable name to ID map
  const varNameToId = new Map<string, string>();
  for (const v of variables) {
    varNameToId.set(v.name, v.id);
  }

  // Step 3: Create VariableSets from explicit MR sets
  const variablesInMRSets = new Set<string>();
  const variableSets: VariableSet[] = [];
  const mrSets = metadata.multipleResponseSets || [];

  for (const mrSet of mrSets) {
    const variableIds: string[] = [];
    for (const subvarName of mrSet.subvariables) {
      const varId = varNameToId.get(subvarName);
      if (varId) {
        variableIds.push(varId);
        variablesInMRSets.add(varId);
      }
    }

    if (variableIds.length > 0) {
      const structure = mrSet.type === 'C' ? 'grid' : 'multiple';
      const cleanName = mrSet.name.startsWith('$') ? mrSet.name.slice(1) : mrSet.name;
      const firstVar = variables.find(v => v.id === variableIds[0]);
      const setType = firstVar?.type;

      variableSets.push({
        id: `mrset_${cleanName}`,
        name: mrSet.label || cleanName,
        variableIds,
        structure,
        type: setType,
        description: mrSet.type === 'D'
          ? `Multiple response set (counted value: ${mrSet.countedValue})`
          : 'Grid/category set'
      });
    }
  }

  // Step 4: Heuristic Grid Detection
  const ungroupedVariables = variables.filter(v => !variablesInMRSets.has(v.id));

  const byValueLabelHash = new Map<string, VariableWithIndex[]>();

  for (const v of ungroupedVariables) {
    const parsedVar = metadata.variables.find(pv => pv.name === v.id);

    let hash = '';
    if (v.valueLabels && v.valueLabels.length > 0) {
      const sortedLabels = [...v.valueLabels].sort((a, b) => a.value - b.value);
      hash = sortedLabels.map(vl => `${vl.value}:${vl.label}`).join('|');
    } else if (v.type === 'numeric') {
      hash = '__numeric_unlabeled__';
    }

    if (hash) {
      if (!byValueLabelHash.has(hash)) {
        byValueLabelHash.set(hash, []);
      }
      byValueLabelHash.get(hash)!.push({
        variable: v,
        index: parsedVar?.index ?? -1,
        valueLabelSetName: hash
      });
    }
  }

  for (const [hash, varsInGroup] of byValueLabelHash.entries()) {
    if (varsInGroup.length < 3) continue;

    let gridCandidatesList: Variable[][] = [];

    if (hash === '__numeric_unlabeled__') {
      gridCandidatesList = detectNumericGrids(varsInGroup, rows, metadata.variables, rows.length);
    } else {
      gridCandidatesList = detectSequentialPattern(varsInGroup);
    }

    for (const gridCandidates of gridCandidatesList) {
      const firstVar = gridCandidates[0];
      const valueLabels = firstVar.valueLabels;
      const isBinary = valueLabels && valueLabels.length === 2;

      let structure: 'grid' | 'multiple' = 'grid';
      let countedValue: number | undefined;

      const variableIds = gridCandidates.map(v => v.id);

      const prefixMatch = firstVar.name.match(/^([a-zA-Z_]+?)\d+$/);
      let prefix = prefixMatch?.[1] || firstVar.name.replace(/[0-9]+$/, '');
      if (prefix.length < 2) prefix = firstVar.name;

      for (const v of gridCandidates) {
        variablesInMRSets.add(v.id);
      }

      if (isBinary) {
        structure = 'multiple';
        countedValue = inferPositiveValue(valueLabels);

        const setId = `heuristic_${structure}_${variableIds.join('_')}`;

        variableSets.push({
          id: setId,
          name: prefix,
          variableIds,
          structure,
          type: firstVar.type,
          countedValue,
          description: `Detected multi-response with shared Yes/No scale`
        });
      } else {
        let isNumericGrid = hash === '__numeric_unlabeled__';
        let syntheticLabels: Record<number, string> | undefined;
        let detectedType = firstVar.type;

        if (isNumericGrid) {
          const firstVarId = gridCandidates[0].id;
          const parsedVarIndex = metadata.variables.findIndex(pv => pv.name === firstVarId);

          if (parsedVarIndex !== -1) {
            const check = detectImplicitScale(rows, parsedVarIndex, rows.length);

            if (check.isScale) {
              isNumericGrid = false;
              detectedType = 'ordered';

              syntheticLabels = {};
              check.values.forEach(val => {
                syntheticLabels![val] = String(val);
              });

              gridCandidates.forEach(v => {
                v.type = 'ordered';
                v.orderedStyle = 'rating';
                v.orderedScoring = 'allow_numeric_stats';
                v.valueLabels = check.values.map(val => ({ value: val, label: String(val) }));
              });
            }
          }
        }

        const setId = `heuristic_${structure}_${variableIds.join('_')}`;

        const description = isNumericGrid
          ? `Detected numeric grid (metric set)`
          : `Detected grid with shared scale`;

        variableSets.push({
          id: setId,
          name: prefix,
          variableIds,
          structure,
          type: detectedType,
          description,
          gridMetadata: {
            sharedScale: {
              valueLabels: syntheticLabels || (isNumericGrid ? {} : firstVar.valueLabels.reduce((acc, vl) => {
                acc[vl.value] = vl.label;
                return acc;
              }, {} as Record<number, string>)),
              type: isNumericGrid ? 'numeric' : detectedType,
              orderedStyle: isNumericGrid ? undefined : firstVar.orderedStyle,
              orderedScoring: isNumericGrid ? undefined : firstVar.orderedScoring,
            },
            itemLabels: gridCandidates.map(v => v.label || v.name),
            itemMapping: gridCandidates.reduce((acc, v, idx) => {
              acc[v.id] = idx;
              return acc;
            }, {} as Record<string, number>)
          }
        });
      }
    }
  }

  // Create 'single' VariableSets for ungrouped variables
  for (const v of variables) {
    if (!variablesInMRSets.has(v.id)) {
      variableSets.push({
        id: `vs_${v.id}`,
        name: v.label || v.name,
        variableIds: [v.id],
        structure: 'single',
        type: v.type
      });
    }
  }

  // Step 5: Generate synthetic grid variables
  const syntheticVariables: Variable[] = [];
  for (const vs of variableSets) {
    if (vs.structure === 'grid' && vs.gridMetadata) {
      syntheticVariables.push(...generateSyntheticGridVariables(vs));
    }
  }

  if (syntheticVariables.length > 0) {
    variables.push(...syntheticVariables);

    for (const sv of syntheticVariables) {
      variableSets.push({
        id: sv.id,
        name: sv.label || sv.name,
        variableIds: [sv.id],
        structure: 'single',
        type: sv.type,
        derived: true,
        description: `Synthetic variable for grid unpivoting`
      } as any);
    }
  }

  // Preserve source-order semantics for UI lists by sorting sets by the
  // earliest underlying variable index in the survey definition.
  const orderedVariableSets = variableSets
    .map((vs, insertionIndex) => {
      let minIndex = Number.POSITIVE_INFINITY;
      for (const variableId of vs.variableIds) {
        const idx = variableIndexById.get(variableId);
        if (idx !== undefined && idx < minIndex) {
          minIndex = idx;
        }
      }
      return { vs, insertionIndex, orderIndex: minIndex };
    })
    .sort((a, b) => {
      if (a.orderIndex === b.orderIndex) return a.insertionIndex - b.insertionIndex;
      if (!Number.isFinite(a.orderIndex)) return 1;
      if (!Number.isFinite(b.orderIndex)) return -1;
      return a.orderIndex - b.orderIndex;
    })
    .map(entry => entry.vs);

  return { variables, variableSets: orderedVariableSets };
}
