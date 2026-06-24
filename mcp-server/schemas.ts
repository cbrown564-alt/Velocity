/**
 * MCP tool input schemas (JSON Schema for ListTools).
 */

export const TOOLS = [
  // Data lifecycle
  {
    name: 'velocity_load',
    description: 'Load a SAV or CSV file into the engine (full row data). For large SAV files (>50MB), prefer velocity_load_metadata then velocity_load_full.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the file (relative to dataDir or absolute).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'velocity_load_metadata',
    description:
      'Load SAV variable metadata only (no respondent rows). Use for large files to inspect variables before committing to a full load. Follow with velocity_load_full on the same path.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the SAV file (relative to dataDir or absolute).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'velocity_load_full',
    description:
      'Complete a full row load for a file previously opened with velocity_load_metadata, or load a file directly when no metadata-only session is active.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the SAV file (must match the metadata load path when applicable).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'velocity_workspace_load',
    description:
      'Register a dataset in the multi-dataset workspace (separate DuckDB table per dataset). Use for cross-wave harmonization. Set metadataOnly: true on large SAV files, then velocity_workspace_load_full before harmonizing.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the SAV or CSV file.' },
        metadataOnly: { type: 'boolean', description: 'SAV only: load variable metadata without rows.' },
        waveNumber: { type: 'number', description: 'Optional wave label for longitudinal projects.' },
        makeActive: { type: 'boolean', description: 'If true, switch the active analysis dataset to this entry (default: false).' },
      },
      required: ['path'],
    },
  },
  {
    name: 'velocity_workspace_list',
    description: 'List datasets registered in the current workspace session.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'velocity_workspace_set_active',
    description: 'Set the active analysis dataset to a workspace entry (for describe/crosstab/deck tools).',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Workspace dataset ID from velocity_workspace_load or velocity_workspace_list.' },
      },
      required: ['datasetId'],
    },
  },
  {
    name: 'velocity_workspace_load_full',
    description: 'Materialize full row data for a metadata-only workspace dataset.',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Workspace dataset ID.' },
      },
      required: ['datasetId'],
    },
  },
  {
    name: 'velocity_workspace_propose_mappings',
    description: 'Auto-propose variable mappings between two workspace datasets (cross-wave harmonization).',
    inputSchema: {
      type: 'object',
      properties: {
        sourceDatasetId: { type: 'string', description: 'Source wave dataset ID.' },
        targetDatasetId: { type: 'string', description: 'Target wave dataset ID.' },
      },
      required: ['sourceDatasetId', 'targetDatasetId'],
    },
  },
  {
    name: 'velocity_workspace_harmonize',
    description:
      'Build and materialize a harmonized DuckDB table from two workspace datasets using confirmed mappings.',
    inputSchema: {
      type: 'object',
      properties: {
        sourceDatasetId: { type: 'string' },
        targetDatasetId: { type: 'string' },
        mappings: { type: 'array', description: 'VariableMapping[] (typically from velocity_workspace_propose_mappings).' },
        outputTableName: { type: 'string', description: 'Name for the harmonized output table.' },
        onlyConfirmed: { type: 'boolean', description: 'If true, apply only mappings with status confirmed (default: true).' },
      },
      required: ['sourceDatasetId', 'targetDatasetId', 'mappings', 'outputTableName'],
    },
  },
  {
    name: 'velocity_describe',
    description: 'Describe the loaded dataset: variables, variable sets, active filters, weight.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'velocity_describe_variable',
    description: 'Get detailed statistics for a single variable. Response warnings flag weight-like measurement variables and high-cardinality fields.',
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
    description: 'Run a cross-tabulation analysis with optional significance testing. Use resolveLabels: true to get human-readable value labels instead of raw integer codes. Response includes warnings for high-cardinality row/column variables and weight-like names that may be measurements (e.g. body weight), not sampling weights.',
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
        resolveLabels: { type: 'boolean', description: 'If true, replace raw integer codes in output with human-readable value labels. Strongly recommended.' },
        format: {
          type: 'string',
          enum: ['long', 'matrix'],
          description: 'Output shape. "long" (default) returns one row per cell. "matrix" returns a pivot table with column bases and column percentages.',
        },
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
    description:
      'Build a full presentation deck from a DeckSpec. Returns a BuiltDeck with processed slides. Large decks (8+ slides or heavy payloads) are returned as multiple MCP content parts (transport: chunked); merge chunked-slide parts by index before export/commit.',
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
    name: 'velocity_commit_deck',
    description: 'Write a BuiltDeck into the session so a later session export includes the built slides and sections.',
    inputSchema: {
      type: 'object',
      properties: {
        deck: { type: 'object', description: 'BuiltDeck object from velocity_build_deck.' },
      },
      required: ['deck'],
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
    inputSchema: {
      type: 'object',
      properties: {
        outputPath: {
          type: 'string',
          description: 'Optional file path to write the exported session JSON directly. Adds .velocity if omitted.',
        },
      },
    },
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
  // Semantic Layer (Phase 4)
  {
    name: 'velocity_annotate_dataset',
    description: 'Run heuristic auto-annotation over all variables in the loaded dataset. Classifies each variable with a topic, measurement intent, and confidence score. Returns counts of annotated vs total variables.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'velocity_annotate',
    description: 'Manually add or update a semantic annotation for a specific variable.',
    inputSchema: {
      type: 'object',
      properties: {
        variableId: { type: 'string', description: 'Variable ID to annotate.' },
        annotation: {
          type: 'object',
          description: 'Semantic annotation fields.',
          properties: {
            topic: { type: 'string', description: 'Domain topic, e.g. "satisfaction", "demographics".' },
            measurementIntent: {
              type: 'string',
              enum: ['attitude', 'behavior', 'awareness', 'demographic', 'classification', 'outcome', 'weight', 'identifier', 'open_end', 'other'],
            },
            conceptFamily: { type: 'string', description: 'Links to a Concept entity by name.' },
            source: { type: 'string', enum: ['auto', 'manual', 'agent'] },
            confidence: { type: 'number', description: '0–1 confidence score.' },
          },
          required: ['topic', 'measurementIntent'],
        },
      },
      required: ['variableId', 'annotation'],
    },
  },
  {
    name: 'velocity_search_variables',
    description: 'Find variables by semantic meaning (not just name). Searches variable names, labels, topic annotations, concept names/aliases, and value labels. Returns ranked results with relevance scores.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query, e.g. "satisfaction variables" or "demographics".' },
        limit: { type: 'number', description: 'Maximum results to return (default: 20).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'velocity_list_concepts',
    description: 'List all concept entities. Concepts link variables across datasets that measure the same construct.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'velocity_create_concept',
    description: 'Define a new concept entity for cross-dataset variable linking.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Concept name, e.g. "Overall Satisfaction".' },
        aliases: { type: 'array', items: { type: 'string' }, description: 'Alternative names for synonym expansion.' },
        canonicalScale: {
          type: 'object',
          description: 'Expected measurement scale properties.',
          properties: {
            points: { type: 'number' },
            direction: { type: 'string', enum: ['ascending', 'descending'] },
            anchors: {
              type: 'object',
              properties: { low: { type: 'string' }, high: { type: 'string' } },
            },
          },
          required: ['points', 'direction'],
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'velocity_link_concept',
    description: 'Link a variable to an existing concept entity.',
    inputSchema: {
      type: 'object',
      properties: {
        variableId: { type: 'string', description: 'Variable ID to link.' },
        conceptId: { type: 'string', description: 'Concept ID to link to.' },
      },
      required: ['variableId', 'conceptId'],
    },
  },
  {
    name: 'velocity_suggest_analyses',
    description: 'Get domain-aware analysis suggestions for a set of variables. Uses semantic annotations to recommend crosstabs, frequency distributions, trend analyses, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        variableIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Variable IDs to generate suggestions for.',
        },
      },
      required: ['variableIds'],
    },
  },
  {
    name: 'velocity_list_variables_by_category',
    description: 'Filter variables by measurement intent category (e.g. "demographic", "attitude", "behavior"). Much more reliable than keyword search for navigating large datasets. Run velocity_annotate_dataset first.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['attitude', 'behavior', 'awareness', 'demographic', 'classification', 'outcome', 'weight', 'identifier', 'open_end', 'other'],
          description: 'MeasurementIntent category to filter by.',
        },
        limit: { type: 'number', description: 'Maximum results to return (default: 50).' },
      },
      required: ['category'],
    },
  },
  {
    name: 'velocity_suggest_breaks',
    description: 'Suggest good cross-break (column) variables for a given topic (row) variable. Returns ranked candidates scored by demographic intent, cardinality, and naming patterns. Response warnings flag high-cardinality topics and weight-like measurement variables. Run velocity_annotate_dataset first.',
    inputSchema: {
      type: 'object',
      properties: {
        variableId: { type: 'string', description: 'Variable ID of the topic/row variable.' },
        limit: { type: 'number', description: 'Maximum suggestions to return (default: 5).' },
      },
      required: ['variableId'],
    },
  },
] as const;
