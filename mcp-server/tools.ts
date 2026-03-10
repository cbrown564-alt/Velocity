/**
 * MCP Tool Definitions — Velocity Engine Transport Adapter
 *
 * Maps incoming MCP tool calls to VelocityEngine methods.
 * Zero business logic here: validate inputs, dispatch to engine, format response.
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { VelocityEngine, VelocityError } from '../src/engine/index.js';
import type { DeckSpec, DeckExportOptions, BuiltDeck } from '../src/engine/types.js';
import type { Filter } from '../src/types/index.js';
import type { VariableMapping } from '../src/types/harmonization.js';

// ---------------------------------------------------------------------------
// Tool Schemas (JSON Schema for each tool's input)
// ---------------------------------------------------------------------------

const TOOLS = [
  // Data lifecycle
  {
    name: 'velocity_load',
    description: 'Load a SAV or CSV file into the engine. Returns a DatasetSummary.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file (relative to dataDir or absolute).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'velocity_describe',
    description: 'Describe the loaded dataset: variables, variable sets, active filters, weight.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'velocity_describe_variable',
    description: 'Get detailed statistics for a single variable.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Variable ID.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'velocity_list_analyses',
    description: 'List all registered analysis types with their config schemas.',
    inputSchema: { type: 'object', properties: {} },
  },
  // Analysis
  {
    name: 'velocity_crosstab',
    description: 'Run a cross-tabulation analysis with optional significance testing.',
    inputSchema: {
      type: 'object',
      properties: {
        rowVars: {
          type: 'array',
          items: { type: 'string' },
          description: 'Variable IDs for rows (at least one required).',
        },
        colVar: { type: 'string', description: 'Variable ID for columns (optional).' },
        filters: { type: 'array', description: 'Filter conditions (optional).' },
        weightVar: { type: 'string', description: 'Weight variable ID (optional).' },
        analysisSettings: {
          type: 'object',
          description: 'Significance testing settings.',
          properties: {
            comparisonMethod: { type: 'string', enum: ['cell_vs_rest', 'pairwise'] },
            correctionType: { type: 'string', enum: ['none', 'bonferroni', 'fdr'] },
            significanceLevel: { type: 'number', enum: [0.95, 0.90, 0.80] },
          },
        },
      },
      required: ['rowVars'],
    },
  },
  {
    name: 'velocity_stats',
    description: 'Get frequency counts and distribution statistics for a single variable.',
    inputSchema: {
      type: 'object',
      properties: {
        column: { type: 'string', description: 'Variable ID to analyze.' },
        variableType: { type: 'string', enum: ['nominal', 'ordinal', 'scale', 'categorical', 'ordered', 'numeric'] },
        binCount: { type: 'number', description: 'Number of histogram bins (default: 10).' },
      },
      required: ['column'],
    },
  },
  {
    name: 'velocity_sql',
    description: 'Execute a raw SQL query against the loaded dataset (table name: main).',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'SQL query to execute.' },
      },
      required: ['sql'],
    },
  },
  {
    name: 'velocity_recode',
    description: 'Create a new recoded variable from an existing one.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceVar: { type: 'string', description: 'Source variable ID.' },
        config: {
          type: 'object',
          description: 'Recode configuration (mode, mappings or rules, targetVariableName, label).',
          properties: {
            mode: { type: 'string', enum: ['categorical', 'binning'] },
            targetVariableName: { type: 'string' },
            label: { type: 'string' },
          },
          required: ['mode'],
        },
      },
      required: ['sourceVar', 'config'],
    },
  },
  {
    name: 'velocity_filter',
    description: 'Add a filter condition to the current analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'object',
          description: 'Filter definition.',
          properties: {
            id: { type: 'string' },
            variableId: { type: 'string' },
            operator: { type: 'string', enum: ['eq', 'neq', 'in', 'gt', 'lt'] },
            value: {},
          },
          required: ['id', 'variableId', 'operator', 'value'],
        },
      },
      required: ['filter'],
    },
  },
  {
    name: 'velocity_clear_filters',
    description: 'Remove all active filters.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'velocity_set_weight',
    description: 'Set or clear the weighting variable.',
    inputSchema: {
      type: 'object',
      properties: {
        variableId: { type: ['string', 'null'], description: 'Variable ID to weight by, or null to clear.' },
      },
      required: ['variableId'],
    },
  },
  // Deck building
  {
    name: 'velocity_build_deck',
    description: 'Build a full presentation deck from a DeckSpec. Returns a BuiltDeck with processed slides.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: {
          type: 'object',
          description: 'DeckSpec: { title, subtitle?, branding?, sections: [{ title, slides: [...] }] }',
          required: ['title', 'sections'],
        },
      },
      required: ['spec'],
    },
  },
  {
    name: 'velocity_export_deck',
    description: 'Export a BuiltDeck to PPTX or XLSX. Returns base64-encoded file bytes.',
    inputSchema: {
      type: 'object',
      properties: {
        deck: { type: 'object', description: 'BuiltDeck object from velocity_build_deck.' },
        options: {
          type: 'object',
          description: 'Export options.',
          properties: {
            format: { type: 'string', enum: ['pptx', 'xlsx'] },
            branding: { type: 'object' },
          },
          required: ['format'],
        },
      },
      required: ['deck', 'options'],
    },
  },
  {
    name: 'velocity_recommend_chart',
    description: 'Get chart type recommendation for a set of variables.',
    inputSchema: {
      type: 'object',
      properties: {
        rowVarIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Row variable IDs.',
        },
        colVarId: { type: 'string', description: 'Column variable ID (optional).' },
      },
      required: ['rowVarIds'],
    },
  },
  // Harmonization
  {
    name: 'velocity_propose_mappings',
    description: 'Auto-propose variable mappings between two waves using similarity scoring.',
    inputSchema: {
      type: 'object',
      properties: {
        wave1VarIds: { type: 'array', items: { type: 'string' }, description: 'Wave 1 variable IDs.' },
        wave2VarIds: { type: 'array', items: { type: 'string' }, description: 'Wave 2 variable IDs.' },
      },
      required: ['wave1VarIds', 'wave2VarIds'],
    },
  },
  {
    name: 'velocity_build_harmonized_table',
    description: 'Generate SQL for a harmonized table combining two waves with value remapping.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceTable: { type: 'string' },
        targetTable: { type: 'string' },
        mappings: { type: 'array', description: 'Confirmed VariableMapping[] from velocity_propose_mappings.' },
        sourceVarNames: { type: 'object', description: 'Map of variable ID → column name for wave 1.' },
        targetVarNames: { type: 'object', description: 'Map of variable ID → column name for wave 2.' },
      },
      required: ['sourceTable', 'targetTable', 'mappings', 'sourceVarNames', 'targetVarNames'],
    },
  },
  // Session
  {
    name: 'velocity_export_session',
    description: 'Export the current engine state as a .velocity session file.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'velocity_import_session',
    description: 'Import a previously exported .velocity session file.',
    inputSchema: {
      type: 'object',
      properties: {
        session: { type: 'object', description: 'VelocitySessionFile JSON object.' },
      },
      required: ['session'],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Response Helpers
// ---------------------------------------------------------------------------

function successResponse(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResponse(err: VelocityError | Error | unknown) {
  const isVelocityError = (e: unknown): e is VelocityError =>
    typeof e === 'object' && e !== null && 'code' in e && 'message' in e;

  if (isVelocityError(err)) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ error: err.code, message: err.message, details: err.details }),
        },
      ],
      isError: true as const,
    };
  }

  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: 'UNKNOWN_ERROR', message }) }],
    isError: true as const,
  };
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

export function registerTools(server: Server, engine: VelocityEngine): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS as unknown as typeof TOOLS[number][],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const a = (args ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        // ---- Data lifecycle ----
        case 'velocity_load': {
          const result = await engine.loadFile(String(a.path));
          return successResponse(result);
        }

        case 'velocity_describe': {
          const result = engine.describe();
          return successResponse(result);
        }

        case 'velocity_describe_variable': {
          const result = await engine.describeVariable(String(a.id));
          return successResponse(result);
        }

        case 'velocity_list_analyses': {
          const result = engine.listAnalyses();
          return successResponse(result);
        }

        // ---- Analysis ----
        case 'velocity_crosstab': {
          const result = await engine.runAnalysis('crosstab', {
            rowVars: a.rowVars,
            colVar: a.colVar ?? null,
            filters: a.filters,
            weightVar: a.weightVar ?? null,
            analysisSettings: a.analysisSettings,
          });
          return successResponse(result);
        }

        case 'velocity_stats': {
          const result = await engine.runAnalysis('variableStats', {
            column: a.column,
            variableType: a.variableType,
            binCount: a.binCount,
          });
          return successResponse(result);
        }

        case 'velocity_sql': {
          const result = await engine.query(String(a.sql));
          return successResponse(result);
        }

        case 'velocity_recode': {
          const result = await engine.recode(String(a.sourceVar), a.config as never);
          return successResponse(result);
        }

        case 'velocity_filter': {
          engine.addFilter(a.filter as Filter);
          return successResponse({ ok: true });
        }

        case 'velocity_clear_filters': {
          engine.clearFilters();
          return successResponse({ ok: true });
        }

        case 'velocity_set_weight': {
          engine.setWeight(a.variableId as string | null);
          return successResponse({ ok: true });
        }

        // ---- Deck building ----
        case 'velocity_build_deck': {
          const result = await engine.buildDeck(a.spec as DeckSpec);
          return successResponse(result);
        }

        case 'velocity_export_deck': {
          const result = await engine.exportDeck(a.deck as BuiltDeck, a.options as DeckExportOptions);
          // Convert Uint8Array to base64 for text transport
          const bytes = result.data;
          const base64 =
            typeof Buffer !== 'undefined'
              ? Buffer.from(bytes).toString('base64')
              : btoa(String.fromCharCode(...Array.from(bytes)));
          return successResponse({
            ...result,
            data: { format: (a.options as DeckExportOptions).format, base64, byteLength: bytes.length },
          });
        }

        case 'velocity_recommend_chart': {
          const description = engine.describe();
          const dataset = description.dataset;
          if (!dataset) {
            return errorResponse({ code: 'NO_DATASET_LOADED', message: 'No dataset loaded.', details: null });
          }
          const rowVarIds = Array.isArray(a.rowVarIds) ? (a.rowVarIds as string[]) : [];
          const rowVars = rowVarIds
            .map((id) => dataset.variables.find((v) => v.id === id))
            .filter(Boolean) as never[];
          const colVar = a.colVarId
            ? (dataset.variables.find((v) => v.id === a.colVarId) ?? null)
            : null;
          const result = engine.recommendChart({ rowVars, colVar });
          return successResponse(result);
        }

        // ---- Harmonization ----
        case 'velocity_propose_mappings': {
          const description = engine.describe();
          const dataset = description.dataset;
          if (!dataset) {
            return errorResponse({ code: 'NO_DATASET_LOADED', message: 'No dataset loaded.', details: null });
          }
          const wave1VarIds = Array.isArray(a.wave1VarIds) ? (a.wave1VarIds as string[]) : [];
          const wave2VarIds = Array.isArray(a.wave2VarIds) ? (a.wave2VarIds as string[]) : [];
          const wave1Vars = wave1VarIds
            .map((id) => dataset.variables.find((v) => v.id === id))
            .filter(Boolean) as never[];
          const wave2Vars = wave2VarIds
            .map((id) => dataset.variables.find((v) => v.id === id))
            .filter(Boolean) as never[];
          const result = await engine.proposeMappings(wave1Vars, wave2Vars);
          return successResponse(result);
        }

        case 'velocity_build_harmonized_table': {
          const result = await engine.buildHarmonizedTable(
            String(a.sourceTable),
            String(a.targetTable),
            a.mappings as VariableMapping[],
            a.sourceVarNames as Record<string, string>,
            a.targetVarNames as Record<string, string>
          );
          return successResponse(result);
        }

        // ---- Session ----
        case 'velocity_export_session': {
          const result = await engine.exportSession();
          return successResponse(result);
        }

        case 'velocity_import_session': {
          const result = await engine.importSession(a.session as never);
          return successResponse(result);
        }

        default:
          return errorResponse(
            Object.assign(new Error(`Unknown tool: ${name}`), { code: 'ANALYSIS_NOT_FOUND' })
          );
      }
    } catch (err) {
      return errorResponse(err);
    }
  });
}
