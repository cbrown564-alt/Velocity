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

/**
 * Builds a query for grid structure (unpivots multiple columns with shared scale)
 */
interface GridQueryOptions {
    columns: Array<{ name: string; label: string }>;
    filters?: Filter[];
    weightVar?: string;
    colVar?: string | null;
}

function buildGridQuery(options: GridQueryOptions): string {
    const { columns, filters, weightVar, colVar } = options;

    // Use a CTE to unpivot the data once, instead of UNION ALL
    // This allows access to all other columns for filtering/grouping

    // 1. Build the items lookup table using VALUES
    const itemsValues = columns
        .map(({ label }, index) => `(${index}, '${escapeString(label)}')`)
        .join(', ');

    // 2. Build the CASE WHEN expression to extract values
    const valueExpression = `
        CASE items.item_index
            ${columns.map(({ name }, index) => `WHEN ${index} THEN "${escapeIdentifier(name)}"`).join('\n            ')}
        END
    `;

    // 3. Build the WHERE clause for global filters
    const filterClause = buildFilterClause(filters);
    const whereConditions = ['_synthetic_value IS NOT NULL']; // Filter NULLs from unpivoted CTE
    if (filterClause) {
        whereConditions.push(filterClause);
    }

    const countExpr = weightVar
        ? `SUM("${escapeIdentifier(weightVar)}")::DOUBLE`
        : `COUNT(*)::INTEGER`;

    return `
        WITH unpivoted AS (
            SELECT
                main.*,
                items.item_label,
                ${valueExpression} as _synthetic_value
            FROM main
            CROSS JOIN (VALUES ${itemsValues}) as items(item_index, item_label)
        )
        SELECT
            item_label as rowKey_0,
            _synthetic_value as colKey,
            ${countExpr} as count
        FROM unpivoted
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY item_label, _synthetic_value
    `;
}

/**
 * Builds a query for multiple structure (shows only counted value for each variable)
 */
interface MultipleQueryOptions {
    columns: Array<{ name: string; label: string; countedValue: number }>;
    filters?: Filter[];
    weightVar?: string;
    colVar?: string | null;
}

function buildMultipleQuery(options: MultipleQueryOptions): string {
    const { columns, filters, weightVar, colVar } = options;

    const whereClause = buildFilterClause(filters);
    const countExpr = weightVar
        ? `SUM("${escapeIdentifier(weightVar)}")::DOUBLE`
        : `COUNT(*)::INTEGER`;

    // Build UNION ALL query for each column, filtering by countedValue
    const unionParts = columns.map(({ name, label, countedValue }) => {
        const parts = [
            `SELECT '${escapeString(label)}' as rowKey_0, 'Total' as colKey, ${countExpr} as count`,
            `FROM main`,
        ];

        const conditions: string[] = [];
        // Filter for counted value only
        conditions.push(`"${escapeIdentifier(name)}" = ${countedValue}`);
        if (whereClause) {
            conditions.push(whereClause);
        }

        parts.push(`WHERE ${conditions.join(' AND ')}`);

        return parts.join(' ');
    });

    return unionParts.join(' UNION ALL ');
}

export interface CrosstabQueryOptions {
    rowVars: string[];
    colVar?: string | null;
    filters?: Filter[];
    weightVar?: string;
    /** For grid structure: array of columns with names and labels to unpivot */
    gridColumns?: Array<{ name: string; label: string }>;
    /** For multiple structure: column names, labels, and their counted value */
    multipleColumns?: Array<{ name: string; label: string; countedValue: number }>;
    /** For scale variables: the variable to aggregate (Mean, Median, etc.) */
    measureVar?: string;
    /** Label to use for the measure row (e.g. "Age") */
    measureLabel?: string;
    /** If true, fetch histogram/distribution data (for Violin/Ridgeline/BoxPlot) */
    includeDistributions?: boolean;
}

