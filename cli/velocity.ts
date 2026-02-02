#!/usr/bin/env npx tsx
/**
 * Velocity CLI
 *
 * Headless command-line interface for the Velocity analysis engine.
 * Uses the same core modules as the browser app but with DuckDB native bindings.
 *
 * Usage:
 *   npx tsx cli/velocity.ts load <file.csv>
 *   npx tsx cli/velocity.ts query --rows col1,col2 --cols col3 --format json
 *   npx tsx cli/velocity.ts schema
 *   npx tsx cli/velocity.ts stats <column>
 */

import { Command } from 'commander';
import { DuckDBNodeAdapter } from '../src/adapters/DuckDBNodeAdapter';
import { runCrosstab } from '../src/core/analysis/crosstabRunner';
import { getVariableStats } from '../src/core/analysis/variableStatsRunner';

const program = new Command();

// Shared state
let adapter: DuckDBNodeAdapter | null = null;

async function ensureAdapter(): Promise<DuckDBNodeAdapter> {
  if (!adapter) {
    adapter = await DuckDBNodeAdapter.create();
  }
  return adapter;
}

program
  .name('velocity')
  .description('Velocity statistical analysis CLI')
  .version('0.1.0');

// ============================================================================
// load command
// ============================================================================

program
  .command('load <file>')
  .description('Load a CSV file into the analysis engine')
  .action(async (file: string) => {
    const db = await ensureAdapter();
    const rowCount = await db.loadCSV(file);
    console.log(`Loaded ${rowCount} rows from ${file}`);

    // Show schema
    const result = await db.query(`PRAGMA table_info('main')`);
    console.log(`\nSchema (${result.rowCount} columns):`);
    for (const row of result.rows) {
      console.log(`  ${row.name}: ${row.type}`);
    }

    await db.close();
  });

// ============================================================================
// schema command
// ============================================================================

program
  .command('schema <file>')
  .description('Show the schema of a CSV file')
  .action(async (file: string) => {
    const db = await ensureAdapter();
    await db.loadCSV(file);

    const result = await db.query(`PRAGMA table_info('main')`);
    console.log(JSON.stringify(result.rows, null, 2));

    await db.close();
  });

// ============================================================================
// query command
// ============================================================================

program
  .command('query <file>')
  .description('Run a crosstab query on a CSV file')
  .requiredOption('--rows <vars>', 'Comma-separated row variables')
  .option('--cols <var>', 'Column variable')
  .option('--weight <var>', 'Weight variable')
  .option('--format <fmt>', 'Output format: json or table', 'json')
  .action(async (file: string, opts) => {
    const db = await ensureAdapter();
    await db.loadCSV(file);

    const rowVars = opts.rows.split(',').map((s: string) => s.trim());

    const results = await runCrosstab(db, {
      rowVars,
      colVar: opts.cols || null,
      weightVar: opts.weight || null,
      filters: [],
    }, {
      variables: {},
      variableSets: {},
    });

    if (opts.format === 'table') {
      console.table(results);
    } else {
      console.log(JSON.stringify(results, null, 2));
    }

    await db.close();
  });

// ============================================================================
// stats command
// ============================================================================

program
  .command('stats <file> <column>')
  .description('Get variable statistics for a column')
  .option('--type <type>', 'Variable type: nominal, ordinal, scale, numeric', 'numeric')
  .option('--bins <n>', 'Number of histogram bins', '10')
  .action(async (file: string, column: string, opts) => {
    const db = await ensureAdapter();
    await db.loadCSV(file);

    const stats = await getVariableStats(db, column, opts.type, parseInt(opts.bins));
    console.log(JSON.stringify(stats, null, 2));

    await db.close();
  });

// ============================================================================
// sql command (escape hatch)
// ============================================================================

program
  .command('sql <file> <query>')
  .description('Run arbitrary SQL on a loaded CSV file')
  .action(async (file: string, query: string) => {
    const db = await ensureAdapter();
    await db.loadCSV(file);

    const result = await db.query(query);
    console.log(JSON.stringify(result.rows, null, 2));

    await db.close();
  });

program.parse();
