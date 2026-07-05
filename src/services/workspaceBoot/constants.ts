/** Maximum time to spend trying OPFS cache opens before abandoning to rebuild. */
export const CACHE_OPEN_BUDGET_MS = 2000;

/** Per-attempt timeout for a single OPFS DB open. */
export const OPFS_ATTEMPT_TIMEOUT_MS = 2000;

/** Delay after worker termination before respawn. */
export const RESPAWN_TERMINATION_DELAY_MS = 100;
