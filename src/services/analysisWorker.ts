/**
 * Analysis Worker
 * 
 * Runs DuckDB-WASM in a dedicated Web Worker to keep the main thread responsive.
 * All database operations go through this worker via message passing.
 * 
 * Data is now persisted using the Origin Private File System (OPFS) so that
 * users do not need to re-import files on reload.
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import * as arrow from 'apache-arrow';
import { RecodeConfig, VariableSet, Variable } from '../types';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

// OPFS database path for persistent storage
const OPFS_DB_PATH = 'opfs://velocity_data.db';

// Feature flag: Disable OPFS during development due to corruption loop bug
// See: docs/bugs/opfs_corruption_loop.md
const ENABLE_OPFS = false;

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

// Message types for type-safe communication
export type WorkerRequest =
  | { type: 'init'; forceCleanStart?: boolean }
  | { type: 'loadCSV'; fileName: string; content: string }
  | { type: 'loadSAV'; buffer: ArrayBuffer }
  | { type: 'query'; sql: string }
  | { type: 'getSchema' }
  | { type: 'getUniqueValues'; column: string }
  | { type: 'getVariableStats'; column: string; variableType?: 'nominal' | 'ordinal' | 'scale' | 'text' | 'date' }
  | { type: 'recodeVariable'; sourceCol: string; newColName: string; config: RecodeConfig }
  | { type: 'checkPersistedData' }
  | { type: 'clearPersistedData' };

export interface VariableStatsFrequency {
  value: number | string | null;
  count: number;
}

export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  q1: number;  // 25th percentile
  q3: number;  // 75th percentile
  histogramBins: HistogramBin[];
}

export interface VariableStatsResult {
  column: string;
  frequencies: VariableStatsFrequency[];
  missingCount: number;
  totalCount: number;
  // Only present for scale/numeric variables
  numeric?: NumericStats;
}

export type WorkerResponse =
  | { type: 'ready'; opfsAvailable: boolean }
  | { type: 'corruptionDetected'; message: string }
  | { type: 'schema'; data: { name: string; type: string }[] }
  | { type: 'csvLoaded'; schema: { name: string; type: string }[]; rowCount: number; durationMs: number }
  | { type: 'savLoaded'; variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }
  | { type: 'queryResult'; data: any[]; durationMs: number }
  | { type: 'uniqueValues'; data: string[] }
  | { type: 'variableStats'; stats: VariableStatsResult }
  | { type: 'recodeComplete'; newColName: string }
  | { type: 'persistedDataFound'; schema: { name: string; type: string }[]; rowCount: number }
  | { type: 'noPersistedData' }
  | { type: 'persistedDataCleared' }
  | { type: 'error'; message: string };

/**
 * Clean OPFS storage by removing ALL DuckDB-related files
 * DuckDB-WASM stores files in various locations, so we need to be thorough
 */
async function cleanOPFS(): Promise<void> {
  try {
    const opfsRoot = await navigator.storage.getDirectory();

    // List and remove ALL entries in OPFS root
    // This is aggressive but ensures complete cleanup
    const entriesToDelete: string[] = [];

    // @ts-expect-error - entries() returns an async iterator
    for await (const [name] of opfsRoot.entries()) {
      entriesToDelete.push(name);
    }

    console.log('🦆 [Worker] Found OPFS entries to clean:', entriesToDelete);

    for (const name of entriesToDelete) {
      try {
        // @ts-expect-error - recursive option is valid but not always typed
        await opfsRoot.removeEntry(name, { recursive: true });
        console.log(`🦆 [Worker] Removed OPFS entry: ${name}`);
      } catch (e: any) {
        console.warn(`🦆 [Worker] Failed to remove ${name}:`, e.message);
      }
    }

    console.log('🦆 [Worker] Cleared all OPFS storage');
  } catch (error: any) {
    console.warn('🦆 [Worker] Failed to clean OPFS:', error.message);
  }
}

// Track OPFS availability for reporting
let opfsAvailable = false;

