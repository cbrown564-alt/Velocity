import type { Page } from '@playwright/test';

/** Trigger deferred engine warm-up (Plan 06 Phase 4 — intent-based init). */
export async function warmUpEngine(page: Page, source = 'e2e'): Promise<void> {
  await page.evaluate((warmUpSource) => {
    const warmUp = (window as Window & { __velocityWarmUpEngine?: (s: string) => Promise<void> })
      .__velocityWarmUpEngine;
    if (!warmUp) {
      throw new Error('__velocityWarmUpEngine is not exposed on window');
    }
    return warmUp(warmUpSource);
  }, source);
}

export function waitForEngineReadyConsole(page: Page, timeoutMs = 60_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for analysis engine')), timeoutMs);
    page.on('console', function onConsole(message) {
      if (message.text().includes('Engine ready, OPFS available')) {
        clearTimeout(timer);
        page.off('console', onConsole);
        resolve();
      }
    });
  });
}
