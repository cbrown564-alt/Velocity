#!/usr/bin/env npx tsx

import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { exportPptx, exportXlsx } from '../src/core/export';
import { VelocityEngine, VelocityError } from '../src/engine';
import { processAnalysisData } from '../src/services/analysisProcessor';

const program = new Command();

type JsonLike = Record<string, unknown>;

function parseJsonConfig(raw?: string): JsonLike {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as JsonLike;
  } catch (error: any) {
    throw new Error(`Failed to parse config JSON: ${error.message}`);
  }
}

async function withEngine<T>(fn: (engine: VelocityEngine) => Promise<T>): Promise<T> {
  const engine = await VelocityEngine.create({ runtime: 'node' });
  try {
    return await fn(engine);
  } finally {
    await engine.close();
  }
}

async function loadEngineFile(engine: VelocityEngine, file: string) {
  const envelope = await engine.loadFile(file);
  return envelope.data;
}

function printJson(data: unknown) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function printKnownError(error: unknown): never {
  if (error instanceof VelocityError) {
    console.error(`${error.code}: ${error.message}`);
    if (error.details) {
      printJson(error.details);
    }
    process.exit(1);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

program
  .name('velocity')
  .description('Velocity statistical analysis CLI')
  .version('0.1.0');

program
  .command('load <file>')
  .description('Load a file (CSV or SAV) into the analysis engine')
  .action(async (file: string) => {
    try {
      await withEngine(async (engine) => {
        const summary = await loadEngineFile(engine, file);
        console.log(`Loaded ${summary.rowCount} rows from ${summary.datasetName}`);

        const description = engine.describe();
        const variables = description.data.dataset?.variables ?? [];
        console.log(`\nSchema (${variables.length} columns):`);
        variables.forEach((variable) => {
          console.log(`  ${variable.id}: ${variable.type}`);
        });
      });
    } catch (error) {
      printKnownError(error);
    }
  });

program
  .command('schema <file>')
  .description('Show the schema of a file')
  .action(async (file: string) => {
    try {
      await withEngine(async (engine) => {
        await loadEngineFile(engine, file);
        const variables = engine.describe().data.dataset?.variables ?? [];
        printJson(variables.map((variable) => ({
          name: variable.id,
          label: variable.label,
          type: variable.type,
        })));
      });
    } catch (error) {
      printKnownError(error);
    }
  });

program
  .command('query <file>')
  .description('Run a crosstab query on a file')
  .requiredOption('--rows <vars>', 'Comma-separated row variables')
  .option('--cols <var>', 'Column variable')
  .option('--weight <var>', 'Weight variable')
  .option('--format <fmt>', 'Output format: json or table', 'json')
  .action(async (file: string, opts) => {
    try {
      await withEngine(async (engine) => {
        await loadEngineFile(engine, file);
        const rowVars = opts.rows.split(',').map((value: string) => value.trim()).filter(Boolean);

        if (opts.weight) {
          engine.setWeight(opts.weight);
        }

        const envelope = await engine.runAnalysis('crosstab', {
          rowVars,
          colVar: opts.cols || null,
        });
        const result = envelope.data as { rows?: unknown[] };

        if (opts.format === 'table') {
          console.table(result.rows ?? []);
        } else {
          printJson(result);
        }
      });
    } catch (error) {
      printKnownError(error);
    }
  });

program
  .command('stats <file> <column>')
  .description('Get variable statistics for a column')
  .option('--type <type>', 'Variable type override', undefined)
  .option('--bins <n>', 'Number of histogram bins', '10')
  .action(async (file: string, column: string, opts) => {
    try {
      await withEngine(async (engine) => {
        await loadEngineFile(engine, file);
        const envelope = await engine.runAnalysis('variableStats', {
          column,
          variableType: opts.type,
          binCount: parseInt(opts.bins, 10),
        });
        printJson(envelope.data);
      });
    } catch (error) {
      printKnownError(error);
    }
  });

program
  .command('analyze <file> <id>')
  .description('Run a specific analysis by ID (e.g., crosstab, variableStats)')
  .option('--config <json>', 'JSON configuration for the analysis')
  .option('--format <fmt>', 'Output format: json or table', 'json')
  .action(async (file: string, id: string, opts) => {
    try {
      await withEngine(async (engine) => {
        await loadEngineFile(engine, file);
        const config = parseJsonConfig(opts.config);
        const envelope = await engine.runAnalysis(id, config);

        if (opts.format === 'table' && Array.isArray((envelope.data as any)?.rows)) {
          console.table((envelope.data as any).rows);
        } else {
          printJson(envelope.data);
        }
      });
    } catch (error) {
      printKnownError(error);
    }
  });

program
  .command('sql <file> <query>')
  .description('Run arbitrary SQL on a loaded file')
  .action(async (file: string, query: string) => {
    try {
      await withEngine(async (engine) => {
        await loadEngineFile(engine, file);
        const envelope = await engine.query(query);
        printJson(envelope.data.rows);
      });
    } catch (error) {
      printKnownError(error);
    }
  });

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
    try {
      await withEngine(async (engine) => {
        await loadEngineFile(engine, file);
        const rowVars = opts.rows.split(',').map((value: string) => value.trim()).filter(Boolean);

        if (opts.weight) {
          engine.setWeight(opts.weight);
        }

        const envelope = await engine.runAnalysis('crosstab', {
          rowVars,
          colVar: opts.cols || null,
        });
        const description = engine.describe();
        const variablesById = new Map((description.data.dataset?.variables ?? []).map((variable) => [variable.id, variable]));
        const rowVariables = rowVars
          .map((id: string) => variablesById.get(id))
          .filter((variable): variable is NonNullable<typeof variable> => variable !== undefined);
        const colVariable = opts.cols ? variablesById.get(opts.cols) ?? null : null;

        const processed = processAnalysisData({
          data: (envelope.data as any).rows ?? [],
          rowVariables,
          colVariable,
          isWeighted: !!description.data.weightVariable,
        });

        if (!processed) {
          throw new Error('No data to export');
        }

        const config = {
          title: opts.title,
          analyses: [{
            label: rowVars.join(' × ') + (opts.cols ? ` by ${opts.cols}` : ''),
            result: processed,
          }],
        };

        const fmt = opts.format.toLowerCase();
        const ext = fmt === 'xlsx' ? 'xlsx' : 'pptx';
        const outputPath = opts.output || `report.${ext}`;
        const bytes = fmt === 'xlsx'
          ? await exportXlsx(config)
          : await exportPptx(config);

        writeFileSync(outputPath, bytes);
        console.log(`Exported to ${outputPath} (${(bytes.length / 1024).toFixed(1)} KB)`);
      });
    } catch (error) {
      printKnownError(error);
    }
  });

