import { test, expect, type Page } from '@playwright/test';

/**
 * Returning-session regression: a persisted OPFS database must reopen on reload
 * with its data intact and without hanging. This is the path COI could not do
 * (DataCloneError on registerFileHandle → wedged worker → infinite
 * "Initializing…"), which is why OPFS persistence runs on the single-threaded
 * EH bundle. Boots via the app's dev hooks to stay decoupled from landing UI.
 */

const HANDLE_ERROR = /createsyncaccesshandle|another open access handle|could not be cloned|dataclone/i;

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
    for (let i = 0; i < 200 && !w.__velocityWarmUpEngine; i++) await new Promise((r) => setTimeout(r, 50));
    await w.__velocityWarmUpEngine?.('e2e-reopen');
  });
}

interface EngineState {
  isDbReady: boolean;
  opfsAvailable: boolean;
  mode: string | undefined;
  activeDbPath: string | undefined;
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
    };
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

test('reopens a persisted OPFS database with data on reload (no clone error, no hang)', async ({ page }) => {
  test.setTimeout(180000);
  const handleErrors = trackHandleErrors(page);

  await page.goto('/');
  test.skip(!(await opfsSupported(page)), 'OPFS not supported in this environment');

  // First boot: fresh OPFS DB on the EH bundle.
  await warmUpEngine(page);
  await expect.poll(async () => (await readEngineState(page)).opfsAvailable, { timeout: 120000 }).toBe(true);

  // Ingest data into the OPFS DB and flush it to disk.
  const flush = await page.evaluate(async () => {
    const store = (
      window as unknown as { __velocityStore: { getState: () => Record<string, unknown> } }
    ).__velocityStore.getState();
    const engine = store.browserEngine as { loadCSV: (n: string, c: string) => Promise<unknown> };
    await engine.loadCSV('t.csv', 'a,b\n1,2\n3,4\n5,6');
    await (store.flushPersistedData as () => Promise<void>)();
    return true;
  });
  expect(flush).toBe(true);

  // Reload — worker torn down (lock released), the .db file persists in OPFS.
  await page.reload();
  await warmUpEngine(page);
  await expect.poll(async () => (await readEngineState(page)).isDbReady, { timeout: 60000 }).toBe(true);

  const second = await readEngineState(page);
  const ping = await page.evaluate(async () => {
    const store = (
      window as unknown as { __velocityStore: { getState: () => Record<string, unknown> } }
    ).__velocityStore.getState();
    const engine = store.browserEngine as { ping: () => Promise<{ hasData: boolean; rowCount?: number }> };
    return engine.ping();
  });

  // Fast reopen from the OPFS cache, with the data intact — and no collisions.
  expect(second.opfsAvailable).toBe(true);
  expect(second.activeDbPath?.startsWith('opfs://')).toBe(true);
  expect(ping.hasData).toBe(true);
  expect(ping.rowCount).toBe(3);
  expect(handleErrors).toEqual([]);
});
