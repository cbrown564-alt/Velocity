/**
 * Query Builder Unit Tests
 * 
 * Tests for pure SQL generation functions.
 */

import { describe, it, expect } from 'vitest';
import {
    buildCrosstabQuery,
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

            expect(sql).toContain('SUM("weight")::DOUBLE as count');
            expect(sql).not.toContain('COUNT(*)');
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

            expect(sql).toContain('(SUM("Age" * "weight") / SUM("weight"))::DOUBLE as mean');
            expect(sql).toContain('SQRT(ABS((SUM("weight" * "Age" * "Age") / SUM("weight")) - POWER(SUM("weight" * "Age") / SUM("weight"), 2)))::DOUBLE as stdDev');
            expect(sql).toContain('QUANTILE_CONT("Age", 0.5 ORDER BY "weight") as median');
        });

        it('builds an unweighted measure query for scale variables', () => {
            const sql = buildCrosstabQuery({
                rowVars: [],
                measureVar: 'Age',
                measureLabel: 'Age'
            });

            expect(sql).toContain('STDDEV("Age") as stdDev');
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