/**
 * Builds a crosstab or frequency SQL query.
 *
 * @example Frequency (single row var, no col):
 * buildCrosstabQuery({ rowVars: ['Q1'] })
 * // SELECT "Q1" as rowKey_0, 'Total' as colKey, COUNT(*)::INTEGER as count FROM main GROUP BY "Q1"
 *
 * @example Metric Table (Mean of Scale Var by Col):
 * buildCrosstabQuery({ rowVars: [], colVar: 'Gender', measureVar: 'Age', measureLabel: 'Age' })
 * // SELECT 'Age' as rowKey_0, "Gender" as colKey, AVG("Age") as mean, ... FROM main GROUP BY "Gender"
 */
export function buildCrosstabQuery(options: CrosstabQueryOptions): string {
    const {
        rowVars,
        colVar,
        filters,
        weightVar,
        gridColumns,
        multipleColumns,
        measureVar,
        measureLabel
    } = options;

    // Special case: Grid structure (unpivot multiple columns)
    if (gridColumns && gridColumns.length > 0) {
        return buildGridQuery({ columns: gridColumns, filters, weightVar, colVar });
    }

    // Special case: Multiple structure (filtered by counted value)
    if (multipleColumns && multipleColumns.length > 0) {
        return buildMultipleQuery({ columns: multipleColumns, filters, weightVar, colVar });
    }

    // Validation
    if (rowVars.length === 0 && !measureVar) {
        throw new Error('At least one row variable or a measure variable is required');
    }

    // Build SELECT clause
    let rowSelectors = '';

    if (measureVar && measureLabel) {
        // If measuring a scale variable, the "row" is just the label of that variable
        rowSelectors = `'${escapeString(measureLabel)}' as rowKey_0`;
    } else {
        // Standard grouping by row variables
        rowSelectors = rowVars.map((r, i) => `"${escapeIdentifier(r)}" as rowKey_${i}`).join(', ');
    }

    const colSelector = colVar
        ? `"${escapeIdentifier(colVar)}" as colKey`
        : `'Total' as colKey`;

    // Aggregate based on whether we have a measure variable (Scale) or just counting (Nominal)
    let statsExpr = '';

    if (measureVar) {
        // Scale Variable Stats
        const col = `"${escapeIdentifier(measureVar)}"`;
        // Weighting for means is complex (weighted avg), simple AVG for now.
        // TODO: Implement proper weighted mean/stddev if weightVar is present
        statsExpr = `
            AVG(${col}) as mean,
            STDDEV(${col}) as stdDev,
            MIN(${col}) as min,
            MAX(${col}) as max,
            MEDIAN(${col}) as median,
            QUANTILE_CONT(${col}, 0.25) as q1,
            QUANTILE_CONT(${col}, 0.75) as q3,
            COUNT(${col})::INTEGER as validCount,
            COUNT(*)::INTEGER as count
        `;

        // Add ESS components if weighted
        if (weightVar) {
            const w = `"${escapeIdentifier(weightVar)}"`;
            statsExpr += `, SUM(${w} * ${w})::DOUBLE as sumSqWeights`;
        }
    } else {
        // Frequency Counts
        if (weightVar) {
            const w = `"${escapeIdentifier(weightVar)}"`;
            statsExpr = `
                SUM(${w})::DOUBLE as count, 
                SUM(${w} * ${w})::DOUBLE as sumSqWeights
            `;
        } else {
            statsExpr = `COUNT(*)::INTEGER as count`;
        }
    }

    // Build GROUP BY clause
    let groupBy = '';

    if (measureVar) {
        // When aggregating a measure, we usually group by row variables + column variable
        // The previous logic incorrectly cleared grouping for measure variables

        const rowGroups = rowVars.map(r => `"${escapeIdentifier(r)}"`).join(', ');
        const colGroup = colVar ? `"${escapeIdentifier(colVar)}"` : '';

        const groups = [rowGroups, colGroup].filter(Boolean).join(', ');
        groupBy = groups ? `GROUP BY ${groups}` : '';
    } else {
        // Standard Crosstab Grouping
        const rowGroups = rowVars.map(r => `"${escapeIdentifier(r)}"`).join(', ');
        groupBy = `GROUP BY ${colVar ? `${rowGroups}, "${escapeIdentifier(colVar)}"` : rowGroups}`;
    }

    // Build WHERE clause if filters exist
    const whereClause = buildFilterClause(filters);

    const parts = [
        `SELECT ${rowSelectors}, ${colSelector}, ${statsExpr}`,
        `FROM main`,
    ];

    if (whereClause) {
        parts.push(`WHERE ${whereClause}`);
    }

    if (groupBy) {
        parts.push(groupBy);
    }

    return parts.join(' ');
}