async function init(forceCleanStart: boolean = false): Promise<{ opfsAvailable: boolean; corruptionDetected?: boolean; corruptionMessage?: string }> {
  if (db) return { opfsAvailable }; // Already initialized

  // IMPORTANT: Clean OPFS BEFORE DuckDB initialization to avoid cached file handle issues
  if (forceCleanStart) {
    console.log('🦆 [Worker] Force clean start requested, clearing OPFS before DuckDB init...');
    await cleanOPFS();
  }

  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  console.log('🦆 [Worker] DuckDB Bundle Selected:', bundle);

  if (!bundle.mainWorker) {
    throw new Error('No main worker URL found in bundle');
  }

  // Fetch worker script and create blob URL (required for cross-origin)
  const workerRes = await fetch(bundle.mainWorker);
  const workerScript = await workerRes.text();
  const workerBlob = new Blob([workerScript], { type: 'text/javascript' });
  const workerUrl = URL.createObjectURL(workerBlob);

  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();

  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  URL.revokeObjectURL(workerUrl);

  // Open persistent database from OPFS (or in-memory if disabled)
  opfsAvailable = false;

  if (!ENABLE_OPFS) {
    console.log('🦆 [Worker] OPFS disabled (ENABLE_OPFS=false), using in-memory mode');
  } else {
    // Try OPFS persistence
    try {
      await db.open({
        path: OPFS_DB_PATH,
        accessMode: duckdb.DuckDBAccessMode.READ_WRITE
      });
      console.log('🦆 [Worker] DuckDB opened with OPFS persistence:', OPFS_DB_PATH);
      opfsAvailable = true;
    } catch (opfsError: any) {
      // Check if this is a corrupt file error
      const errorMsg = opfsError.message || '';
      const isCorruption = errorMsg.includes('not a valid DuckDB database file') || errorMsg.includes('corrupt');

      if (isCorruption && !forceCleanStart) {
        // First time seeing corruption - signal it so main thread can respawn with clean start
        console.error('🦆 [Worker] OPFS corruption detected:', errorMsg);
        return {
          opfsAvailable: false,
          corruptionDetected: true,
          corruptionMessage: errorMsg
        };
      } else if (isCorruption && forceCleanStart) {
        // Already tried clean start but OPFS still corrupted
        // Fall back to in-memory mode instead of infinite loop
        console.warn('🦆 [Worker] OPFS still corrupted after cleanup, falling back to in-memory mode');
      } else {
        // OPFS may not be available (e.g., in tests or unsupported browsers)
        console.warn('🦆 [Worker] OPFS not available, falling back to in-memory:', errorMsg);
      }
    }
  }

  if (!opfsAvailable) {
    console.log('🦆 [Worker] Running in in-memory mode (no persistence)');
  }

  conn = await db.connect();
  console.log('🦆 [Worker] DuckDB Initialized');

  return { opfsAvailable };
}

/**
 * Check if persisted data exists in the OPFS database
 */
async function checkPersistedData(): Promise<{ exists: boolean; schema?: { name: string; type: string }[]; rowCount?: number }> {
  if (!conn) throw new Error('DB not initialized');

  try {
    // Check if the 'main' table exists
    const tableCheck = await conn.query(`
      SELECT COUNT(*) as cnt 
      FROM information_schema.tables 
      WHERE table_name = 'main'
    `);
    const tableExists = Number(tableCheck.toArray()[0]?.cnt) > 0;

    if (!tableExists) {
      return { exists: false };
    }

    // Table exists, get schema and row count
    const schema = await getSchema();
    const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
    const rowCount = Number(countResult.toArray()[0]?.cnt);

    console.log(`🦆 [Worker] Found persisted data: ${rowCount} rows, ${schema.length} columns`);
    return { exists: true, schema, rowCount };
  } catch (error: any) {
    console.warn('🦆 [Worker] Error checking persisted data:', error.message);
    return { exists: false };
  }
}

/**
 * Clear all persisted data by dropping the main table
 */
async function clearPersistedData(): Promise<void> {
  if (!conn) throw new Error('DB not initialized');

  await conn.query(`DROP TABLE IF EXISTS main`);
  console.log('🦆 [Worker] Persisted data cleared');
}

