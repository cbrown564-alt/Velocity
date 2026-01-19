/**
 * DuckDB-WASM Arrow Integration Tests
 * 
 * These tests verify that Arrow tables can be inserted into DuckDB-WASM
 * and queried correctly. This is a critical path for the app's performance.
 * 
 * IMPORTANT: These tests require a REAL browser environment and are skipped
 * in vitest/happy-dom because WASM Workers don't work in the test environment.
 * 
 * To run these tests, use the browser verification steps in the implementation plan:
 * 1. npm run dev
 * 2. Load test_data/sleep.sav
 * 3. Check console for "Arrow table inserted successfully"
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as duckdb from '@duckdb/duckdb-wasm';
import * as arrow from 'apache-arrow';

// These tests are ALWAYS skipped in vitest because happy-dom's Worker
// polyfill doesn't support the full Worker API required by DuckDB WASM.
// Use browser manual testing instead.
const describeBrowserOnly = describe.skip;

// Increase timeout for WASM loading
const WASM_TIMEOUT = 30000;

describeBrowserOnly('DuckDB-WASM Arrow Integration', () => {
    let db: duckdb.AsyncDuckDB;
    let conn: duckdb.AsyncDuckDBConnection;

    beforeAll(async () => {
        // Initialize DuckDB-WASM
        const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

        if (!bundle.mainWorker) {
            throw new Error('No main worker URL found in bundle');
        }

        // Fetch and create blob URL for worker
        const workerRes = await fetch(bundle.mainWorker);
        const workerScript = await workerRes.text();
        const workerBlob = new Blob([workerScript], { type: 'text/javascript' });
        const workerUrl = URL.createObjectURL(workerBlob);

        const worker = new Worker(workerUrl);
        const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);

        db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

        URL.revokeObjectURL(workerUrl);
        conn = await db.connect();
    }, WASM_TIMEOUT);

    afterAll(async () => {
        if (conn) await conn.close();
        if (db) await db.terminate();
    });

    describe('insertArrowTable', () => {
        it('inserts a simple Arrow table', async () => {
            const vectors: Record<string, arrow.Vector> = {
                id: arrow.vectorFromArray([1, 2, 3], new arrow.Float64()),
                name: arrow.vectorFromArray(['Alice', 'Bob', 'Charlie'], new arrow.Utf8()),
            };
            const table = new arrow.Table(vectors);

            await conn.query('DROP TABLE IF EXISTS test_simple');
            await conn.insertArrowTable(table, { name: 'test_simple', create: true });

            const result = await conn.query('SELECT COUNT(*) as cnt FROM test_simple');
            const count = result.toArray()[0]?.cnt;

            expect(Number(count)).toBe(3);
        });

        it('preserves data types correctly', async () => {
            const vectors: Record<string, arrow.Vector> = {
                int_col: arrow.vectorFromArray([1, 2, 3], new arrow.Float64()),
                str_col: arrow.vectorFromArray(['a', 'b', 'c'], new arrow.Utf8()),
            };
            const table = new arrow.Table(vectors);

            await conn.query('DROP TABLE IF EXISTS test_types');
            await conn.insertArrowTable(table, { name: 'test_types', create: true });

            const result = await conn.query('SELECT * FROM test_types ORDER BY int_col');
            const rows = result.toArray().map(r => r.toJSON());

            expect(rows[0].int_col).toBe(1);
            expect(rows[0].str_col).toBe('a');
            expect(rows[2].int_col).toBe(3);
            expect(rows[2].str_col).toBe('c');
        });

        it('handles null values', async () => {
            const vectors: Record<string, arrow.Vector> = {
                val: arrow.vectorFromArray([1, null, 3], new arrow.Float64()),
            };
            const table = new arrow.Table(vectors);

            await conn.query('DROP TABLE IF EXISTS test_nulls');
            await conn.insertArrowTable(table, { name: 'test_nulls', create: true });

            const nullCount = await conn.query('SELECT COUNT(*) as cnt FROM test_nulls WHERE val IS NULL');
            expect(Number(nullCount.toArray()[0]?.cnt)).toBe(1);

            const notNullCount = await conn.query('SELECT COUNT(*) as cnt FROM test_nulls WHERE val IS NOT NULL');
            expect(Number(notNullCount.toArray()[0]?.cnt)).toBe(2);
        });

        it('supports aggregation queries on Arrow-inserted data', async () => {
            const vectors: Record<string, arrow.Vector> = {
                category: arrow.vectorFromArray(['A', 'A', 'B', 'B', 'B'], new arrow.Utf8()),
                value: arrow.vectorFromArray([10, 20, 30, 40, 50], new arrow.Float64()),
            };
            const table = new arrow.Table(vectors);

            await conn.query('DROP TABLE IF EXISTS test_agg');
            await conn.insertArrowTable(table, { name: 'test_agg', create: true });

            const result = await conn.query(`
                SELECT category, SUM(value) as total, COUNT(*) as cnt 
                FROM test_agg 
                GROUP BY category 
                ORDER BY category
            `);
            const rows = result.toArray().map(r => r.toJSON());

            expect(rows[0].category).toBe('A');
            expect(Number(rows[0].total)).toBe(30);
            expect(Number(rows[0].cnt)).toBe(2);

            expect(rows[1].category).toBe('B');
            expect(Number(rows[1].total)).toBe(120);
            expect(Number(rows[1].cnt)).toBe(3);
        });
    });

    describe('Performance', () => {
        it('inserts 1000 rows in under 100ms', async () => {
            const numRows = 1000;
            const vectors: Record<string, arrow.Vector> = {
                id: arrow.vectorFromArray(
                    Array.from({ length: numRows }, (_, i) => i),
                    new arrow.Float64()
                ),
                value: arrow.vectorFromArray(
                    Array.from({ length: numRows }, () => Math.random() * 100),
                    new arrow.Float64()
                ),
                label: arrow.vectorFromArray(
                    Array.from({ length: numRows }, (_, i) => `label_${i}`),
                    new arrow.Utf8()
                ),
            };
            const table = new arrow.Table(vectors);

            await conn.query('DROP TABLE IF EXISTS test_perf');

            const start = performance.now();
            await conn.insertArrowTable(table, { name: 'test_perf', create: true });
            const duration = performance.now() - start;

            console.log(`[Perf] Inserted ${numRows} rows in ${duration.toFixed(2)}ms`);

            const result = await conn.query('SELECT COUNT(*) as cnt FROM test_perf');
            expect(Number(result.toArray()[0]?.cnt)).toBe(numRows);

            // Arrow insertion should be fast
            expect(duration).toBeLessThan(100);
        });

        it('inserts 10000 rows in under 500ms', async () => {
            const numRows = 10000;
            const vectors: Record<string, arrow.Vector> = {
                id: arrow.vectorFromArray(
                    Array.from({ length: numRows }, (_, i) => i),
                    new arrow.Float64()
                ),
                score: arrow.vectorFromArray(
                    Array.from({ length: numRows }, () => Math.random()),
                    new arrow.Float64()
                ),
            };
            const table = new arrow.Table(vectors);

            await conn.query('DROP TABLE IF EXISTS test_perf_large');

            const start = performance.now();
            await conn.insertArrowTable(table, { name: 'test_perf_large', create: true });
            const duration = performance.now() - start;

            console.log(`[Perf] Inserted ${numRows} rows in ${duration.toFixed(2)}ms`);

            const result = await conn.query('SELECT COUNT(*) as cnt FROM test_perf_large');
            expect(Number(result.toArray()[0]?.cnt)).toBe(numRows);

            expect(duration).toBeLessThan(500);
        });
    });

    describe('Version Compatibility', () => {
        it('insertArrowTable accepts arrow.Table without type casting', async () => {
            // This would fail with version mismatch - the 'as any' cast was a workaround
            const vectors: Record<string, arrow.Vector> = {
                test: arrow.vectorFromArray([1, 2, 3], new arrow.Float64()),
            };
            const table = new arrow.Table(vectors);

            await conn.query('DROP TABLE IF EXISTS test_nocast');

            // This should work WITHOUT 'as any' cast if versions match
            await conn.insertArrowTable(table, { name: 'test_nocast', create: true });

            const result = await conn.query('SELECT COUNT(*) as cnt FROM test_nocast');
            expect(Number(result.toArray()[0]?.cnt)).toBe(3);
        });
    });
});
