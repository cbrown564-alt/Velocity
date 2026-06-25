import { describe, expect, it } from 'vitest';
import { getPersistenceDisplayMessage } from './persistenceDisplay';

describe('getPersistenceDisplayMessage', () => {
  it('returns null when no error or hint', () => {
    expect(getPersistenceDisplayMessage(null, null)).toEqual({
      headline: null,
      detail: null,
    });
  });

  it('prefers errorHint as headline with raw error in detail', () => {
    const raw = 'createSyncAccessHandle: Access Handles cannot be created';
    const hint = 'Close other Velocity tabs and reload.';
    expect(getPersistenceDisplayMessage(raw, hint)).toEqual({
      headline: hint,
      detail: raw,
    });
  });

  it('maps OPFS access-handle errors to plain-language headline', () => {
    const raw = 'createSyncAccessHandle: another open access handle';
    const result = getPersistenceDisplayMessage(raw, null);
    expect(result.headline).toContain('another Velocity tab');
    expect(result.detail).toBe(raw);
  });

  it('maps corrupt database errors to rebuild guidance', () => {
    const raw = 'File is not a valid DuckDB database file';
    const result = getPersistenceDisplayMessage(raw, null);
    expect(result.headline).toContain('could not be opened');
    expect(result.detail).toBe(raw);
  });

  it('falls back to generic storage headline for unknown errors', () => {
    const raw = 'Unexpected persistence failure';
    const result = getPersistenceDisplayMessage(raw, null);
    expect(result.headline).toBe('There was a problem with local storage.');
    expect(result.detail).toBe(raw);
  });
});