async function loadCSV(fileName: string, content: string): Promise<{ schema: { name: string; type: string }[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();
  await db.registerFileText(fileName, content);
  await conn.query(`CREATE OR REPLACE TABLE main AS SELECT * FROM read_csv_auto('${fileName}')`);

  // Get Schema
  const schema = await getSchema();

  // Get Row Count
  const countResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const rowCount = Number(countResult.toArray()[0]?.cnt);

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded CSV: ${rowCount} rows, ${schema.length} columns in ${durationMs.toFixed(2)}ms`);

  return { schema, rowCount, durationMs };
}

/**
 * Ordinal Detection Patterns
 *
 * Common ordinal scale keywords for detecting Likert-type scales.
 * These patterns help distinguish ordinal (ordered categorical) from nominal (unordered categorical).
 */
const ORDINAL_PATTERNS = {
  agreement: ['strongly disagree', 'disagree', 'neutral', 'agree', 'strongly agree'],
  satisfaction: ['very dissatisfied', 'dissatisfied', 'neutral', 'satisfied', 'very satisfied'],
  frequency: ['never', 'rarely', 'sometimes', 'often', 'always'],
  likelihood: ['very unlikely', 'unlikely', 'neutral', 'likely', 'very likely'],
  quality: ['very poor', 'poor', 'fair', 'good', 'excellent'],
  importance: ['not important', 'somewhat important', 'important', 'very important'],
  amount: ['none', 'a little', 'some', 'a lot', 'a great deal'],
};

// Comparative/ordering words that suggest ordinal scale
const ORDINAL_KEYWORDS = ['more', 'less', 'better', 'worse', 'higher', 'lower', 'most', 'least', 'very', 'extremely', 'somewhat', 'slightly'];

/**
 * Detect if value labels suggest an ordinal (ordered) scale
 *
 * @param valueLabels - Array of {value, label} pairs
 * @returns true if the labels suggest an ordinal scale
 */
function isOrdinal(valueLabels: { value: number; label: string }[]): boolean {
  if (!valueLabels || valueLabels.length < 2) return false;

  // Normalize labels to lowercase for comparison
  const labels = valueLabels.map(vl => vl.label.toLowerCase().trim());

  // Check 1: Match against known ordinal patterns
  for (const pattern of Object.values(ORDINAL_PATTERNS)) {
    // Check if at least 3 labels match a pattern (allowing for variations)
    let matchCount = 0;
    for (const label of labels) {
      if (pattern.some(p => label.includes(p) || p.includes(label))) {
        matchCount++;
      }
    }
    if (matchCount >= 3) return true;
  }

  // Check 2: Labels contain ordinal keywords (e.g., "very satisfied", "somewhat agree")
  let keywordMatches = 0;
  for (const label of labels) {
    if (ORDINAL_KEYWORDS.some(kw => label.includes(kw))) {
      keywordMatches++;
    }
  }
  if (keywordMatches >= 2) return true;

  // Check 3: Numeric-prefixed labels (e.g., "1 - Poor", "2 - Fair", "3 - Good")
  const numericPrefixPattern = /^\d+\s*[-–—:]\s*/;
  const numericPrefixCount = labels.filter(l => numericPrefixPattern.test(l)).length;
  if (numericPrefixCount >= 3 && numericPrefixCount === labels.length) return true;

  // Check 4: Sequential integers with consistent spacing as values (Likert 1-5, 1-7, etc.)
  if (valueLabels.length >= 3 && valueLabels.length <= 10) {
    const values = valueLabels.map(vl => vl.value).sort((a, b) => a - b);
    const differences = values.slice(1).map((v, i) => v - values[i]);
    const isSequential = differences.every(d => d === differences[0] && d > 0);
    if (isSequential && values[0] >= 0 && values[0] <= 1) {
      // Likely a Likert scale (1-5, 0-10, etc.)
      return true;
    }
  }

  return false;
}

/**
 * Detect if a variable is a date type based on SPSS format specification
 * Common SPSS date formats: DATE, ADATE, EDATE, SDATE, DATETIME, TIME, etc.
 */
function isDateFormat(format: string | undefined): boolean {
  if (!format) return false;
  const dateFormats = ['DATE', 'ADATE', 'EDATE', 'SDATE', 'JDATE', 'QYR', 'MOYR', 'WKYR', 'DATETIME', 'TIME', 'DTIME', 'WKDAY', 'MONTH'];
  const upperFormat = format.toUpperCase();
  return dateFormats.some(df => upperFormat.startsWith(df));
}

/**
 * Heuristic Grid Detection Helpers
 *
 * These functions detect implicit variable sets (grids) based on:
 * - Shared value label sets
 * - Sequential naming patterns (e.g., Q1, Q2, Q3)
 * - Consecutive file positions
 */

interface VariableWithIndex {
  variable: Variable;
  index: number;
  valueLabelSetName?: string;
}

/**
 * Detect by position: consecutive variables in the original file
 */
function detectByPosition(vars: VariableWithIndex[]): Variable[] {
  if (vars.length < 3) return [];

  // Sort by original file index
  const sorted = [...vars].sort((a, b) => a.index - b.index);

  // Find longest consecutive sequence (allowing gap of 1)
  let bestGroup: Variable[] = [];
  let currentGroup: Variable[] = [sorted[0].variable];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    // Allow gap of 1 (consecutive or adjacent)
    if (curr.index - prev.index <= 2) {
      currentGroup.push(curr.variable);
    } else {
      if (currentGroup.length >= 3 && currentGroup.length > bestGroup.length) {
        bestGroup = [...currentGroup];
      }
      currentGroup = [curr.variable];
    }
  }

  // Check final group
  if (currentGroup.length >= 3 && currentGroup.length > bestGroup.length) {
    bestGroup = currentGroup;
  }

  return bestGroup;
}

/**
 * Detect by naming: sequential numeric suffixes (e.g., Q1, Q2, Q3)
 */
function detectByNaming(vars: Variable[]): Variable[] {
  if (vars.length < 3) return [];

  // Extract patterns: prefix + number
  const patterns = vars.map(v => {
    // Match: "impact1", "Q5_1", "rating_01"
    const match = v.name.match(/^([a-zA-Z_]+?)(\d+)$/);
    if (!match) return null;
    return { variable: v, prefix: match[1], number: parseInt(match[2], 10) };
  }).filter((p): p is { variable: Variable; prefix: string; number: number } => p !== null);

  if (patterns.length < 3) return [];

  // Group by common prefix
  const byPrefix = new Map<string, typeof patterns>();
  for (const p of patterns) {
    if (!byPrefix.has(p.prefix)) byPrefix.set(p.prefix, []);
    byPrefix.get(p.prefix)!.push(p);
  }

  // Find largest sequential group with same prefix
  let bestGroup: Variable[] = [];
  for (const [prefix, group] of byPrefix.entries()) {
    if (group.length < 3) continue;

    // Sort by number
    group.sort((a, b) => a.number - b.number);

    // Check if sequential (allowing gaps)
    const numbers = group.map(g => g.number);
    const range = numbers[numbers.length - 1] - numbers[0];

    // Accept if: (1) truly sequential OR (2) range < 2x count (allows small gaps)
    if (range === numbers.length - 1 || range < numbers.length * 2) {
      const vars = group.map(g => g.variable);
      if (vars.length > bestGroup.length) {
        bestGroup = vars;
      }
    }
  }

  return bestGroup;
}

/**
 * Detect sequential patterns using both position and naming methods
 */
function detectSequentialPattern(vars: VariableWithIndex[]): Variable[] {
  // Method 1: Position-based detection (primary)
  const positionGroup = detectByPosition(vars);

  // Method 2: Name-based detection (fallback)
  const nameGroup = detectByNaming(vars.map(v => v.variable));

  // Return the largest group found
  return positionGroup.length >= nameGroup.length ? positionGroup : nameGroup;
}

/**
 * Infer which value represents "positive" in binary scales (e.g., Yes/No, True/False)
 */
function inferPositiveValue(valueLabels: { value: number; label: string }[]): number {
  // Common positive indicators
  const positivePatterns = /yes|true|selected|agree|1/i;

  // Try to match label text
  for (const vl of valueLabels) {
    if (positivePatterns.test(vl.label)) {
      return vl.value;
    }
  }

  // Fallback: assume higher value is positive
  return Math.max(...valueLabels.map(vl => vl.value));
}

async function loadSAV(buffer: ArrayBuffer): Promise<{ variables: Variable[]; variableSets: VariableSet[]; rowCount: number; durationMs: number }> {
  if (!db || !conn) throw new Error('DB not initialized');

  const start = performance.now();

  // Use the new high-performance ReadStat WASM parser
  const { parseSavFile } = await import('@velocity/readstat-wasm');

  // Parse the SAV file
  const parsed = await parseSavFile(buffer, (progress) => {
    // Could emit progress events here if needed
    console.log(`📊 [Worker] Parse progress: ${(progress.progress * 100).toFixed(1)}%`);
  });

  // Convert variables to the format expected by the store
  const variables: Variable[] = parsed.metadata.variables.map(v => {
    // 1. Generate ID (using name as unique identifier)
    const id = v.name;

    // 2. Transform Value Labels first (needed for type detection)
    let valueLabels: { value: number; label: string }[] = [];
    if (v.valueLabelSetName && parsed.metadata.valueLabelSets[v.valueLabelSetName]) {
      valueLabels = parsed.metadata.valueLabelSets[v.valueLabelSetName].map((vl: any) => ({
        value: vl.value,
        label: vl.label
      }));
    }

    // 3. Map Types using survey-centric type system:
    //    - text: String variables
    //    - date: Variables with date formats (when format info is available)
    //    - ordinal: Numeric with value labels that suggest ordered scale
    //    - nominal: Numeric with value labels (unordered categorical)
    //    - scale: Numeric without value labels (continuous)
    let type: 'nominal' | 'ordinal' | 'scale' | 'text' | 'date';

    if (v.type === 'string') {
      // String type → 'text'
      type = 'text';
    } else if ((v as any).format && isDateFormat((v as any).format)) {
      // SPSS date format → 'date' (when format info is available)
      type = 'date';
    } else if (valueLabels.length > 0) {
      // Has value labels - check if ordinal or nominal
      type = isOrdinal(valueLabels) ? 'ordinal' : 'nominal';
    } else {
      // Numeric without value labels → 'scale'
      type = 'scale';
    }

    return {
      id,
      name: v.name,
      label: v.label || v.name,
      type,
      valueLabels,
      missingValues: { discrete: [], range: undefined }
    };
  });

  // Build variable name to ID map
  const varNameToId = new Map<string, string>();
  for (const v of variables) {
    varNameToId.set(v.name, v.id);
  }

  // Track which variables are part of MR sets
  const variablesInMRSets = new Set<string>();

  // Create VariableSets from Multiple Response Sets
  const variableSets: VariableSet[] = [];
  const mrSets = parsed.metadata.multipleResponseSets || [];

  for (const mrSet of mrSets) {
    // Map subvariable names to IDs
    const variableIds: string[] = [];
    for (const subvarName of mrSet.subvariables) {
      const varId = varNameToId.get(subvarName);
      if (varId) {
        variableIds.push(varId);
        variablesInMRSets.add(varId);
      } else {
        console.warn(`📊 [Worker] MR set "${mrSet.name}" references unknown variable "${subvarName}"`);
      }
    }

    if (variableIds.length > 0) {
      // Determine structure type: 'C' = category/grid, 'D' = dichotomy/multiple
      const structure = mrSet.type === 'C' ? 'grid' : 'multiple';

      // Clean up name (MR set names often start with $)
      const cleanName = mrSet.name.startsWith('$') ? mrSet.name.slice(1) : mrSet.name;

      // Infer variable type from first variable in the set
      const firstVar = variables.find(v => v.id === variableIds[0]);
      const setType = firstVar?.type;

      variableSets.push({
        id: `mrset_${cleanName}`,
        name: mrSet.label || cleanName,
        variableIds,
        structure,
        type: setType,
        description: mrSet.type === 'D'
          ? `Multiple response set (counted value: ${mrSet.countedValue})`
          : 'Grid/category set'
      });

      console.log(`📊 [Worker] Created ${structure} VariableSet "${mrSet.label || cleanName}" with ${variableIds.length} variables`);
    }
  }

  // ============================================================================
  // Heuristic Grid Detection
  // ============================================================================

  // Step 1: Collect ungrouped variables (not in MR sets)
  const ungroupedVariables = variables.filter(v => !variablesInMRSets.has(v.id));

  // Step 2: Group by shared value label set
  const byValueLabelSet = new Map<string, VariableWithIndex[]>();
  for (const v of ungroupedVariables) {
    const parsedVar = parsed.metadata.variables.find(pv => pv.name === v.id);
    const setName = parsedVar?.valueLabelSetName;
    if (setName) {
      if (!byValueLabelSet.has(setName)) {
        byValueLabelSet.set(setName, []);
      }
      byValueLabelSet.get(setName)!.push({
        variable: v,
        index: parsedVar?.index ?? -1,
        valueLabelSetName: setName
      });
    }
  }

  // Step 3: Detect sequential patterns within each group
  for (const [labelSetName, varsInGroup] of byValueLabelSet.entries()) {
    if (varsInGroup.length < 3) continue; // Minimum threshold

    // Try to detect sequential naming patterns
    const gridCandidates = detectSequentialPattern(varsInGroup);

    if (gridCandidates.length >= 3) {
      // Check if this should be a multi-response set (binary value labels)
      const valueLabels = parsed.metadata.valueLabelSets[labelSetName];
      const isBinary = valueLabels && valueLabels.length === 2;

      let structure: 'grid' | 'multiple' = 'grid';
      let countedValue: number | undefined;

      // Sort variables by name for consistent ordering
      gridCandidates.sort((a, b) => a.name.localeCompare(b.name));

      const variableIds = gridCandidates.map(v => v.id);
      const firstVar = gridCandidates[0];

      // Extract common prefix for set name
      const prefix = firstVar.name.match(/^([a-zA-Z_]+?)\d+$/)?.[1] || 'Set';

      // Mark variables as grouped
      for (const v of gridCandidates) {
        variablesInMRSets.add(v.id);
      }

      if (isBinary) {
        // Default to 'multiple' structure for binary questions
        structure = 'multiple';

        // Infer positive value (higher value, or match common patterns)
        countedValue = inferPositiveValue(valueLabels);

        console.log(`📊 [Worker] Detected implicit multi-response "${prefix}" with ${gridCandidates.length} variables (counted value: ${countedValue})`);

        variableSets.push({
          id: `heuristic_${structure}_${prefix}_${labelSetName}`,
          name: `${prefix} (${gridCandidates.length} items)`,
          variableIds,
          structure,
          type: firstVar.type,
          countedValue,
          description: `Detected multi-response with shared Yes/No scale`
        });
      } else {
        console.log(`📊 [Worker] Detected implicit grid "${prefix}" with ${gridCandidates.length} variables`);

        variableSets.push({
          id: `heuristic_${structure}_${prefix}_${labelSetName}`,
          name: `${prefix} (${gridCandidates.length} items)`,
          variableIds,
          structure,
          type: firstVar.type,
          description: `Detected grid with shared scale: ${labelSetName}`
        });
      }
    }
  }

  // Create 'single' VariableSets for variables NOT in any MR set or detected grid
  for (const v of variables) {
    if (!variablesInMRSets.has(v.id)) {
      variableSets.push({
        id: `vs_${v.id}`,
        name: v.label || v.name,
        variableIds: [v.id],
        structure: 'single',
        type: v.type
      });
    }
  }

  const detectedGrids = variableSets.filter(vs => vs.id.startsWith('heuristic_'));
  console.log(`📊 [Worker] Created ${variableSets.length} VariableSets (${mrSets.length} MR sets, ${detectedGrids.length} detected grids, ${variableSets.length - mrSets.length - detectedGrids.length} single variables)`);

  // Pivot data from row-major to column-major for Arrow
  const numRows = parsed.rows.length;
  const numCols = parsed.metadata.variables.length;

  console.log(`📊 [Worker] DEBUG: parsed.rows.length = ${numRows}, metadata.rowCount = ${parsed.metadata.rowCount}, variables = ${numCols}`);

  // Check if we have actual data
  if (numRows === 0) {
    console.error(`📊 [Worker] ERROR: No rows parsed! Metadata claims ${parsed.metadata.rowCount} rows but parsed.rows is empty.`);
    throw new Error(`SAV parsing failed: No row data extracted (expected ${parsed.metadata.rowCount} rows)`);
  }

  const columnsData: any[][] = Array.from({ length: numCols }, () => new Array(numRows));

  for (let r = 0; r < numRows; r++) {
    const row = parsed.rows[r];
    for (let c = 0; c < numCols; c++) {
      columnsData[c][r] = row[c];
    }
  }

  console.log(`📊 [Worker] DEBUG: First row sample: ${JSON.stringify(parsed.rows[0]?.slice(0, 5))}`);

  // Create Arrow Vectors
  const vectors: Record<string, arrow.Vector> = {};

  parsed.metadata.variables.forEach((v, i) => {
    // ReadStat 'numeric' is generally Double, 'string' is UTF8
    const data = columnsData[i];

    if (v.type === 'numeric') {
      // Using Float64 for all numerics from ReadStat to be safe
      vectors[v.name] = arrow.vectorFromArray(data, new arrow.Float64());
    } else {
      vectors[v.name] = arrow.vectorFromArray(data, new arrow.Utf8());
    }
  });

  // Create Arrow Table
  const table = new arrow.Table(vectors);
  console.log(`📊 [Worker] DEBUG: Arrow table created with ${table.numRows} rows, ${table.numCols} columns`);

  // Bulk load into DuckDB
  // Drop existing table first to ensure clean state
  await conn.query(`DROP TABLE IF EXISTS main`);
  console.log(`📊 [Worker] DEBUG: Inserting Arrow table into DuckDB...`);

  try {
    const insertStart = performance.now();
    await conn.insertArrowTable(table, { name: 'main', create: true });
    const insertDuration = performance.now() - insertStart;
    console.log(`📊 [Worker] DEBUG: Arrow table inserted successfully in ${insertDuration.toFixed(2)}ms`);

    // Verify the table was actually created
    // Note: DuckDB returns BigInt for COUNT(*), so we convert to Number for comparison
    const verifyResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
    const count = Number(verifyResult.toArray()[0]?.cnt);

    if (count !== numRows) {
      throw new Error(`Arrow insertion verification failed: expected ${numRows} rows, got ${count}`);
    }

    console.log(`📊 [Worker] DEBUG: Verification passed - Table 'main' has ${count} rows`);
  } catch (insertError: any) {
    // Log detailed error for debugging - Arrow insertion should NOT fail with correct versions
    console.error(`📊 [Worker] CRITICAL: insertArrowTable failed!`, {
      error: insertError.message,
      numRows,
      numCols,
    });
    throw new Error(`Arrow insertion failed: ${insertError.message}. Check apache-arrow version compatibility.`);
  }

  const durationMs = performance.now() - start;
  console.log(`🦆 [Worker] Loaded SAV with ReadStat-WASM: ${parsed.metadata.rowCount} rows, ${variables.length} variables in ${durationMs.toFixed(2)}ms`);

  return { variables, variableSets, rowCount: parsed.metadata.rowCount, durationMs };
}

async function getSchema(): Promise<{ name: string; type: string }[]> {
  if (!conn) throw new Error('DB not initialized');

  const result = await conn.query(`PRAGMA table_info('main')`);
  return result.toArray().map((row: any) => ({
    name: row.name,
    type: row.type,
  }));
}

async function runQuery(sql: string): Promise<{ data: any[]; durationMs: number }> {
  if (!conn) throw new Error('DB not initialized');

  const start = performance.now();
  const result = await conn.query(sql);
  const durationMs = performance.now() - start;

  console.log(`⏱️ [Worker] Query took ${durationMs.toFixed(2)}ms: ${sql}`);

  return {
    data: result.toArray().map((row) => row.toJSON()),
    durationMs,
  };
}

async function getUniqueValues(column: string): Promise<string[]> {
  if (!conn) throw new Error('DB not initialized');

  const result = await conn.query(`SELECT DISTINCT "${column}" as val FROM main ORDER BY val LIMIT 50`);
  return result.toArray().map((row) => String(row.val));
}

async function getVariableStats(
  column: string,
  variableType?: 'nominal' | 'ordinal' | 'scale' | 'text' | 'date'
): Promise<VariableStatsResult> {
  if (!conn) throw new Error('DB not initialized');

  // Get total count
  const totalResult = await conn.query(`SELECT COUNT(*) as cnt FROM main`);
  const totalCount = Number(totalResult.toArray()[0]?.cnt);

  // Get missing count (NULL values)
  const missingResult = await conn.query(`SELECT COUNT(*) as cnt FROM main WHERE "${column}" IS NULL`);
  const missingCount = Number(missingResult.toArray()[0]?.cnt);

  // Get frequency distribution (top 10 values by count)
  const freqResult = await conn.query(`
    SELECT "${column}" as value, COUNT(*) as cnt
    FROM main
    WHERE "${column}" IS NOT NULL
    GROUP BY "${column}"
    ORDER BY cnt DESC
    LIMIT 10
  `);

  const frequencies: VariableStatsFrequency[] = freqResult.toArray().map((row: any) => ({
    value: row.value,
    count: Number(row.cnt),
  }));

  const result: VariableStatsResult = {
    column,
    frequencies,
    missingCount,
    totalCount,
  };

  // Compute numeric statistics for scale variables
  if (variableType === 'scale') {
    try {
      // Get summary statistics using DuckDB's built-in functions
      const statsResult = await conn.query(`
        SELECT
          MIN("${column}") as min_val,
          MAX("${column}") as max_val,
          AVG("${column}") as mean_val,
          MEDIAN("${column}") as median_val,
          STDDEV("${column}") as stddev_val,
          QUANTILE_CONT("${column}", 0.25) as q1_val,
          QUANTILE_CONT("${column}", 0.75) as q3_val
        FROM main
        WHERE "${column}" IS NOT NULL
      `);

      const statsRow = statsResult.toArray()[0];

      if (statsRow && statsRow.min_val !== null && statsRow.max_val !== null) {
        const minVal = Number(statsRow.min_val);
        const maxVal = Number(statsRow.max_val);
        const mean = Number(statsRow.mean_val) || 0;
        const median = Number(statsRow.median_val) || 0;
        const stdDev = Number(statsRow.stddev_val) || 0;
        const q1 = Number(statsRow.q1_val) || minVal;
        const q3 = Number(statsRow.q3_val) || maxVal;

        // Compute histogram bins (10 bins by default)
        const binCount = 10;
        const range = maxVal - minVal;
        const binWidth = range > 0 ? range / binCount : 1;

        // Compute histogram using FLOOR for bucket assignment
        // LEAST ensures values at maxVal go into the last bin (bin 10, not 11)
        const histResult = await conn.query(`
          SELECT
            CASE
              WHEN ${range} = 0 THEN 1
              ELSE LEAST(FLOOR(("${column}" - ${minVal}) / ${binWidth}) + 1, ${binCount})::INTEGER
            END as bucket,
            COUNT(*) as cnt
          FROM main
          WHERE "${column}" IS NOT NULL
          GROUP BY bucket
          ORDER BY bucket
        `);

        const histogramBins: HistogramBin[] = [];
        const bucketCounts = new Map<number, number>();

        for (const row of histResult.toArray()) {
          bucketCounts.set(Number(row.bucket), Number(row.cnt));
        }

        // Create bins with proper boundaries
        for (let i = 1; i <= binCount; i++) {
          histogramBins.push({
            x0: minVal + (i - 1) * binWidth,
            x1: minVal + i * binWidth,
            count: bucketCounts.get(i) || 0,
          });
        }

        result.numeric = {
          min: minVal,
          max: maxVal,
          mean,
          median,
          stdDev,
          q1,
          q3,
          histogramBins,
        };

        console.log(`🦆 [Worker] Computed numeric stats for ${column}:`, {
          min: minVal,
          max: maxVal,
          mean: mean.toFixed(2),
          median: median.toFixed(2),
          binCount: histogramBins.length,
        });
      }
    } catch (error: any) {
      console.warn(`🦆 [Worker] Failed to compute numeric stats for ${column}:`, error.message);
      // Continue without numeric stats - frequencies will still be available
    }
  }

  return result;
}

async function recodeVariable(
  sourceCol: string,
  newColName: string,
  config: RecodeConfig
): Promise<string> {
  if (!conn) throw new Error('DB not initialized');

  const safeNewCol = newColName.replace(/[^a-zA-Z0-9_]/g, '_');

  await conn.query(`ALTER TABLE main ADD COLUMN "${safeNewCol}" VARCHAR`);

  let caseSql = `CASE `;

  if (config.mode === 'categorical' && config.mappings) {
    for (const [oldVal, newVal] of Object.entries(config.mappings)) {
      caseSql += `WHEN "${sourceCol}" = '${oldVal.replace(/'/g, "''")}' THEN '${newVal.replace(/'/g, "''")}' `;
    }
  } else if (config.mode === 'binning' && config.rules) {
    for (const rule of config.rules) {
      const parts: string[] = [];
      if (rule.min !== undefined) parts.push(`"${sourceCol}" >= ${rule.min}`);
      if (rule.max !== undefined) parts.push(`"${sourceCol}" < ${rule.max}`);

      if (parts.length > 0) {
        caseSql += `WHEN ${parts.join(' AND ')} THEN '${rule.label.replace(/'/g, "''")}' `;
      }
    }
  }

  // Single ELSE clause with proper CAST for type safety
  caseSql += `ELSE CAST("${sourceCol}" AS VARCHAR) END`;

  await conn.query(`UPDATE main SET "${safeNewCol}" = ${caseSql}`);

  return safeNewCol;
}

