import { AnalysisRunner } from './AnalysisRunner';

/**
 * AnalysisRegistry
 * 
 * Central registry for analysis runners.
 */
class AnalysisRegistry {
    private runners = new Map<string, AnalysisRunner<any, any>>();

    /**
     * Register a new analysis runner
     */
    register(runner: AnalysisRunner<any, any>): void {
        if (this.runners.has(runner.id)) {
            console.warn(`AnalysisRunner with id "${runner.id}" is already registered. Overwriting.`);
        }
        this.runners.set(runner.id, runner);
    }

    /**
     * Get a runner by ID
     */
    get(id: string): AnalysisRunner<any, any> | undefined {
        return this.runners.get(id);
    }

    /**
     * List all registered runners
     */
    list(): Array<{ id: string; label: string; configSchema: Record<string, unknown> }> {
        return Array.from(this.runners.values()).map(r => ({
            id: r.id,
            label: r.label,
            configSchema: r.configSchema,
        }));
    }
}

// Singleton instance
export const analysisRegistry = new AnalysisRegistry();
