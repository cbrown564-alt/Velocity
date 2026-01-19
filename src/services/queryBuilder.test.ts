/**
 * Query Builder Unit Tests
 * 
 * Tests for pure SQL generation functions.
 */

import { describe, it, expect } from 'vitest';
import {
    buildCrosstabQuery,
    buildDrillDownQuery,
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
                'At least one row variable is required'
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
    });

    // ==========================================================================
    // buildDrillDownQuery
    // ==========================================================================

    describe('buildDrillDownQuery', () => {
        it('builds a basic drill-down query', () => {
            const sql = buildDrillDownQuery({ rowVar: 'Gender', rowValue: 'Male' });

            expect(sql).toBe(`SELECT * FROM main WHERE "Gender" = 'Male' LIMIT 100`);
        });

        it('includes column filter when provided', () => {
            const sql = buildDrillDownQuery({
                rowVar: 'Gender',
                rowValue: 'Male',
                colVar: 'Region',
                colValue: 'North',
            });

            expect(sql).toBe(
                `SELECT * FROM main WHERE "Gender" = 'Male' AND "Region" = 'North' LIMIT 100`
            );
        });

        it('respects custom limit', () => {
            const sql = buildDrillDownQuery({ rowVar: 'Gender', rowValue: 'Male', limit: 50 });

            expect(sql).toContain('LIMIT 50');
        });

        it('escapes single quotes in values', () => {
            const sql = buildDrillDownQuery({ rowVar: 'Name', rowValue: "O'Brien" });

            expect(sql).toContain("'O''Brien'"); // Escaped single quote
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