// Message handler
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  try {
    switch (request.type) {
      case 'init':
        const initResult = await init(request.forceCleanStart);
        if (initResult.corruptionDetected) {
          self.postMessage({
            type: 'corruptionDetected',
            message: initResult.corruptionMessage || 'OPFS database corruption detected'
          } as WorkerResponse);
        } else {
          self.postMessage({
            type: 'ready',
            opfsAvailable: initResult.opfsAvailable
          } as WorkerResponse);
        }
        break;

      case 'loadCSV':
        const csvResult = await loadCSV(request.fileName, request.content);
        self.postMessage({
          type: 'csvLoaded',
          schema: csvResult.schema,
          rowCount: csvResult.rowCount,
          durationMs: csvResult.durationMs
        } as WorkerResponse);
        break;

      case 'loadSAV':
        const savResult = await loadSAV(request.buffer);
        self.postMessage({
          type: 'savLoaded',
          variables: savResult.variables,
          variableSets: savResult.variableSets,
          rowCount: savResult.rowCount,
          durationMs: savResult.durationMs,
        } as WorkerResponse);
        break;

      case 'query':
        const queryResult = await runQuery(request.sql);
        self.postMessage({
          type: 'queryResult',
          data: queryResult.data,
          durationMs: queryResult.durationMs,
        } as WorkerResponse);
        break;

      case 'getSchema':
        const schemaResult = await getSchema();
        self.postMessage({ type: 'schema', data: schemaResult } as WorkerResponse);
        break;

      case 'getUniqueValues':
        const uniqueVals = await getUniqueValues(request.column);
        self.postMessage({ type: 'uniqueValues', data: uniqueVals } as WorkerResponse);
        break;

      case 'getVariableStats':
        const stats = await getVariableStats(request.column, request.variableType);
        self.postMessage({ type: 'variableStats', stats } as WorkerResponse);
        break;

      case 'recodeVariable':
        const newCol = await recodeVariable(request.sourceCol, request.newColName, request.config);
        self.postMessage({ type: 'recodeComplete', newColName: newCol } as WorkerResponse);
        break;

      case 'checkPersistedData':
        const persistedResult = await checkPersistedData();
        if (persistedResult.exists) {
          self.postMessage({
            type: 'persistedDataFound',
            schema: persistedResult.schema!,
            rowCount: persistedResult.rowCount!
          } as WorkerResponse);
        } else {
          self.postMessage({ type: 'noPersistedData' } as WorkerResponse);
        }
        break;

      case 'clearPersistedData':
        await clearPersistedData();
        self.postMessage({ type: 'persistedDataCleared' } as WorkerResponse);
        break;
    }
  } catch (error: any) {
    console.error('[Worker] Error:', error);
    self.postMessage({ type: 'error', message: error.message || 'Unknown error' } as WorkerResponse);
  }
};
