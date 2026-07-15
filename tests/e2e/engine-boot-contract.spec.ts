import { expect, test } from '@playwright/test';
import path from 'node:path';
import { dashboardReadyLocator } from './helpers/visualPolish';

const sleepSavFixture = path.resolve(process.cwd(), 'test_data/sleep.sav');

test.describe('boot prerequisite', () => {
  test('clean context exposes real first-run controls before engine startup', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    await expect(page.getByTestId('workspace-empty-state')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: /Upload/i }).first()).toBeEnabled();
    await expect(page.getByTestId('engine-init-bar')).toBeHidden();
  });

  test('visible upload action boots the engine and reaches dataset-ready', async ({ page }) => {
    await page.goto('/');

    const chooserPromise = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /Upload/i })
      .first()
      .click();
    const chooser = await chooserPromise;
    await chooser.setFiles(sleepSavFixture);

    await expect(dashboardReadyLocator(page)).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(/sleep\.sav/i).first()).toBeVisible({ timeout: 30_000 });

    const trace = await page.evaluate(() => window.__velocityGetBootTrace?.());
    const phases = trace?.events.map((event) => event.phase) ?? [];
    expect(phases).toEqual(
      expect.arrayContaining([
        'analysis_worker.created',
        'analysis_worker.online',
        'engine.init.sent',
        'engine.init.received',
        'duckdb.bundle.select',
        'duckdb.nested_worker.created',
        'wasm.fetch',
        'duckdb.instantiate',
        'opfs.support',
        'persistence.setup',
        'duckdb.connect',
        'engine.ready.sent',
        'engine.ready.received',
        'file_load.sav',
      ]),
    );
  });

  test('failed engine boot offers retry and recovers in safe memory mode', async ({ page }) => {
    await page.addInitScript(() => {
      const NativeWorker = window.Worker;
      const testWindow = window as typeof window & { __velocityFailWorkerConstruction?: boolean };
      testWindow.__velocityFailWorkerConstruction = true;
      class ControlledFailingWorker extends NativeWorker {
        constructor(scriptURL: string | URL, options?: WorkerOptions) {
          if (testWindow.__velocityFailWorkerConstruction) {
            throw new Error('Injected analysis worker construction failure');
          }
          super(scriptURL, options);
        }
      }
      Object.defineProperty(window, 'Worker', { configurable: true, value: ControlledFailingWorker });
    });
    await page.goto('/');

    const firstChooserPromise = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /Upload/i })
      .first()
      .click();
    const firstChooser = await firstChooserPromise;
    await firstChooser.setFiles(sleepSavFixture);

    await expect(page.getByRole('button', { name: 'Retry engine' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Use safe memory mode' })).toBeVisible();
    await page.evaluate(() => {
      (window as typeof window & { __velocityFailWorkerConstruction?: boolean }).__velocityFailWorkerConstruction =
        false;
    });
    await page.getByRole('button', { name: 'Use safe memory mode' }).click();
    await expect(page.getByTestId('engine-init-bar')).toBeHidden({ timeout: 90_000 });

    await page.getByTestId('dataset-upload-input').setInputFiles([]);
    const recoveryChooserPromise = page.waitForEvent('filechooser');
    await page
      .getByRole('button', { name: /Upload/i })
      .first()
      .click();
    const recoveryChooser = await recoveryChooserPromise;
    await recoveryChooser.setFiles(sleepSavFixture);

    await expect(dashboardReadyLocator(page)).toBeVisible({ timeout: 120_000 });
    const trace = await page.evaluate(() => window.__velocityGetBootTrace?.());
    expect(trace?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: 'persistence.memory_fallback', status: 'fallback' }),
        expect.objectContaining({ phase: 'engine.ready.received', status: 'completed' }),
      ]),
    );
  });
});
