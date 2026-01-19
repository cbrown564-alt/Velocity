import * as duckdb from '@duckdb/duckdb-wasm';

const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();

export class DuckDBService {
  private static instance: DuckDBService;
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): DuckDBService {
    if (!DuckDBService.instance) {
      DuckDBService.instance = new DuckDBService();
    }
    return DuckDBService.instance;
  }

  public async init() {
    if (this.isInitialized) return;

    // Select the best bundle for the browser
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
    console.log("🦆 DuckDB Bundle Selected:", bundle);

    if (!bundle.mainWorker) {
      throw new Error("No main worker URL found in bundle");
    }

    // Fix for "The operation is insecure" error:
    // Web Workers cannot be loaded directly from cross-origin URLs (CDNs).
    // We must fetch the script content and create a local Blob URL.
    const workerRes = await fetch(bundle.mainWorker);
    const workerScript = await workerRes.text();
    const workerBlob = new Blob([workerScript], { type: 'text/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);

    const worker = new Worker(workerUrl);
    const logger = new duckdb.ConsoleLogger();
    
    this.db = new duckdb.AsyncDuckDB(logger, worker);
    
    // CRITICAL FIX: Pass bundle.mainModule (WASM) to instantiate, NOT bundle.mainWorker (JS)
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    
    URL.revokeObjectURL(workerUrl);
    
    this.conn = await this.db.connect();
    this.isInitialized = true;
    console.log("🦆 DuckDB Initialized");
  }

  public async loadCSV(fileName: string, csvContent: string) {
    if (!this.db || !this.conn) throw new Error("DB not initialized");
    
    await this.db.registerFileText(fileName, csvContent);
    // Create main table
    await this.conn.query(`CREATE OR REPLACE TABLE main AS SELECT * FROM read_csv_auto('${fileName}')`);
  }

  public async getTableSchema(): Promise<{name: string, type: string}[]> {
     if (!this.conn) throw new Error("DB not initialized");
     
     // Get column names and types
     const result = await this.conn.query(`PRAGMA table_info('main')`);
     return result.toArray().map((row: any) => ({
        name: row.name,
        type: row.type
     }));
  }

  public async runQuery(sql: string): Promise<any[]> {
    if (!this.conn) throw new Error("DB not initialized");
    
    const start = performance.now();
    const result = await this.conn.query(sql);
    const end = performance.now();
    console.log(`⏱️ Query took ${(end - start).toFixed(2)}ms: ${sql}`);
    
    // Convert Apache Arrow result to JSON array
    return result.toArray().map((row) => row.toJSON());
  }

  // -- NEW: Get Unique Values for Recoding UI --
  public async getUniqueValues(column: string): Promise<string[]> {
    if (!this.conn) throw new Error("DB not initialized");
    const result = await this.conn.query(`SELECT DISTINCT "${column}" as val FROM main ORDER BY val LIMIT 50`);
    return result.toArray().map((row) => String(row.val));
  }

  // -- NEW: Create Computed Column --
  public async recodeVariable(sourceCol: string, newColName: string, mappings: Record<string, string>) {
     if (!this.conn) throw new Error("DB not initialized");

     // 1. Sanitize name (simple version)
     const safeNewCol = newColName.replace(/[^a-zA-Z0-9_]/g, '_');

     // 2. Add Column
     await this.conn.query(`ALTER TABLE main ADD COLUMN "${safeNewCol}" VARCHAR`);

     // 3. Build Case Statement
     let caseSql = `CASE `;
     for (const [oldVal, newVal] of Object.entries(mappings)) {
        // Simple SQL escaping for values
        caseSql += `WHEN "${sourceCol}" = '${oldVal.replace(/'/g, "''")}' THEN '${newVal.replace(/'/g, "''")}' `;
     }
     caseSql += `ELSE "${sourceCol}" END`;

     // 4. Update
     const updateSql = `UPDATE main SET "${safeNewCol}" = ${caseSql}`;
     await this.runQuery(updateSql);

     return safeNewCol;
  }
}

// Initializer helper for App
export const dbService = DuckDBService.getInstance();