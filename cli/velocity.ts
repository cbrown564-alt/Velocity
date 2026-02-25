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
import { writeFileSync } from 'fs';
import { DuckDBNodeAdapter } from '../src/adapters/DuckDBNodeAdapter';
import { runCrosstab } from '../src/core/analysis/crosstabRunner';
import { getVariableStats } from '../src/core/analysis/variableStatsRunner';
import { processAnalysisData } from '../src/services/analysisProcessor';
import { exportPptx, exportXlsx } from '../src/core/export';
import { analysisRegistry } from '../src/core/analysis/registry';

// Import runners to ensure they register themselves
import '../src/core/analysis/crosstabRunner';
import '../src/core/analysis/variableStatsRunner';

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

async function loadFile(file: string, db: DuckDBNodeAdapter) {
  if (file.endsWith('.sav')) {
    const result = await db.loadSav(file);
    console.log(`Loaded ${result.rowCount} rows and ${result.variables.length} variables from ${file}`);
    return result;
  } else {
    const rowCount = await db.loadCSV(file);
    console.log(`Loaded ${rowCount} rows from ${file}`);
    return { rowCount };
  }
}

program
  .command('load <file>')
  .description('Load a file (CSV or SAV) into the analysis engine')
  .action(async (file: string) => {
    const db = await ensureAdapter();
    await loadFile(file, db);

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
  .description('Show the schema of a file')
  .action(async (file: string) => {
    const db = await ensureAdapter();
    await loadFile(file, db);

    const result = await db.query(`PRAGMA table_info('main')`);
    console.log(JSON.stringify(result.rows, null, 2));

    await db.close();
  });

// ============================================================================
// query command
// ============================================================================

program
  .command('query <file>')
  .description('Run a crosstab query on a file')
  .requiredOption('--rows <vars>', 'Comma-separated row variables')
  .option('--cols <var>', 'Column variable')
  .option('--weight <var>', 'Weight variable')
  .option('--format <fmt>', 'Output format: json or table', 'json')
  .action(async (file: string, opts) => {
    const db = await ensureAdapter();
    const loadResult = await loadFile(file, db);

    const rowVars = opts.rows.split(',').map((s: string) => s.trim());

    const results = await runCrosstab(db, {
      rowVars,
      colVar: opts.cols || null,
      weightVar: opts.weight || null,
      filters: [],
    }, {
      variables: (loadResult as any).variables?.reduce((acc: any, v: any) => ({ ...acc, [v.id]: v }), {}) || {},
      variableSets: (loadResult as any).variableSets?.reduce((acc: any, vs: any) => ({ ...acc, [vs.id]: vs }), {}) || {},
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
  .option('--type <type>', 'Variable type: categorical, ordered, numeric (legacy aliases still accepted)', 'numeric')
  .option('--bins <n>', 'Number of histogram bins', '10')
  .action(async (file: string, column: string, opts) => {
    const db = await ensureAdapter();
    await loadFile(file, db);

    const stats = await getVariableStats(db, column, opts.type, undefined, parseInt(opts.bins));
    console.log(JSON.stringify(stats, null, 2));

    await db.close();
  });

// ============================================================================
// analyze command (generic plugin runner)
// ============================================================================

program
  .command('analyze <file> <id>')
  .description('Run a specific analysis by ID (e.g., crosstab, variableStats)')
  .option('--config <json>', 'JSON configuration for the analysis')
  .option('--format <fmt>', 'Output format: json or table', 'json')
  .action(async (file: string, id: string, opts) => {
    const db = await ensureAdapter();
    const loadResult = await loadFile(file, db);

    const runner = analysisRegistry.get(id);
    if (!runner) {
      console.error(`Analysis runner not found: ${id}`);
      console.log('Available analyses:');
      analysisRegistry.list().forEach(r => console.log(`  - ${r.id}: ${r.label}`));
      await db.close();
      process.exit(1);
    }

    let config = {};
    if (opts.config) {
      try {
        config = JSON.parse(opts.config);
      } catch (e: any) {
        console.error(`Failed to parse config JSON: ${e.message}`);
        await db.close();
        process.exit(1);
      }
    }

    // Special handling for crosstab context if not provided
    if (id === 'crosstab' && !(config as any).context) {
      (config as any).context = {
        variables: (loadResult as any).variables?.reduce((acc: any, v: any) => ({ ...acc, [v.id]: v }), {}) || {},
        variableSets: (loadResult as any).variableSets?.reduce((acc: any, vs: any) => ({ ...acc, [vs.id]: vs }), {}) || {},
      };
    }

    // Validate config if runner supports it
    if (runner.validate) {
      const errors = runner.validate(config);
      if (errors.length > 0) {
        console.error('Configuration errors:');
        errors.forEach(err => console.error(`  - ${err}`));
        await db.close();
        process.exit(1);
      }
    }

    try {
      const results = await runner.run(db, config);

      if (opts.format === 'table') {
        process.stdout.write('\n');
        console.table(results);
      } else {
        process.stdout.write(JSON.stringify(results, null, 2) + '\n');
      }
    } catch (error: any) {
      console.error(`Analysis failed: ${error.message}`);
      await db.close();
      process.exit(1);
    }

    await db.close();
  });

// ============================================================================
// sql command (escape hatch)
// ============================================================================

program
  .command('sql <file> <query>')
  .description('Run arbitrary SQL on a loaded file')
  .option('--stream', 'Stream results as NDJSON')
  .action(async (file: string, query: string, opts) => {
    const db = await ensureAdapter();
    await loadFile(file, db);

    if (opts.stream && db.queryStream) {
      for await (const chunk of db.queryStream(query)) {
        for (const row of chunk.rows) {
          console.log(JSON.stringify(row));
        }
      }
    } else {
      const result = await db.query(query);
      console.log(JSON.stringify(result.rows, null, 2));
    }

    await db.close();
  });

// ============================================================================
// export command
// ============================================================================

program
  .command('export <file>')
  .description('Export crosstab analysis to PPTX or XLSX')
  .requiredOption('--rows <vars>', 'Comma-separated row variables')
  .option('--cols <var>', 'Column variable')
  .option('--weight <var>', 'Weight variable')
  .option('--format <fmt>', 'Output format: pptx or xlsx', 'pptx')
  .option('--output <path>', 'Output file path')
  .option('--title <title>', 'Report title', 'Velocity Report')
  .action(async (file: string, opts) => {
    const db = await ensureAdapter();
    const loadResult = await loadFile(file, db);

    const variables = (loadResult as any).variables || [];
    const variableSets = (loadResult as any).variableSets || [];
    const varMap = variables.reduce((acc: any, v: any) => ({ ...acc, [v.id]: v }), {});
    const vsMap = variableSets.reduce((acc: any, vs: any) => ({ ...acc, [vs.id]: vs }), {});

    const rowVars = opts.rows.split(',').map((s: string) => s.trim());

    const crosstabData = await runCrosstab(db, {
      rowVars,
      colVar: opts.cols || null,
      weightVar: opts.weight || null,
      filters: [],
    }, {
      variables: varMap,
      variableSets: vsMap,
    });

    const rowVariables = rowVars.map((id: string) => varMap[id]).filter(Boolean);
    const colVariable = opts.cols ? varMap[opts.cols] || null : null;

    const processed = processAnalysisData({
      data: crosstabData.rows,
      rowVariables,
      colVariable,
      isWeighted: !!opts.weight,
    });

    if (!processed) {
      console.error('No data to export');
      await db.close();
      process.exit(1);
    }

    const config = {
      title: opts.title,
      analyses: [{ label: rowVars.join(' × ') + (opts.cols ? ` by ${opts.cols}` : ''), result: processed }],
    };

    const fmt = opts.format.toLowerCase();
    const ext = fmt === 'xlsx' ? 'xlsx' : 'pptx';
    const outputPath = opts.output || `report.${ext}`;

    const bytes = fmt === 'xlsx'
      ? await exportXlsx(config)
      : await exportPptx(config);

    writeFileSync(outputPath, bytes);
    console.log(`Exported to ${outputPath} (${(bytes.length / 1024).toFixed(1)} KB)`);

    await db.close();
  });

program.parse();
