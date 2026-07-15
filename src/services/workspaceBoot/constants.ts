/** Maximum time to spend trying OPFS cache opens before abandoning to rebuild. */
export const CACHE_OPEN_BUDGET_MS = 2000;

/** Per-attempt timeout for a single OPFS DB open. */
export const OPFS_ATTEMPT_TIMEOUT_MS = 2000;

/**
 * Bounded wait for a worker's graceful-shutdown acknowledgement before we hard
 * terminate it during respawn. Replaces the old fixed post-terminate sleep: in
 * the common (idle) case the ack lands in ~ms and we *know* the OPFS handle and
 * lock are released before the next worker boots.
 */
export const ENGINE_SHUTDOWN_ACK_TIMEOUT_MS = 3000;

/** End-to-end deadline for the analysis worker to acknowledge engine.ready. */
export const ENGINE_BOOT_TIMEOUT_MS = 90_000;

/** Worker-side phase deadlines. These identify the stalled boundary precisely. */
export const DUCKDB_BUNDLE_SELECT_TIMEOUT_MS = 10_000;
export const DUCKDB_INSTANTIATE_TIMEOUT_MS = 60_000;
export const DUCKDB_OPFS_SETUP_TIMEOUT_MS = 12_000;
export const DUCKDB_CONNECT_TIMEOUT_MS = 10_000;
