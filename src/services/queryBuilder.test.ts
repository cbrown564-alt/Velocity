/**
 * Query Builder Unit Tests
 * 
 * Tests for pure SQL generation functions.
 */

import { describe, it, expect } from 'vitest';
import {
    buildCrosstabQuery,
    buildOverlapQuery,
    buildDrillDownQuery,
    buildDrillDownCountQuery,
    buildFilterClause,
    buildUniqueValuesQuery,
    escapeIdentifier,
    escapeString,
} from './queryBuilder';
import type { Filter } from '../types';

describe('queryBuilder', () => {
    // ==========================================================================
    // buildCrosstabQuery
    // ==========================================================================

    describe('buildCrosstabQuery', () => {
        it('builds a frequency query for single row variable', () => {
            const sql = buildCrosstabQuery({ rowVars: ['Gender'] });

            expect(sql).toBe(
                `SELECT "Gender" as rowKey_0, 'Total' as colKey, COUNT(*)::INTEGER as count FROM main GROUP BY "Gender"`
            );
        });

        it('builds a crosstab query with row and column', () => {
            const sql = buildCrosstabQuery({ rowVars: ['Gender'], colVar: 'Region' });

            expect(sql).toBe(
                `SELECT "Gender" as rowKey_0, "Region" as colKey, COUNT(*)::INTEGER as count FROM main GROUP BY "Gender", "Region"`
            );
        });

        it('supports multiple row variables (nested)', () => {
            const sql = buildCrosstabQuery({ rowVars: ['Region', 'City'], colVar: 'Gender' });

            expect(sql).toContain('"Region" as rowKey_0');
            expect(sql).toContain('"City" as rowKey_1');
            expect(sql).toContain('GROUP BY "Region", "City", "Gender"');
        });

        it('applies weight variable when provided', () => {
            const sql = buildCrosstabQuery({
                rowVars: ['Gender'],
                colVar: 'Region',
                weightVar: 'weight',
            });

            expect(sql).toContain('COUNT(*)::INTEGER as count');
            expect(sql).toContain('SUM("weight")::DOUBLE as weightedCount');
            expect(sql).toContain('SUM("weight" * "weight")::DOUBLE as sumSqWeights');
        });

        it('throws error when no row variables provided', () => {
            expect(() => buildCrosstabQuery({ rowVars: [] })).toThrow(
                'At least one row variable or a measure variable is required'
            );
        });

        it('includes WHERE clause when filters are provided', () => {
            const filters: Filter[] = [
                { id: 'f1', variableId: 'Age', operator: 'gt', value: 18 },
            ];

            const sql = buildCrosstabQuery({ rowVars: ['Gender'], filters });

            expect(sql).toContain('WHERE "Age" > 18');
        });

        it('combines filters with additional WHERE conditions', () => {
            const filters: Filter[] = [
                { id: 'f1', variableId: 'Age', operator: 'gt', value: 18 },
            ];

            const sql = buildCrosstabQuery({
                rowVars: ['Gender'],
                filters,
                additionalWhere: 'NOT ("Gender" IS NULL)',
            });

            expect(sql).toContain('WHERE "Age" > 18 AND NOT ("Gender" IS NULL)');
        });

        it('escapes identifiers with special characters', () => {
            const sql = buildCrosstabQuery({ rowVars: ['Q1"a'] });

            expect(sql).toContain('"Q1""a"'); // Escaped double quote
        });

        it('builds a grid unpivot query using CTE and CASE WHEN', () => {
            const sql = buildCrosstabQuery({
                rowVars: [],
                gridColumns: [
                    { name: 'q1_a', label: 'Product A' },
                    { name: 'q1_b', label: 'Product B' }
                ]
            });

            // Verify CTE structure
            expect(sql).toContain('WITH unpivoted AS');
            expect(sql).toContain('CROSS JOIN (VALUES');

            // Verify VALUES clause
            expect(sql).toContain("(0, 'Product A')");
            expect(sql).toContain("(1, 'Product B')");

            // Verify CASE WHEN unpivoting
            expect(sql).toContain('CASE items.item_index');
            expect(sql).toContain('WHEN 0 THEN "q1_a"');
            expect(sql).toContain('WHEN 1 THEN "q1_b"');

            // Verify NOT NULL filter construction
            expect(sql).toContain('WHERE _synthetic_value IS NOT NULL');

            // Verify final selection
            expect(sql).toContain('item_label as colKey');
            expect(sql).toContain('_synthetic_value as rowKey_0');
        });

        it('includes sumSqWeights for weighted grid aggregation', () => {
            const sql = buildCrosstabQuery({
                rowVars: [],
                gridColumns: [
                    { name: 'q1_a', label: 'Product A' },
                    { name: 'q1_b', label: 'Product B' },
                ],
                weightVar: 'weight',
                gridAggregate: true,
            });

            expect(sql).toContain('SUM(CASE WHEN _synthetic_value IS NOT NULL THEN "weight" * "weight" ELSE 0 END)::DOUBLE as sumSqWeights');
            expect(sql).toContain('item_label as rowKey_0');
        });

        it('includes main table columns in grid CTE for filtering', () => {
            const sql = buildCrosstabQuery({
                rowVars: [],
                gridColumns: [{ name: 'q1_a', label: 'Product A' }],
                filters: [{ id: 'f1', variableId: 'Gender', operator: 'eq', value: 'Male' }]
            });

            expect(sql).toContain('main.*'); // Must select main columns
            expect(sql).toContain('"Gender" = \'Male\''); // Filter applied in main query
        });

        it('builds a weighted measure query for scale variables', () => {
            const sql = buildCrosstabQuery({
                rowVars: [],
                measureVar: 'Age',
                measureLabel: 'Age',
                weightVar: 'weight'
            });

            expect(sql).toContain('(SUM(CASE WHEN "Age" IS NOT NULL THEN "Age" * "weight" ELSE 0 END) / NULLIF(SUM(CASE WHEN "Age" IS NOT NULL THEN "weight" ELSE 0 END), 0))::DOUBLE as mean');
            expect(sql).toContain('SQRT(ABS((SUM(CASE WHEN "Age" IS NOT NULL THEN "Age" * "Age" * "weight" ELSE 0 END) / NULLIF(SUM(CASE WHEN "Age" IS NOT NULL THEN "weight" ELSE 0 END), 0)) - POWER(SUM(CASE WHEN "Age" IS NOT NULL THEN "Age" * "weight" ELSE 0 END) / NULLIF(SUM(CASE WHEN "Age" IS NOT NULL THEN "weight" ELSE 0 END), 0), 2)))::DOUBLE as stdDev');
            expect(sql).toContain('SUM(CASE WHEN "Age" IS NOT NULL THEN "weight" ELSE 0 END)::DOUBLE as weightedCount');
            expect(sql).toContain('QUANTILE_CONT("Age", 0.5 ORDER BY "Age") as median');
        });

        it('uses valid-only weighted denominators for measure variables', () => {
            const sql = buildCrosstabQuery({
                rowVars: ['Gender'],
                colVar: 'Region',
                measureVar: 'Age',
                measureLabel: 'Age',
                weightVar: 'weight',
            });

            expect(sql).toContain('SUM(CASE WHEN "Age" IS NOT NULL THEN "weight" ELSE 0 END)');
            expect(sql).toContain('SUM(CASE WHEN "Age" IS NOT NULL THEN "Age" * "weight" ELSE 0 END)');
            expect(sql).toContain('SUM(CASE WHEN "Age" IS NOT NULL THEN "Age" * "Age" * "weight" ELSE 0 END)');
        });

        it('builds an unweighted measure query for scale variables', () => {
            const sql = buildCrosstabQuery({
                rowVars: [],
                measureVar: 'Age',
                measureLabel: 'Age'
            });

            expect(sql).toContain('STDDEV_POP("Age") as stdDev');
        });

        it('builds a profile grid query (Row Dim + Measure Metric in Col)', () => {
            const sql = buildCrosstabQuery({
                rowVars: ['Gender'],
                measureVar: 'Age',
                measureLabel: 'Mean Age'
            });

            // Row should be Gender
            expect(sql).toContain('"Gender" as rowKey_0');
            // Column should be the Measure Label
            expect(sql).toContain("'Mean Age' as colKey");
            // Group by Gender
            expect(sql).toContain('GROUP BY "Gender"');
            // Should contain aggregation
            expect(sql).toContain('AVG("Age") as mean');
        });

        it('builds a multiple-response query with column variable', () => {
            const sql = buildCrosstabQuery({
                rowVars: [],
                colVar: 'Region',
                multipleColumns: [
                    { name: 'Q1_A', label: 'Option A', countedValue: 1 },
                    { name: 'Q1_B', label: 'Option B', countedValue: 1 },
                ],
            });

            expect(sql).toContain('SELECT \'Option A\' as rowKey_0, "Region" as colKey');
            expect(sql).toContain('WHERE "Q1_A" = 1');
            expect(sql).toContain('GROUP BY "Region"');
            expect(sql).toContain('UNION ALL');
        });

        it('builds a multiple-response column-banner query', () => {
            const sql = buildCrosstabQuery({
                rowVars: ['Gender'],
                colVar: null,
                columnMultipleColumns: [
                    { name: 'Q5_1', label: 'Coke', countedValue: 1 },
                    { name: 'Q5_2', label: 'Pepsi', countedValue: 1 },
                ],
            });

            expect(sql).toContain(`SELECT "Gender" as rowKey_0, 'Coke' as colKey`);
            expect(sql).toContain('WHERE "Q5_1" = 1');
            expect(sql).toContain('GROUP BY "Gender"');
            expect(sql).toContain('UNION ALL');
        });
    });

    describe('buildOverlapQuery', () => {
        it('builds overlap SQL for a 3-item MR set', () => {
            const sql = buildOverlapQuery({
                rowVars: ['Gender'],
                columns: [
                    { name: 'Q5_1', label: 'Coke', countedValue: 1 },
                    { name: 'Q5_2', label: 'Pepsi', countedValue: 1 },
                    { name: 'Q5_3', label: 'Fanta', countedValue: 1 },
                ],
            });

            expect(sql).toContain(`'Coke' as colKeyA`);
            expect(sql).toContain(`'Pepsi' as colKeyB`);
            expect(sql).toContain(`COUNT(*) FILTER (WHERE "Q5_1" = 1 AND "Q5_2" = 1)::INTEGER as overlapCount`);
            expect(sql).toContain('GROUP BY "Gender"');
            expect(sql).toContain('UNION ALL');
        });

        it('builds weighted overlap SQL with overlapSumSqWeights', () => {
            const sql = buildOverlapQuery({
                rowVars: ['Region'],
                columns: [
                    { name: 'Q5_1', label: 'Coke', countedValue: 1 },
                    { name: 'Q5_2', label: 'Pepsi', countedValue: 1 },
                ],
                weightVar: 'weight',
            });

            expect(sql).toContain('SUM("weight") FILTER (WHERE "Q5_1" = 1 AND "Q5_2" = 1)::DOUBLE as overlapCount');
            expect(sql).toContain('SUM("weight" * "weight") FILTER (WHERE "Q5_1" = 1 AND "Q5_2" = 1)::DOUBLE as overlapSumSqWeights');
        });
    });

    // ==========================================================================
    // buildDrillDownQuery
    // ==========================================================================

    describe('buildDrillDownQuery', () => {
        it('builds a basic drill-down query with single row variable', () => {
            const sql = buildDrillDownQuery({
                rowVars: [{ variable: 'Gender', value: 'Male' }]
            });

            expect(sql).toBe(`SELECT * FROM main WHERE "Gender" = 'Male' LIMIT 100 OFFSET 0`);
        });

        it('includes column filter when provided', () => {
            const sql = buildDrillDownQuery({
                rowVars: [{ variable: 'Gender', value: 'Male' }],
                colVar: 'Region',
                colValue: 'North',
            });

            expect(sql).toBe(
                `SELECT * FROM main WHERE "Gender" = 'Male' AND "Region" = 'North' LIMIT 100 OFFSET 0`
            );
        });

        it('supports multiple row variables (nested)', () => {
            const sql = buildDrillDownQuery({
                rowVars: [
                    { variable: 'Region', value: 'North' },
                    { variable: 'City', value: 'NYC' },
                ],
                colVar: 'Gender',
                colValue: 'Male',
            });

            expect(sql).toContain(`"Region" = 'North'`);
            expect(sql).toContain(`"City" = 'NYC'`);
            expect(sql).toContain(`"Gender" = 'Male'`);
        });

        it('respects custom limit and offset for pagination', () => {
            const sql = buildDrillDownQuery({
                rowVars: [{ variable: 'Gender', value: 'Male' }],
                limit: 50,
                offset: 100
            });

            expect(sql).toContain('LIMIT 50');
            expect(sql).toContain('OFFSET 100');
        });

        it('escapes single quotes in values', () => {
            const sql = buildDrillDownQuery({
                rowVars: [{ variable: 'Name', value: "O'Brien" }]
            });

            expect(sql).toContain("'O''Brien'"); // Escaped single quote
        });
    });

    describe('buildDrillDownCountQuery', () => {
        it('builds a count query without limit/offset', () => {
            const sql = buildDrillDownCountQuery({
                rowVars: [{ variable: 'Gender', value: 'Male' }]
            });

            expect(sql).toBe(`SELECT COUNT(*) as total FROM main WHERE "Gender" = 'Male'`);
        });

        it('includes all filters in count query', () => {
            const sql = buildDrillDownCountQuery({
                rowVars: [{ variable: 'Region', value: 'North' }],
                colVar: 'Gender',
                colValue: 'Male',
            });

            expect(sql).toContain(`"Region" = 'North'`);
            expect(sql).toContain(`"Gender" = 'Male'`);
            expect(sql).not.toContain('LIMIT');
            expect(sql).not.toContain('OFFSET');
        });
    });

    // ==========================================================================
    // buildFilterClause
    // ==========================================================================

    describe('buildFilterClause', () => {
        it('returns null for empty filters', () => {
            expect(buildFilterClause([])).toBeNull();
            expect(buildFilterClause(undefined)).toBeNull();
        });

        it('handles eq operator', () => {
            const filters: Filter[] = [
                { id: 'f1', variableId: 'Gender', operator: 'eq', value: 1 },
            ];

            expect(buildFilterClause(filters)).toBe('"Gender" = 1');
        });

        it('handles neq operator', () => {
            const filters: Filter[] = [
                { id: 'f1', variableId: 'Gender', operator: 'neq', value: 1 },
            ];

            expect(buildFilterClause(filters)).toBe('"Gender" != 1');
        });

        it('handles gt operator', () => {
            const filters: Filter[] = [
                { id: 'f1', variableId: 'Age', operator: 'gt', value: 18 },
            ];

            expect(buildFilterClause(filters)).toBe('"Age" > 18');
        });

        it('handles lt operator', () => {
            const filters: Filter[] = [
                { id: 'f1', variableId: 'Age', operator: 'lt', value: 65 },
            ];

            expect(buildFilterClause(filters)).toBe('"Age" < 65');
        });

        it('handles in operator with array', () => {
            const filters: Filter[] = [
                { id: 'f1', variableId: 'Status', operator: 'in', value: [1, 2, 3] },
            ];

            expect(buildFilterClause(filters)).toBe('"Status" IN (1, 2, 3)');
        });

        it('throws error for in operator without array', () => {
            const filters: Filter[] = [
                { id: 'f1', variableId: 'Status', operator: 'in', value: 1 },
            ];

            expect(() => buildFilterClause(filters)).toThrow('IN operator requires an array value');
        });

        it('combines multiple filters with AND', () => {
            const filters: Filter[] = [
                { id: 'f1', variableId: 'Age', operator: 'gt', value: 18 },
                { id: 'f2', variableId: 'Gender', operator: 'eq', value: 1 },
            ];

            expect(buildFilterClause(filters)).toBe('"Age" > 18 AND "Gender" = 1');
        });
    });

    // ==========================================================================
    // buildUniqueValuesQuery
    // ==========================================================================

    describe('buildUniqueValuesQuery', () => {
        it('builds a unique values query with default limit', () => {
            const sql = buildUniqueValuesQuery({ column: 'Gender' });

            expect(sql).toBe('SELECT DISTINCT "Gender" as val FROM main ORDER BY val LIMIT 50');
        });

        it('respects custom limit', () => {
            const sql = buildUniqueValuesQuery({ column: 'Gender', limit: 100 });

            expect(sql).toContain('LIMIT 100');
        });
    });

    // ==========================================================================
    // Helper Functions
    // ==========================================================================

    describe('escapeIdentifier', () => {
        it('doubles double quotes', () => {
            expect(escapeIdentifier('col"name')).toBe('col""name');
        });

        it('leaves normal identifiers unchanged', () => {
            expect(escapeIdentifier('Gender')).toBe('Gender');
        });
    });

    describe('escapeString', () => {
        it('doubles single quotes', () => {
            expect(escapeString("O'Brien")).toBe("O''Brien");
        });

        it('leaves normal strings unchanged', () => {
            expect(escapeString('Hello')).toBe('Hello');
        });
    });
});
