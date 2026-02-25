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
export interface GridQueryOptions {
    columns: Array<{ name: string; label: string }>;
    filters?: Filter[];
    weightVar?: string;
    colVar?: string | null;
    aggregate?: boolean;
}

export function buildGridQuery(options: GridQueryOptions): string {
    const { columns, filters, weightVar, colVar, aggregate } = options;

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

    // 4. Metric Aggregation vs Frequency
    let selectClause = '';
    let groupByClause = '';

    if (aggregate) {
        // Metric Mode: Group by Item, Aggregate Value
        const colGroup = colVar ? `"${escapeIdentifier(colVar)}"` : `'Total'`;

        // When aggregating, we use 'item_label' as the ROW key (listing items down the side)
        // And the explicitly chosen colVar (e.g. Gender) as columns.
        // If no colVar, we essentially get a summary table of items.

        const w = weightVar ? `"${escapeIdentifier(weightVar)}"` : null;
        const val = `_synthetic_value`; // No cast needed if underlying is numeric
        const weightedDenom = w ? `SUM(CASE WHEN ${val} IS NOT NULL THEN ${w} ELSE 0 END)` : null;
        const weightedSumXW = w ? `SUM(CASE WHEN ${val} IS NOT NULL THEN ${val} * ${w} ELSE 0 END)` : null;
        const weightedSumX2W = w ? `SUM(CASE WHEN ${val} IS NOT NULL THEN ${val} * ${val} * ${w} ELSE 0 END)` : null;
        const weightedSumW2 = w ? `SUM(CASE WHEN ${val} IS NOT NULL THEN ${w} * ${w} ELSE 0 END)` : null;

        const statsExpr = w
            ? `
                (${weightedSumXW} / NULLIF(${weightedDenom}, 0))::DOUBLE as mean,
                SQRT(ABS((${weightedSumX2W} / NULLIF(${weightedDenom}, 0)) - POWER(${weightedSumXW} / NULLIF(${weightedDenom}, 0), 2)))::DOUBLE as stdDev,
                MIN(${val}) as min,
                MAX(${val}) as max,
                QUANTILE_CONT(${val}, 0.5 ORDER BY ${val}) as median,
                QUANTILE_CONT(${val}, 0.25 ORDER BY ${val}) as q1,
                QUANTILE_CONT(${val}, 0.75 ORDER BY ${val}) as q3,
                COUNT(${val})::INTEGER as validCount,
                COUNT(*)::INTEGER as count,
                ${weightedDenom}::DOUBLE as weightedCount,
                ${weightedSumW2}::DOUBLE as sumSqWeights,
                ${weightedSumXW}::DOUBLE as sumXW,
                ${weightedSumX2W}::DOUBLE as sumX2W
            `
            : `
                AVG(${val}) as mean,
                STDDEV_POP(${val}) as stdDev,
                MIN(${val}) as min,
                MAX(${val}) as max,
                MEDIAN(${val}) as median,
                QUANTILE_CONT(${val}, 0.25) as q1,
                QUANTILE_CONT(${val}, 0.75) as q3,
                COUNT(${val})::INTEGER as validCount,
                COUNT(*)::INTEGER as count
            `;

        selectClause = `
            item_label as rowKey_0,
            ${colGroup} as colKey,
            ${statsExpr}
        `;

        groupByClause = colVar
            ? `GROUP BY item_label, ${colGroup}`
            : `GROUP BY item_label, ${colGroup}`; // Total is constant, so just item_label is enough, but constant works too

    } else {
        // Frequency Mode: Group by Value and Item
        // This is the "Stacked Bar" view: 
        // Row = Value (1,2,3), Col = Item (Q1,Q2)
        // OR Row = Item, Col = Value ?
        // The original code did: _synthetic_value as rowKey_0 (Value is Row), item_label as colKey (Item is Column)
        // This produces columns of questions, with rows being "1", "2", "3".

        const weightedStatsExpr = weightVar
            ? `
            COUNT(*)::INTEGER as count,
            SUM("${escapeIdentifier(weightVar)}")::DOUBLE as weightedCount,
            SUM("${escapeIdentifier(weightVar)}" * "${escapeIdentifier(weightVar)}")::DOUBLE as sumSqWeights
        `
            : `COUNT(*)::INTEGER as count`;

        selectClause = `
            _synthetic_value as rowKey_0,
            item_label as colKey,
            ${weightedStatsExpr}
        `;
        groupByClause = `GROUP BY _synthetic_value, item_label`;
    }

    return `
        WITH unpivoted AS (
            SELECT
                main.*,
                items.item_label,
                items.item_index,
                CAST(${valueExpression} AS DOUBLE) as _synthetic_value
            FROM main
            CROSS JOIN (VALUES ${itemsValues}) as items(item_index, item_label)
        )
        SELECT
            ${selectClause}
        FROM unpivoted
        WHERE ${whereConditions.join(' AND ')}
        ${groupByClause}
    `;
}

