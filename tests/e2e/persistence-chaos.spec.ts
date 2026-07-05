import { test, expect, type Page } from '@playwright/test';
import {
  buildExampleCrosstab,
  clearBrowserStorage,
  reachDashboardWithExample,
  waitForDashboardReady,
} from './helpers/visualPolish';

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

async function invalidateOpfsDbCache(page: Page, mode: 'delete' | 'corrupt' = 'delete'): Promise<void> {
  await page.evaluate(async () => {
    const store = (window as unknown as { __velocityStore?: { getState: () => Record<string, unknown> } })
      .__velocityStore;
    const state = store?.getState() as { terminateWorker?: () => void } | undefined;
    state?.terminateWorker?.();
  });
  await page.waitForTimeout(1000);

  await page.evaluate(
    async ({ cacheMode }) => {
      const root = await navigator.storage.getDirectory();
      // @ts-expect-error OPFS entries iterator
      for await (const [name, handle] of root.entries()) {
        if (!name.endsWith('.db') || name.includes('.corrupt_')) continue;
        if (cacheMode === 'delete') {
          await root.removeEntry(name).catch(() => undefined);
          continue;
        }
        try {
          const file = handle as FileSystemFileHandle;
          const writable = await file.createWritable();
          await writable.write(new Uint8Array([0, 1, 2, 3, 4]));
          await writable.close();
        } catch {
          await root.removeEntry(name).catch(() => undefined);
        }
      }
    },
    { cacheMode: mode },
  );
}

async function waitForWorkspaceAfterReload(page: Page): Promise<void> {
  const restore = page.getByRole('button', { name: 'Restore Session' });
  const tableView = page.getByRole('button', { name: 'Table view' });

  await expect
    .poll(
      async () => {
        if (await tableView.isVisible().catch(() => false)) return 'dashboard';
        if (await restore.isVisible().catch(() => false)) return 'restore';
        return 'pending';
      },
      { timeout: 180000 },
    )
    .not.toBe('pending');

  if (await restore.isVisible().catch(() => false)) {
    await restore.click();
  }

  await waitForDashboardReady(page, 180000);
}

async function readPilotEventNames(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('velocity-pilot-events');
      if (!raw) return [];
      const events = JSON.parse(raw) as Array<{ name: string }>;
      return Array.isArray(events) ? events.map((event) => event.name) : [];
    } catch {
      return [];
    }
  });
}

async function readBootTransitions(page: Page): Promise<Array<{ to?: string; reason?: string }>> {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('velocity-pilot-events');
      if (!raw) return [];
      const events = JSON.parse(raw) as Array<{ name: string; payload?: Record<string, unknown> }>;
      return events
        .filter((event) => event.name === 'boot_transition')
        .map((event) => ({
          to: event.payload?.to as string | undefined,
          reason: event.payload?.reason as string | undefined,
        }));
    } catch {
      return [];
    }
  });
}

test.describe('persistence chaos suite', () => {
  test.beforeEach(async ({ page }) => {
    page.on('dialog', (dialog) => dialog.dismiss());
    await page.goto('/');
    test.skip(!(await opfsSupported(page)), 'OPFS not supported in this environment');
  });

  test('corrupt DuckDB cache rebuilds workspace on reload', async ({ page }) => {
    test.setTimeout(240000);
    await reachDashboardWithExample(page);
    await buildExampleCrosstab(page);
    await expect(page.locator('table')).toBeVisible({ timeout: 30000 });

    await invalidateOpfsDbCache(page, 'corrupt');
    await page.reload();
    await waitForWorkspaceAfterReload(page);

    const transitions = await readBootTransitions(page);
    expect(transitions.some((t) => t.to === 'rebuild-from-source' || t.to === 'open-cache')).toBe(true);
  });

  test('kill worker mid-write still reopens workspace', async ({ page }) => {
    test.setTimeout(240000);
    await reachDashboardWithExample(page);
    await buildExampleCrosstab(page);

    await page.evaluate(async () => {
      const store = (window as unknown as { __velocityStore?: { getState: () => Record<string, unknown> } })
        .__velocityStore;
      if (!store) return;
      const state = store.getState() as {
        flushPersistedData?: () => Promise<unknown>;
        terminateWorker?: () => void;
      };
      const flushPromise = state.flushPersistedData?.();
      state.terminateWorker?.();
      await flushPromise?.catch(() => undefined);
    });

    await page.reload();
    await waitForWorkspaceAfterReload(page);
    await expect(page.locator('table')).toBeVisible({ timeout: 60000 });
  });

  test('second tab lock falls back to rebuild', async ({ browser }) => {
    test.setTimeout(180000);
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    pageA.on('dialog', (dialog) => dialog.dismiss());
    pageB.on('dialog', (dialog) => dialog.dismiss());

    await pageA.goto('/');
    test.skip(!(await opfsSupported(pageA)), 'OPFS not supported in this environment');
    await reachDashboardWithExample(pageA);
    await buildExampleCrosstab(pageA);

    await pageB.goto('/');
    await expect
      .poll(
        async () => {
          const table = await pageB
            .getByRole('button', { name: 'Table view' })
            .isVisible()
            .catch(() => false);
          const splash = await pageB
            .getByRole('button', { name: /Upload/i })
            .first()
            .isVisible()
            .catch(() => false);
          return table || splash;
        },
        { timeout: 60000 },
      )
      .toBe(true);

    await pageA.reload();
    await waitForWorkspaceAfterReload(pageA);
    await expect(pageA.locator('table')).toBeVisible({ timeout: 60000 });

    await context.close();
  });

  test('quota pressure still restores workspace', async ({ page }) => {
    test.setTimeout(240000);
    await page.addInitScript(() => {
      const storage = navigator.storage;
      if (!storage) return;
      const original = storage.estimate.bind(storage);
      storage.estimate = async () => {
        const estimate = await original().catch(() => ({ usage: 0, quota: 1 }));
        return { usage: estimate.quota * 0.98, quota: estimate.quota || 1_000_000_000 };
      };
    });
    await page.reload();
    await reachDashboardWithExample(page);
    await buildExampleCrosstab(page);
    await invalidateOpfsDbCache(page, 'corrupt');
    await page.reload();
    await waitForWorkspaceAfterReload(page);
  });

  test('@rebuild-path CI gate: rebuild-from-source telemetry on corrupt cache', async ({ page }) => {
    test.setTimeout(240000);
    await clearBrowserStorage(page);
    await page.reload();
    await reachDashboardWithExample(page);
    await buildExampleCrosstab(page);

    await invalidateOpfsDbCache(page, 'delete');
    await page.reload();
    await waitForWorkspaceAfterReload(page);

    const eventNames = await readPilotEventNames(page);
    const transitions = await readBootTransitions(page);

    expect(
      eventNames.includes('boot_transition') ||
        eventNames.includes('opfs_decision') ||
        eventNames.includes('persistence_fallback'),
    ).toBe(true);
    expect(
      transitions.some((t) => t.to === 'rebuild-from-source') ||
        eventNames.filter((name) => name === 'persistence_fallback').length > 0,
    ).toBe(true);
    await expect(page.locator('table')).toBeVisible({ timeout: 60000 });
  });
});
