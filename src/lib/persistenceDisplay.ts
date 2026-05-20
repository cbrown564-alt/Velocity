/**
 * User-facing persistence / OPFS copy (UXR-040, UXR-047).
 * Raw browser exceptions are kept in `detail` for optional disclosure.
 */
export function getPersistenceDisplayMessage(
  error: string | null,
  errorHint: string | null,
): { headline: string | null; detail: string | null } {
  if (!error && !errorHint) {
    return { headline: null, detail: null };
  }

  if (errorHint) {
    return { headline: errorHint, detail: error };
  }

  if (!error) {
    return { headline: null, detail: null };
  }

  const normalized = error.toLowerCase();

  if (
    normalized.includes('access handle') ||
    normalized.includes('writable stream') ||
    normalized.includes('another open access handle')
  ) {
    return {
      headline:
        'Local storage is locked — another Velocity tab may be using it. Close other tabs and reload.',
      detail: error,
    };
  }

  if (normalized.includes('not a valid duckdb') || normalized.includes('corrupt')) {
    return {
      headline:
        'The saved database could not be opened. Velocity can rebuild from your source file when available.',
      detail: error,
    };
  }

  return {
    headline: 'There was a problem with local storage.',
    detail: error,
  };
}