program
  .command('repl [file]')
  .description('Open an interactive VelocityEngine REPL')
  .action(async (file?: string) => {
    const engine = await VelocityEngine.create({ runtime: 'node' });
    const rl = createInterface({ input, output });

    try {
      if (file) {
        const summary = await loadEngineFile(engine, file);
        console.log(`Loaded ${summary.datasetName} (${summary.rowCount} rows)`);
      }

      console.log('Commands: load <file>, describe, analyses, query <sql>, run <id> <json>, weight <var|clear>, clear-filters, exit');

      while (true) {
        const line = (await rl.question('velocity> ')).trim();
        if (!line) continue;
        if (line === 'exit' || line === 'quit') break;

        const [command, ...rest] = line.split(' ');

        try {
          if (command === 'load') {
            const target = rest.join(' ').trim();
            const summary = await loadEngineFile(engine, target);
            console.log(`Loaded ${summary.datasetName} (${summary.rowCount} rows)`);
            continue;
          }

          if (command === 'describe') {
            printJson(engine.describe());
            continue;
          }

          if (command === 'analyses') {
            printJson(engine.listAnalyses());
            continue;
          }

          if (command === 'query') {
            const sql = rest.join(' ');
            const result = await engine.query(sql);
            printJson(result.data.rows);
            continue;
          }

          if (command === 'run') {
            const analysisId = rest.shift();
            if (!analysisId) throw new Error('Usage: run <id> <json>');
            const config = parseJsonConfig(rest.join(' '));
            const result = await engine.runAnalysis(analysisId, config);
            printJson(result.data);
            continue;
          }

          if (command === 'weight') {
            const variableId = rest.join(' ').trim();
            engine.setWeight(variableId === 'clear' ? null : variableId);
            console.log(variableId === 'clear' ? 'Weight cleared' : `Weight set to ${variableId}`);
            continue;
          }

          if (command === 'clear-filters') {
            engine.clearFilters();
            console.log('Filters cleared');
            continue;
          }

          console.log(`Unknown command: ${command}`);
        } catch (error) {
          if (error instanceof VelocityError) {
            console.error(`${error.code}: ${error.message}`);
          } else {
            console.error(error instanceof Error ? error.message : String(error));
          }
        }
      }
    } finally {
      rl.close();
      await engine.close();
    }
  });

program.parse();
