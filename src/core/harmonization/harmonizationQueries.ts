/**
 * Harmonization SQL Query Builders
 *
 * Pure functions that generate SQL for harmonization operations.
 * Follows the queryBuilder.ts pattern — no side effects, easily testable.
 */

import type { VariableMapping, ValueMapping } from '../../types/harmonization';
import { escapeString } from '../../services/queryBuilder';

// ============================================================================
// Value Frequency Query
// ============================================================================

/**
 * Returns a SQL query to count value frequencies for a column.
 */
export function buildValueFrequencyQuery(tableName: string, columnName: string): string {
  const escapedTable = escapeString(tableName);
  const escapedCol = `"${columnName.replace(/"/g, '""')}"`;
  return [
    `SELECT ${escapedCol} AS col_value, COUNT(*) AS count`,
    `FROM ${escapedTable}`,
    `WHERE ${escapedCol} IS NOT NULL`,
    `GROUP BY ${escapedCol}`,
    `ORDER BY count DESC`,
  ].join('\n');
}

// ============================================================================
// Harmonized Table Query
// ============================================================================

/**
 * Builds a UNION-based query that creates a harmonized table by combining
 * source and target datasets with CASE-based value remapping.
 */
export function buildHarmonizedTableQuery(
  sourceTable: string,
  targetTable: string,
  mappings: VariableMapping[],
  sourceVarNames: Record<string, string>,
  targetVarNames: Record<string, string>
): string {
  const confirmedMappings = mappings.filter(
    m => m.targetVariableId !== null && m.status !== 'excluded'
  );

  if (confirmedMappings.length === 0) {
    return `SELECT 1 AS _wave, NULL AS _variable_name, NULL AS _value, NULL AS _label WHERE 1=0`;
  }

  const escapedSourceTable = escapeString(sourceTable);
  const escapedTargetTable = escapeString(targetTable);

  const unionParts: string[] = [];

  for (const mapping of confirmedMappings) {
    const sourceVarName = sourceVarNames[mapping.sourceVariableId];
    const targetVarName = targetVarNames[mapping.targetVariableId!];

    if (!sourceVarName || !targetVarName) continue;

    const escapedSourceCol = `"${sourceVarName.replace(/"/g, '""')}"`;
    const escapedTargetCol = `"${targetVarName.replace(/"/g, '""')}"`;
    const harmonizedName = sourceVarName;

    const sourceCaseExpr = buildValueRemapCase(escapedSourceCol, mapping.valueMappings, 'source');
    unionParts.push(
      `SELECT 1 AS _wave, '${harmonizedName.replace(/'/g, "''")}' AS _variable_name, ` +
      `${sourceCaseExpr} AS _value FROM ${escapedSourceTable}`
    );

    const targetCaseExpr = buildValueRemapCase(escapedTargetCol, mapping.valueMappings, 'target');
    unionParts.push(
      `SELECT 2 AS _wave, '${harmonizedName.replace(/'/g, "''")}' AS _variable_name, ` +
      `${targetCaseExpr} AS _value FROM ${escapedTargetTable}`
    );
  }

  return unionParts.join('\nUNION ALL\n');
}

function buildValueRemapCase(
  column: string,
  valueMappings: ValueMapping[],
  direction: 'source' | 'target'
): string {
  const relevantMappings = valueMappings.filter(
    m => direction === 'source'
      ? m.sourceValue !== null && m.targetValue !== null
      : m.targetValue !== null
  );

  if (relevantMappings.length === 0) return column;

  const whenClauses = relevantMappings.map(m => {
    if (direction === 'source') {
      return `WHEN ${column} = ${m.sourceValue} THEN ${m.targetValue}`;
    } else {
      return `WHEN ${column} = ${m.targetValue} THEN ${m.sourceValue ?? 'NULL'}`;
    }
  });

  return `CASE ${whenClauses.join(' ')} ELSE ${column} END`;
}

// ============================================================================
// Respondent Overlap Query
// ============================================================================

/**
 * Builds a query to estimate respondent overlap between two datasets
 * using a shared key column (e.g., respondent ID).
 */
export function buildRespondentOverlapQuery(
  sourceTable: string,
  targetTable: string,
  keyColumn: string
): string {
  const escapedSourceTable = escapeString(sourceTable);
  const escapedTargetTable = escapeString(targetTable);
  const escapedKey = `"${keyColumn.replace(/"/g, '""')}"`;

  return [
    `SELECT`,
    `  (SELECT COUNT(*) FROM ${escapedSourceTable}) AS total_source,`,
    `  (SELECT COUNT(*) FROM ${escapedTargetTable}) AS total_target,`,
    `  (`,
    `    SELECT COUNT(*) FROM ${escapedSourceTable} s`,
    `    INNER JOIN ${escapedTargetTable} t ON s.${escapedKey} = t.${escapedKey}`,
    `  ) AS overlap`,
  ].join('\n');
}
