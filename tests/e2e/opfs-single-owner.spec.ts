import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end verification of the OPFS single-owner fix (Layers 1–2) in a real
 * browser. Uses the app's dev test hooks (`__velocityWarmUpEngine`,
 * `__velocityStore`) to boot the engine directly, avoiding the landing UI so
 * this stays decoupled from front-end copy changes.
 */

const HANDLE_ERROR = /createsyncaccesshandle|another open access handle/i;

async function opfsSupported(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    try {
      if (!(self as unknown as { isSecureContext?: boolean }).isSecureContext) return false;
      if (!navigator.storage?.getDirectory) return false;
      await navigator.storage.getDirectory();
      return true;
    } catch {
      return false;
    }
  });
}

async function warmUpEngine(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const w = window as unknown as { __velocityWarmUpEngine?: (source: string) => Promise<void> };
    for (let i = 0; i < 200 && !w.__velocityWarmUpEngine; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    await w.__velocityWarmUpEngine?.('e2e-single-owner');
  });
}

interface EngineState {
  isDbReady: boolean;
  opfsAvailable: boolean;
  mode: string | undefined;
  activeDbPath: string | undefined;
  persistenceError: string | null;
}

async function readEngineState(page: Page): Promise<EngineState> {
  return page.evaluate(() => {
    const s = (
      window as unknown as { __velocityStore?: { getState: () => Record<string, unknown> } }
    ).__velocityStore?.getState();
    return {
      isDbReady: Boolean(s?.isDbReady),
      opfsAvailable: Boolean(s?.opfsAvailable),
      mode: s?.persistenceMode as string | undefined,
      activeDbPath: s?.activeDbPath as string | undefined,
      persistenceError: (s?.persistenceError as string | null) ?? null,
    };
  });
}

async function readOpfsDecisions(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('velocity-pilot-events');
      if (!raw) return [];
      const events = JSON.parse(raw) as Array<{ name: string; payload?: { decision?: string } }>;
      return events
        .filter((e) => e.name === 'opfs_decision')
        .map((e) => e.payload?.decision)
        .filter((d): d is string => Boolean(d));
    } catch {
      return [];
    }
  });
}

function trackHandleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if ((msg.type() === 'error' || msg.type() === 'warning') && HANDLE_ERROR.test(msg.text())) {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    if (HANDLE_ERROR.test(err.message)) errors.push(err.message);
  });
  return errors;
}

test.describe('OPFS single-owner boot', () => {
  test('single tab boots OPFS with no access-handle error', async ({ page }) => {
    test.setTimeout(180000);
    const handleErrors = trackHandleErrors(page);

    await page.goto('/');
    test.skip(!(await opfsSupported(page)), 'OPFS not supported in this environment');

    await warmUpEngine(page);
    await expect.poll(async () => (await readEngineState(page)).isDbReady, { timeout: 120000 }).toBe(true);

    const state = await readEngineState(page);
    expect(state.opfsAvailable).toBe(true);
    expect(state.activeDbPath?.startsWith('opfs://')).toBe(true);
    expect(handleErrors).toEqual([]);
  });

  test('second tab degrades to memory (opfs_locked) with no handle collision', async ({ browser }) => {
    test.setTimeout(180000);
    const context = await browser.newContext();

    const pageA = await context.newPage();
    pageA.on('dialog', (d) => d.dismiss());
    await pageA.goto('/');
    test.skip(!(await opfsSupported(pageA)), 'OPFS not supported in this environment');

    await warmUpEngine(pageA);
    await expect.poll(async () => (await readEngineState(pageA)).opfsAvailable, { timeout: 120000 }).toBe(true);

    // Tab A now owns the OPFS DB lock. Boot a second tab in the same origin.
    const pageB = await context.newPage();
    pageB.on('dialog', (d) => d.dismiss());
    const bHandleErrors = trackHandleErrors(pageB);
    await pageB.goto('/');

    await warmUpEngine(pageB);
    await expect.poll(async () => (await readEngineState(pageB)).isDbReady, { timeout: 120000 }).toBe(true);

    const bState = await readEngineState(pageB);
    const bDecisions = await readOpfsDecisions(pageB);

    // The contended tab must degrade cleanly to memory, recording opfs_locked,
    // and never surface the createSyncAccessHandle collision.
    expect(bDecisions).toContain('opfs_locked');
    expect(bState.opfsAvailable).toBe(false);
    expect(bState.isDbReady).toBe(true);
    expect(bState.persistenceError ?? '').not.toMatch(HANDLE_ERROR);
    expect(bHandleErrors).toEqual([]);

    await context.close();
  });
});
