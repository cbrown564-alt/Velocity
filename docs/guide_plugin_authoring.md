# Plugin Authoring Guide: Analysis Runners

Velocity allows extending its analysis capabilities through a plugin architecture. You can add new statistical analysis types (e.g., Regression, Cluster Analysis, Factor Analysis) by implementing the `AnalysisRunner` interface.

## The `AnalysisRunner` Interface

Each analysis runner must implement the following interface defined in `src/core/analysis/AnalysisRunner.ts`:

```typescript
export interface AnalysisRunner<TConfig, TResult> {
  /** Unique identifier, e.g. "regression" */
  readonly id: string;

  /** Human-readable name for UI display */
  readonly label: string;

  /** JSON schema describing TConfig (for UI form generation) */
  readonly configSchema: Record<string, unknown>;

  /** Execute the analysis */
  run(adapter: DatabaseAdapter, config: TConfig): Promise<TResult>;

  /** Optional: validate config before execution */
  validate?(config: TConfig): string[]; // Returns error messages, empty = valid
}
```

## Step-by-Step Implementation

### 1. Create your Runner

Create a new file in `src/core/analysis/` (e.g., `regressionRunner.ts`):

```typescript
import { AnalysisRunner } from './AnalysisRunner';
import { analysisRegistry } from './registry';
import { DatabaseAdapter } from '../DatabaseAdapter';

export interface RegressionConfig {
  dependentVar: string;
  independentVars: string[];
}

export class RegressionRunner implements AnalysisRunner<RegressionConfig, any> {
  readonly id = 'regression';
  readonly label = 'Linear Regression';
  readonly configSchema = {
    type: 'object',
    properties: {
      dependentVar: { type: 'string' },
      independentVars: { type: 'array', items: { type: 'string' } }
    },
    required: ['dependentVar', 'independentVars']
  };

  async run(adapter: DatabaseAdapter, config: RegressionConfig): Promise<any> {
    // Implement your logic here using the adapter
    // Example: const res = await adapter.query('SELECT ...');
    return { status: 'success', data: [] };
  }
}

// Register the runner
analysisRegistry.register(new RegressionRunner());
```

### 2. Registering the Plugin

By calling `analysisRegistry.register()` in your module, the plugin becomes available to both the Web Worker and the CLI once the module is imported.

### 3. Usage

#### From the CLI
```bash
npx tsx cli/velocity.ts analyze data.csv regression --config '{"dependentVar": "y", "independentVars": ["x1", "x2"]}'
```

#### From the Worker (Message Passing)
```typescript
worker.postMessage({
  type: 'runAnalysis',
  id: 'regression',
  config: {
    dependentVar: 'y',
    independentVars: ['x1', 'x2']
  }
});
```

## Best Practices

- **Database Agnostic**: Always use the `DatabaseAdapter` to run queries. This ensures your plugin works both in the browser (DuckDB-WASM) and the CLI (DuckDB-Node).
- **Schema Validation**: Provide a clear `configSchema` to help the UI generate appropriate forms.
- **Error Handling**: Throw descriptive errors in the `run` method; they will be caught and reported by the worker/CLI.