// ============================================================================
// Drill-Down Query
// ============================================================================

export interface DrillDownQueryOptions {
    /** Row variable(s) - supports nested rows as array */
    rowVars: { variable: string; value: string }[];
    colVar?: string | null;
    colValue?: string | null;
    /** Global filters to apply */
    filters?: Filter[];
    limit?: number;
    offset?: number;
}

/**
 * Builds a drill-down query to fetch raw data for a specific cell.
 * Supports nested row variables, global filters, and pagination.
 * 
 * @example Single variable:
 * buildDrillDownQuery({ rowVars: [{ variable: 'Gender', value: 'Male' }] })
 * // SELECT * FROM main WHERE "Gender" = 'Male' LIMIT 100 OFFSET 0
 * 
 * @example Nested rows with column:
 * buildDrillDownQuery({ 
 *   rowVars: [{ variable: 'Region', value: 'North' }, { variable: 'City', value: 'NYC' }],
 *   colVar: 'Gender', 
 *   colValue: 'Male' 
 * })
 * // SELECT * FROM main WHERE "Region" = 'North' AND "City" = 'NYC' AND "Gender" = 'Male' LIMIT 100 OFFSET 0
 * 
 * @example With pagination:
 * buildDrillDownQuery({ rowVars: [{ variable: 'Gender', value: 'Male' }], limit: 50, offset: 100 })
 * // SELECT * FROM main WHERE "Gender" = 'Male' LIMIT 50 OFFSET 100
 */
export function buildDrillDownQuery(options: DrillDownQueryOptions): string {
    const { rowVars, colVar, colValue, filters, limit = 100, offset = 0 } = options;

    const conditions: string[] = [];

    // Add row variable conditions
    for (const row of rowVars) {
        conditions.push(`"${escapeIdentifier(row.variable)}" = '${escapeString(row.value)}'`);
    }

    // Add column variable condition
    if (colVar && colValue) {
        conditions.push(`"${escapeIdentifier(colVar)}" = '${escapeString(colValue)}'`);
    }

    // Add global filter conditions
    const filterClause = buildFilterClause(filters);
    if (filterClause) {
        conditions.push(filterClause);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return `SELECT * FROM main ${whereClause} LIMIT ${limit} OFFSET ${offset}`;
}

/**
 * Builds a count query for drill-down pagination.
 * Returns total matching records without limit/offset.
 */
export function buildDrillDownCountQuery(options: Omit<DrillDownQueryOptions, 'limit' | 'offset'>): string {
    const { rowVars, colVar, colValue, filters } = options;

    const conditions: string[] = [];

    // Add row variable conditions
    for (const row of rowVars) {
        conditions.push(`"${escapeIdentifier(row.variable)}" = '${escapeString(row.value)}'`);
    }

    // Add column variable condition
    if (colVar && colValue) {
        conditions.push(`"${escapeIdentifier(colVar)}" = '${escapeString(colValue)}'`);
    }

    // Add global filter conditions
    const filterClause = buildFilterClause(filters);
    if (filterClause) {
        conditions.push(filterClause);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return `SELECT COUNT(*) as total FROM main ${whereClause}`;
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
 * Strings are quoted with single quotes, numbers are left as-is.
 */
function formatValue(value: number | string | (number | string)[]): string {
    if (Array.isArray(value)) {
        return value.map(v => formatSingleValue(v)).join(', ');
    }
    return formatSingleValue(value);
}

/**
 * Formats a single value for SQL.
 */
function formatSingleValue(value: number | string): string {
    if (typeof value === 'string') {
        return `'${escapeString(value)}'`;
    }
    return String(value);
}