export interface GridHistogramQueryOptions {
    columns: Array<{ name: string; label: string }>;
    filters?: Filter[];
    colVar?: string | null;
    minVal: number;
    maxVal: number;
    binCount: number;
}

export function buildGridHistogramQuery(options: GridHistogramQueryOptions): string {
    const { columns, filters, colVar, minVal, maxVal, binCount } = options;
    const range = maxVal - minVal;
    const binWidth = range > 0 ? range / binCount : 1;

    const itemsValues = columns
        .map(({ label }, index) => `(${index}, '${escapeString(label)}')`)
        .join(', ');

    const valueExpression = `
        CASE items.item_index
            ${columns.map(({ name }, index) => `WHEN ${index} THEN "${escapeIdentifier(name)}"`).join('\n            ')}
        END
    `;

    const filterClause = buildFilterClause(filters);
    const whereConditions = ['_synthetic_value IS NOT NULL'];
    if (filterClause) {
        whereConditions.push(filterClause);
    }

    const bucketExpr = `
        CASE
            WHEN ${range} = 0 THEN 1
            ELSE LEAST(FLOOR((_synthetic_value - ${minVal}) / ${binWidth}) + 1, ${binCount})::INTEGER
        END
    `;

    // Always include item_label in grouping (Rows)
    // If colVar is present, also group by it (Columns)
    const colGroup = colVar ? `"${escapeIdentifier(colVar)}"` : `'Total'`;

    // Rows = item_label, Cols = colKey
    const groupByCols = colVar ? `item_label, ${colGroup}, bucket` : `item_label, bucket`;

    return `
        WITH unpivoted AS (
            SELECT
                main.*,
                items.item_label,
                items.item_index,
                CAST(${valueExpression} AS DOUBLE) as _synthetic_value
            FROM main
            CROSS JOIN (VALUES ${itemsValues}) as items(item_index, item_label)
        )
        SELECT
            item_label as rowKey_0,
            ${colGroup} as colKey,
            ${bucketExpr} as bucket,
            COUNT(*) as cnt
        FROM unpivoted
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ${groupByCols}
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
    const statsExpr = weightVar
        ? `COUNT(*)::INTEGER as count, SUM("${escapeIdentifier(weightVar)}")::DOUBLE as weightedCount, SUM("${escapeIdentifier(weightVar)}" * "${escapeIdentifier(weightVar)}")::DOUBLE as sumSqWeights`
        : `COUNT(*)::INTEGER as count`;

    const colSelector = colVar
        ? `"${escapeIdentifier(colVar)}"`
        : `'Total'`;

    const groupByClause = colVar ? `GROUP BY ${colSelector}` : '';

    // Build UNION ALL query for each column, filtering by countedValue
    const unionParts = columns.map(({ name, label, countedValue }) => {
        const parts = [
            `SELECT '${escapeString(label)}' as rowKey_0, ${colSelector} as colKey, ${statsExpr}`,
            `FROM main`,
        ];

        const conditions: string[] = [];
        // Filter for counted value only
        conditions.push(`"${escapeIdentifier(name)}" = ${countedValue}`);
        if (whereClause) {
            conditions.push(whereClause);
        }

        parts.push(`WHERE ${conditions.join(' AND ')}`);
        if (groupByClause) {
            parts.push(groupByClause);
        }

        return parts.join(' ');
    });

    return unionParts.join(' UNION ALL ');
}

/**
 * Builds a query for multiple-response structure used as COLUMNS.
 *
 * Example:
 * Row variable = Gender, Column variable = Brand awareness MR set.
 * Output columns become MR items (Coke, Pepsi, ...), rows remain Gender categories.
 */
interface ColumnMultipleQueryOptions {
    rowVars: string[];
    columns: Array<{ name: string; label: string; countedValue: number }>;
    filters?: Filter[];
    weightVar?: string;
}

function buildColumnMultipleQuery(options: ColumnMultipleQueryOptions): string {
    const { rowVars, columns, filters, weightVar } = options;
    const whereClause = buildFilterClause(filters);

    const rowSelectors = rowVars.length > 0
        ? rowVars.map((r, i) => `"${escapeIdentifier(r)}" as rowKey_${i}`).join(', ')
        : `'Total' as rowKey_0`;

    const groupByCols = rowVars.map(r => `"${escapeIdentifier(r)}"`).join(', ');
    const groupByClause = groupByCols ? `GROUP BY ${groupByCols}` : '';

    const statsExpr = weightVar
        ? `COUNT(*)::INTEGER as count, SUM("${escapeIdentifier(weightVar)}")::DOUBLE as weightedCount, SUM("${escapeIdentifier(weightVar)}" * "${escapeIdentifier(weightVar)}")::DOUBLE as sumSqWeights`
        : `COUNT(*)::INTEGER as count`;

    const unionParts = columns.map(({ name, label, countedValue }) => {
        const parts = [
            `SELECT ${rowSelectors}, '${escapeString(label)}' as colKey, ${statsExpr}`,
            `FROM main`,
        ];

        const conditions: string[] = [`"${escapeIdentifier(name)}" = ${countedValue}`];
        if (whereClause) {
            conditions.push(whereClause);
        }

        parts.push(`WHERE ${conditions.join(' AND ')}`);
        if (groupByClause) {
            parts.push(groupByClause);
        }

        return parts.join(' ');
    });

    return unionParts.join(' UNION ALL ');
}

export interface OverlapQueryOptions {
    rowVars: string[];
    columns: Array<{ name: string; label: string; countedValue: number }>;
    filters?: Filter[];
    weightVar?: string;
}

/**
 * Builds pairwise overlap query for dependent-sample significance tests.
 *
 * Returns one row per (row group, column pair), with overlap counts for respondents
 * who selected both columns in a multi-response set.
 */
export function buildOverlapQuery(options: OverlapQueryOptions): string {
    const { rowVars, columns, filters, weightVar } = options;
    if (columns.length < 2) {
        return `SELECT 'Total' as rowKey_0, '' as colKeyA, '' as colKeyB, 0 as overlapCount WHERE 1 = 0`;
    }

    const whereClause = buildFilterClause(filters);
    const rowSelectors = rowVars.length > 0
        ? rowVars.map((r, i) => `"${escapeIdentifier(r)}" as rowKey_${i}`).join(', ')
        : `'Total' as rowKey_0`;

    const groupByCols = rowVars.map(r => `"${escapeIdentifier(r)}"`).join(', ');
    const groupByClause = groupByCols ? `GROUP BY ${groupByCols}` : '';

    const unionParts: string[] = [];

    for (let i = 0; i < columns.length; i++) {
        for (let j = i + 1; j < columns.length; j++) {
            const colA = columns[i];
            const colB = columns[j];
            const overlapCondition = `"${escapeIdentifier(colA.name)}" = ${colA.countedValue} AND "${escapeIdentifier(colB.name)}" = ${colB.countedValue}`;

            const overlapExpr = weightVar
                ? `SUM("${escapeIdentifier(weightVar)}") FILTER (WHERE ${overlapCondition})::DOUBLE as overlapCount,
                   SUM("${escapeIdentifier(weightVar)}" * "${escapeIdentifier(weightVar)}") FILTER (WHERE ${overlapCondition})::DOUBLE as overlapSumSqWeights`
                : `COUNT(*) FILTER (WHERE ${overlapCondition})::INTEGER as overlapCount`;

            const parts = [
                `SELECT ${rowSelectors}, '${escapeString(colA.label)}' as colKeyA, '${escapeString(colB.label)}' as colKeyB, ${overlapExpr}`,
                `FROM main`,
            ];

            if (whereClause) {
                parts.push(`WHERE ${whereClause}`);
            }
            if (groupByClause) {
                parts.push(groupByClause);
            }

            unionParts.push(parts.join(' '));
        }
    }

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
    /** For multiple structure used as column banner: MR columns become crosstab columns */
    columnMultipleColumns?: Array<{ name: string; label: string; countedValue: number }>;
    /** For scale variables: the variable to aggregate (Mean, Median, etc.) */
    measureVar?: string;
    /** Label to use for the measure row (e.g. "Age") */
    measureLabel?: string;
    /** If true, fetch histogram/distribution data (for Violin/Ridgeline/BoxPlot) */
    includeDistributions?: boolean;
    /** For grid structure: default to aggregating values (Mean) instead of counting frequencies */
    gridAggregate?: boolean;
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
        columnMultipleColumns,
        measureVar,
        measureLabel,
        gridAggregate
    } = options;

    // Special case: Grid structure (unpivot multiple columns)
    if (gridColumns && gridColumns.length > 0) {
        return buildGridQuery({ columns: gridColumns, filters, weightVar, colVar, aggregate: gridAggregate });
    }

    // Special case: Multiple structure used as columns (column banner)
    if (columnMultipleColumns && columnMultipleColumns.length > 0) {
        return buildColumnMultipleQuery({ rowVars, columns: columnMultipleColumns, filters, weightVar });
    }

    // Special case: Multiple structure (filtered by counted value)
    if (multipleColumns && multipleColumns.length > 0) {
        return buildMultipleQuery({ columns: multipleColumns, filters, weightVar, colVar });
    }

    // Validation
    if (rowVars.length === 0 && !measureVar && !(columnMultipleColumns && columnMultipleColumns.length > 0)) {
        throw new Error('At least one row variable or a measure variable is required');
    }

    // Build SELECT clause
    let rowSelectors = '';

    if (measureVar && measureLabel && rowVars.length === 0) {
        // Metric-only rows (Standard "Summary Table")
        // e.g. Mean Age
        rowSelectors = `'${escapeString(measureLabel)}' as rowKey_0`;
    } else {
        // Standard grouping by row variables
        // e.g. Gender -> Mean Age
        rowSelectors = rowVars.map((r, i) => `"${escapeIdentifier(r)}" as rowKey_${i}`).join(', ');
    }

    // Determine Column Selector
    let colSelector = '';

    if (colVar) {
        // Explicit Column Variable
        colSelector = `"${escapeIdentifier(colVar)}" as colKey`;
    } else if (measureVar && measureLabel && rowVars.length > 0) {
        // Implicit Measure Column (Profile Table)
        // We have row groups (Gender), but no col variable.
        // We are measuring 'Age'. So 'Age' becomes the column header 
        // to distinguish it from just "Total" count.
        colSelector = `'${escapeString(measureLabel)}' as colKey`;
    } else {
        // Default catch-all
        colSelector = `'Total' as colKey`;
    }

    // Aggregate based on whether we have a measure variable (Scale) or just counting (Nominal)
    let statsExpr = '';

    if (measureVar) {
        // Scale Variable Stats
        const col = `"${escapeIdentifier(measureVar)}"`;

        if (weightVar) {
            const w = `"${escapeIdentifier(weightVar)}"`;
            const weightedDenom = `SUM(CASE WHEN ${col} IS NOT NULL THEN ${w} ELSE 0 END)`;
            const weightedSumXW = `SUM(CASE WHEN ${col} IS NOT NULL THEN ${col} * ${w} ELSE 0 END)`;
            const weightedSumX2W = `SUM(CASE WHEN ${col} IS NOT NULL THEN ${col} * ${col} * ${w} ELSE 0 END)`;
            const weightedSumW2 = `SUM(CASE WHEN ${col} IS NOT NULL THEN ${w} * ${w} ELSE 0 END)`;
            // Weighted Mean: SUM(x * w) / SUM(w)
            // Weighted Variance: (SUM(w * x^2) / SUM(w)) - (SUM(w * x) / SUM(w))^2
            // Note: This is the biased weighted variance, suitable for large samples or when weights are relative.

            statsExpr = `
                (${weightedSumXW} / NULLIF(${weightedDenom}, 0))::DOUBLE as mean,
                SQRT(ABS((${weightedSumX2W} / NULLIF(${weightedDenom}, 0)) - POWER(${weightedSumXW} / NULLIF(${weightedDenom}, 0), 2)))::DOUBLE as stdDev,
                MIN(${col}) as min,
                MAX(${col}) as max,
                QUANTILE_CONT(${col}, 0.5 ORDER BY ${col}) as median,
                QUANTILE_CONT(${col}, 0.25 ORDER BY ${col}) as q1,
                QUANTILE_CONT(${col}, 0.75 ORDER BY ${col}) as q3,
                COUNT(${col})::INTEGER as validCount,
                COUNT(*)::INTEGER as count,
                ${weightedDenom}::DOUBLE as weightedCount,
                ${weightedSumW2}::DOUBLE as sumSqWeights,
                ${weightedSumXW}::DOUBLE as sumXW,
                ${weightedSumX2W}::DOUBLE as sumX2W
            `;
        } else {
            statsExpr = `
                AVG(${col}) as mean,
                STDDEV_POP(${col}) as stdDev,
                MIN(${col}) as min,
                MAX(${col}) as max,
                MEDIAN(${col}) as median,
                QUANTILE_CONT(${col}, 0.25) as q1,
                QUANTILE_CONT(${col}, 0.75) as q3,
                COUNT(${col})::INTEGER as validCount,
                COUNT(*)::INTEGER as count
            `;
        }
    } else {
        // Frequency Counts
        if (weightVar) {
            const w = `"${escapeIdentifier(weightVar)}"`;
            statsExpr = `
                COUNT(*)::INTEGER as count,
                SUM(${w})::DOUBLE as weightedCount, 
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
