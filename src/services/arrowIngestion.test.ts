/**
 * Arrow Ingestion Unit Tests
 *
 * Tests for Apache Arrow table creation from parsed SAV data.
 * These tests verify the Arrow vectorization logic used before DuckDB insertion.
 */

import { describe, it, expect } from 'vitest';
import * as arrow from 'apache-arrow';

describe('Arrow Table Creation', () => {
  describe('vectorFromArray', () => {
    it('creates Float64 vector from numeric array', () => {
      const data = [1.0, 2.5, 3.14, 0, -100];
      const vector = arrow.vectorFromArray(data, new arrow.Float64());

      expect(vector.length).toBe(5);
      expect(vector.get(0)).toBe(1.0);
      expect(vector.get(1)).toBe(2.5);
      expect(vector.get(2)).toBeCloseTo(3.14);
      expect(vector.get(4)).toBe(-100);
    });

    it('creates Utf8 vector from string array', () => {
      const data = ['Hello', 'World', 'Test'];
      const vector = arrow.vectorFromArray(data, new arrow.Utf8());

      expect(vector.length).toBe(3);
      expect(vector.get(0)).toBe('Hello');
      expect(vector.get(1)).toBe('World');
      expect(vector.get(2)).toBe('Test');
    });

    it('handles null values in numeric array', () => {
      const data = [1.0, null, 3.0];
      const vector = arrow.vectorFromArray(data, new arrow.Float64());

      expect(vector.length).toBe(3);
      expect(vector.get(0)).toBe(1.0);
      expect(vector.get(1)).toBeNull();
      expect(vector.get(2)).toBe(3.0);
    });

    it('handles null values in string array', () => {
      const data = ['a', null, 'c'];
      const vector = arrow.vectorFromArray(data, new arrow.Utf8());

      expect(vector.length).toBe(3);
      expect(vector.get(0)).toBe('a');
      expect(vector.get(1)).toBeNull();
      expect(vector.get(2)).toBe('c');
    });

    it('handles empty array', () => {
      const data: number[] = [];
      const vector = arrow.vectorFromArray(data, new arrow.Float64());

      expect(vector.length).toBe(0);
    });
  });

  describe('Arrow Table', () => {
    it('creates table from vector dictionary', () => {
      const vectors: Record<string, arrow.Vector> = {
        id: arrow.vectorFromArray([1, 2, 3], new arrow.Float64()),
        name: arrow.vectorFromArray(['Alice', 'Bob', 'Charlie'], new arrow.Utf8()),
      };

      const table = new arrow.Table(vectors);

      expect(table.numRows).toBe(3);
      expect(table.numCols).toBe(2);
    });

    it('preserves column names in schema', () => {
      const vectors: Record<string, arrow.Vector> = {
        age: arrow.vectorFromArray([25, 30], new arrow.Float64()),
        gender: arrow.vectorFromArray(['M', 'F'], new arrow.Utf8()),
      };

      const table = new arrow.Table(vectors);
      const fieldNames = table.schema.fields.map((f) => f.name);

      expect(fieldNames).toContain('age');
      expect(fieldNames).toContain('gender');
    });

    it('handles mixed types correctly', () => {
      // Simulating SAV parsing output: variables with different types
      const columnsData = [
        [1, 2, 3], // numeric
        ['A', 'B', 'C'], // string
        [1.5, null, 3.5], // numeric with null
        [null, 'X', null], // string with nulls
      ];

      const variableMeta = [
        { name: 'id', type: 'numeric' as const },
        { name: 'code', type: 'string' as const },
        { name: 'score', type: 'numeric' as const },
        { name: 'label', type: 'string' as const },
      ];

      const vectors: Record<string, arrow.Vector> = {};
      variableMeta.forEach((v, i) => {
        const data = columnsData[i];
        if (v.type === 'numeric') {
          vectors[v.name] = arrow.vectorFromArray(data as (number | null)[], new arrow.Float64());
        } else {
          vectors[v.name] = arrow.vectorFromArray(data as (string | null)[], new arrow.Utf8());
        }
      });

      const table = new arrow.Table(vectors);

      expect(table.numRows).toBe(3);
      expect(table.numCols).toBe(4);
    });

    it('handles large datasets efficiently', () => {
      const numRows = 10000;
      const numericData = Array.from({ length: numRows }, (_, i) => i * 1.5);
      const stringData = Array.from({ length: numRows }, (_, i) => `row_${i}`);

      const start = performance.now();

      const vectors: Record<string, arrow.Vector> = {
        id: arrow.vectorFromArray(numericData, new arrow.Float64()),
        label: arrow.vectorFromArray(stringData, new arrow.Utf8()),
      };
      const table = new arrow.Table(vectors);

      const duration = performance.now() - start;
      const perfBudgetMs = process.env.CI ? 300 : 200;

      expect(table.numRows).toBe(numRows);
      // Runtime and host load can vary; enforce a conservative upper bound.
      expect(duration).toBeLessThan(perfBudgetMs);
    });
  });

  describe('SAV-like data transformation', () => {
    it('transforms row-major to column-major correctly', () => {
      // Simulating SAV parsing: data comes as rows, needs to be pivoted for Arrow
      const rows = [
        [1, 'Alice', 25],
        [2, 'Bob', 30],
        [3, 'Charlie', 35],
      ];
      const variableTypes = ['numeric', 'string', 'numeric'];

      const numRows = rows.length;
      const numCols = variableTypes.length;

      // Pivot to column-major
      const columnsData: any[][] = Array.from({ length: numCols }, () => new Array(numRows));
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          columnsData[c][r] = rows[r][c];
        }
      }

      // Verify pivot
      expect(columnsData[0]).toEqual([1, 2, 3]);
      expect(columnsData[1]).toEqual(['Alice', 'Bob', 'Charlie']);
      expect(columnsData[2]).toEqual([25, 30, 35]);

      // Create vectors
      const vectors: Record<string, arrow.Vector> = {
        id: arrow.vectorFromArray(columnsData[0], new arrow.Float64()),
        name: arrow.vectorFromArray(columnsData[1], new arrow.Utf8()),
        age: arrow.vectorFromArray(columnsData[2], new arrow.Float64()),
      };

      const table = new arrow.Table(vectors);
      expect(table.numRows).toBe(3);
    });
  });
});
