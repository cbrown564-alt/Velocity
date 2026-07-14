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
