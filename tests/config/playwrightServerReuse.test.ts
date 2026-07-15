import { describe, expect, it } from 'vitest';

import { shouldReuseExistingPlaywrightServer } from '../../playwright.config';

describe('Playwright server ownership', () => {
  it('reuses the journey wrapper server in CI when the caller owns it', () => {
    expect(shouldReuseExistingPlaywrightServer({ ci: 'true', skipDevServer: '1' })).toBe(true);
  });

  it('does not borrow an unrelated server in ordinary CI jobs', () => {
    expect(shouldReuseExistingPlaywrightServer({ ci: 'true', skipDevServer: undefined })).toBe(false);
  });

  it('keeps local reuse for interactive development', () => {
    expect(shouldReuseExistingPlaywrightServer({ ci: undefined, skipDevServer: undefined })).toBe(true);
  });
});
