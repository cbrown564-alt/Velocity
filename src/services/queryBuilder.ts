/**
 * Query Builder
 * 
 * Pure functions for generating DuckDB SQL queries.
 * Extracted from store for testability - no side effects.
 */

import type { Filter } from '../types';

// ============================================================================
// Crosstab / Frequency Queries
// ============================================================================

export interface CrosstabQueryOptions {
    rowVars: string[];
    colVar?: string | null;
    filters?: Filter[];
    weightVar?: string;
}

/**
 * Builds a crosstab or frequency SQL query.
 * 
 * @example Frequency (single row var, no col):
 * buildCrosstabQuery({ rowVars: ['Q1'] })
 * // SELECT "Q1" as rowKey_0, 'Total' as colKey, COUNT(*)::INTEGER as count FROM main GROUP BY "Q1"
 * 
 * @example Crosstab (row + col):
 * buildCrosstabQuery({ rowVars: ['Gender'], colVar: 'Region' })
 * // SELECT "Gender" as rowKey_0, "Region" as colKey, COUNT(*)::INTEGER as count FROM main GROUP BY "Gender", "Region"
 * 
 * @example Nested rows:
 * buildCrosstabQuery({ rowVars: ['Region', 'City'], colVar: 'Gender' })
 * // SELECT "Region" as rowKey_0, "City" as rowKey_1, "Gender" as colKey, COUNT(*)::INTEGER as count FROM main GROUP BY "Region", "City", "Gender"
 */
export function buildCrosstabQuery(options: CrosstabQueryOptions): string {
    const { rowVars, colVar, filters, weightVar } = options;

    if (rowVars.length === 0) {
        throw new Error('At least one row variable is required');
    }

    // Build SELECT clause
    const rowSelectors = rowVars.map((r, i) => `"${escapeIdentifier(r)}" as rowKey_${i}`).join(', ');
    const colSelector = colVar
        ? `"${escapeIdentifier(colVar)}" as colKey`
        : `'Total' as colKey`;

    // Aggregate based on whether we have a weight
    const countExpr = weightVar
        ? `SUM("${escapeIdentifier(weightVar)}")::DOUBLE as count`
        : `COUNT(*)::INTEGER as count`;

    // Build GROUP BY clause
    const rowGroups = rowVars.map(r => `"${escapeIdentifier(r)}"`).join(', ');
    const groupBy = colVar
        ? `${rowGroups}, "${escapeIdentifier(colVar)}"`
        : rowGroups;

    // Build WHERE clause if filters exist
    const whereClause = buildFilterClause(filters);

    const parts = [
        `SELECT ${rowSelectors}, ${colSelector}, ${countExpr}`,
        `FROM main`,
    ];

    if (whereClause) {
        parts.push(`WHERE ${whereClause}`);
    }

    parts.push(`GROUP BY ${groupBy}`);

    return parts.join(' ');
}

// ============================================================================
// Drill-Down Query
// ============================================================================

export interface DrillDownQueryOptions {
    rowVar: string;
    rowValue: string;
    colVar?: string | null;
    colValue?: string | null;
    limit?: number;
}

/**
 * Builds a drill-down query to fetch raw data for a specific cell.
 * 
 * @example Single variable:
 * buildDrillDownQuery({ rowVar: 'Gender', rowValue: 'Male' })
 * // SELECT * FROM main WHERE "Gender" = 'Male' LIMIT 100
 * 
 * @example With column:
 * buildDrillDownQuery({ rowVar: 'Gender', rowValue: 'Male', colVar: 'Region', colValue: 'North' })
 * // SELECT * FROM main WHERE "Gender" = 'Male' AND "Region" = 'North' LIMIT 100
 */
export function buildDrillDownQuery(options: DrillDownQueryOptions): string {
    const { rowVar, rowValue, colVar, colValue, limit = 100 } = options;

    const conditions: string[] = [
        `"${escapeIdentifier(rowVar)}" = '${escapeString(rowValue)}'`,
    ];

    if (colVar && colValue) {
        conditions.push(`"${escapeIdentifier(colVar)}" = '${escapeString(colValue)}'`);
    }

    return `SELECT * FROM main WHERE ${conditions.join(' AND ')} LIMIT ${limit}`;
}

// ============================================================================
// Filter Clause
// ============================================================================

/**
 * Builds a SQL WHERE clause from an array of filters.
 * Returns null if no filters are provided.
 */
export function buildFilterClause(filters?: Filter[]): string | null {
    if (!filters || filters.length === 0) {
        return null;
    }

    const conditions = filters.map(filter => {
        const col = `"${escapeIdentifier(filter.variableId)}"`;

        switch (filter.operator) {
            case 'eq':
                return `${col} = ${formatValue(filter.value)}`;
            case 'neq':
                return `${col} != ${formatValue(filter.value)}`;
            case 'gt':
                return `${col} > ${formatValue(filter.value)}`;
            case 'lt':
                return `${col} < ${formatValue(filter.value)}`;
            case 'in':
                if (!Array.isArray(filter.value)) {
                    throw new Error('IN operator requires an array value');
                }
                const values = filter.value.map(v => formatValue(v)).join(', ');
                return `${col} IN (${values})`;
            default:
                throw new Error(`Unknown operator: ${filter.operator}`);
        }
    });

    return conditions.join(' AND ');
}

// ============================================================================
// Unique Values Query
// ============================================================================

export interface UniqueValuesQueryOptions {
    column: string;
    limit?: number;
}

/**
 * Builds a query to get distinct values from a column.
 */
export function buildUniqueValuesQuery(options: UniqueValuesQueryOptions): string {
    const { column, limit = 50 } = options;
    return `SELECT DISTINCT "${escapeIdentifier(column)}" as val FROM main ORDER BY val LIMIT ${limit}`;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Escapes a SQL identifier (table/column name) to prevent injection.
 * Replaces quote characters that could break out of the identifier.
 */
export function escapeIdentifier(identifier: string): string {
    // Remove or escape double quotes
    return identifier.replace(/"/g, '""');
}

/**
 * Escapes a string value for use in SQL.
 * Escapes single quotes by doubling them.
 */
export function escapeString(value: string): string {
    return value.replace(/'/g, "''");
}

/**
 * Formats a value for SQL based on type.
 */
function formatValue(value: number | number[]): string {
    if (Array.isArray(value)) {
        return value.map(v => String(v)).join(', ');
    }
    return String(value);
}
