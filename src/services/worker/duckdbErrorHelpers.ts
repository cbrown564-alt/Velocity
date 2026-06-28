export function getErrorMessage(error: unknown): string {
  return String((error as any)?.message || error || '');
}

export function isWriteModeCommitError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('file is not opened in write mode') ||
    (message.includes('failed to commit') && message.includes('write mode'))
  );
}

export function isCorruptionLikeError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('not a valid duckdb database file') ||
    message.includes('database file appears to be corrupted') ||
    message.includes('failed to scan dictionary string') ||
    message.includes('invalid bit width for bitpacking') ||
    message.includes('corrupt')
  );
}

export function isFatalDatabaseRuntimeError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return isCorruptionLikeError(error) || message.includes('out of bounds memory access');
}
