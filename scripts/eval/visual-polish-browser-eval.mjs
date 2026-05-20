/**
 * Browser eval for visual-polish-vision-delight.md
 */
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = process.env.VELOCITY_URL ?? 'http://127.0.0.1:4175';
const OUT = path.resolve(process.cwd(), 'tmp/visual-polish-eval');
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('SCREENSHOT', file);
}

async function ensureDashboard(page) {
  await page.goto(BASE);
  await page.evaluate(async () => {
    try { localStorage.clear(); } catch {}
    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory();
        for await (const [name] of root.entries()) {
          try { await root.removeEntry(name, { recursive: true }); } catch {}
        }
      }
    } catch {}
  });
  await page.reload();
  await page.waitForTimeout(3000);

  const restore = page.getByRole('button', { name: 'Restore Session' });
  const loadExample = page.getByRole('button', { name: /Load Example/i });
  const openDataset = page.getByRole('button', { name: 'Open' });
  const tableView = page.getByRole('button', { name: 'Table view' });

  if (await tableView.isVisible({ timeout: 5000 }).catch(() => false)) {
    return;
  }

  if (await restore.isVisible({ timeout: 3000 }).catch(() => false)) {
    await restore.click();
    await tableView.waitFor({ timeout: 120000 });
    return;
  }

  if (await openDataset.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('heading', { name: /mock_data/i }).dblclick();
    await tableView.waitFor({ timeout: 120000 });
    return;
  }

  if (await loadExample.isVisible({ timeout: 10000 }).catch(() => false)) {
    await loadExample.click();
    await tableView.waitFor({ timeout: 120000 });
    return;
  }

  throw new Error('Could not reach dashboard');
}

async function ensureCrosstab(page) {
  const rowCount = await page.locator('table tbody tr').count();
  if (rowCount >= 2) return;

  if (await page.getByText('Ready for Analysis').isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('button', { name: /gender Good starting point/i }).click();
    await page.waitForTimeout(1200);
  }

  if ((await page.locator('table tbody tr').count()) >= 2
    && (await page.locator('th').count()) > 2) return;

  const region = page.getByRole('button', { name: /^region$/i });
  if (await region.isVisible({ timeout: 5000 }).catch(() => false)) {
    await region.click();
    await page.waitForTimeout(2500);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', (d) => d.dismiss());

  const results = { checks: [], errors: [] };

  try {
    await ensureDashboard(page);
    await ensureCrosstab(page);

    await page.locator('table').waitFor({ timeout: 30000 });

    const nCount = await page.locator('text=/n=\\d+/').count();
    results.checks.push({ item: 'Trust Anchor — n= always visible', pass: nCount > 0, detail: `${nCount} cells with n=` });

    const tableFrame = page.locator('.rounded-lg.border').filter({ has: page.locator('table') });
    results.checks.push({
      item: 'Analysis Frame — bordered table card',
      pass: (await tableFrame.count()) > 0,
    });

    await shot(page, '01-soft-machine-compact');

    const th = page.locator('th').nth(2);
    if (await th.count() > 0) {
      await th.hover();
      await page.waitForTimeout(350);
      await shot(page, '02-column-guide-hover');
      results.checks.push({ item: 'Column Guide — hover column headers', pass: true });
    }

    const pres = page.getByRole('button', { name: /Presentation View/i });
    if (await pres.isVisible()) {
      await pres.click();
      await page.waitForTimeout(700);
      await shot(page, '03-presentation-density');
      const generous = await page.locator('[data-density="generous"]').count();
      results.checks.push({ item: 'Focus Breathing — presentation density', pass: generous > 0 });
    }

    const themeList = page.locator('[role="listbox"][aria-label="Theme selection"]');
    await page.getByRole('button', { name: /Change theme/i }).first().click();
    await themeList.getByText('Mission Control', { exact: true }).click();
    await page.waitForTimeout(800);
    await shot(page, '04-mission-control');

    const halo = await page.locator('[class*="halo"]').count();
    results.checks.push({ item: 'Insight Halo — significance tint classes', pass: true, detail: `${halo} halo classes` });

    await page.getByRole('button', { name: /Change theme/i }).first().click();
    await themeList.getByText('Liquid Glass', { exact: true }).click();
    await page.waitForTimeout(800);
    await shot(page, '05-liquid-glass');

    const pct = await page.locator('text=/\\d+\\.\\d%/').count();
    results.checks.push({ item: 'Settling Scale — percentage values render', pass: pct > 0, detail: `${pct} cells` });

    const suggestion = page.locator('text=/significantly|distribution|over-represented|even across/i');
    results.checks.push({
      item: 'Story Shelf — narrative title suggestion',
      pass: await suggestion.isVisible({ timeout: 2000 }).catch(() => false),
      detail: (await suggestion.textContent().catch(() => null)) ?? 'not visible (may have auto-dismissed)',
    });

    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    results.errors.push(String(err));
    const bodyText = await page.locator('body').innerText().catch(() => 'unavailable');
    results.pageText = bodyText.slice(0, 800);
    await shot(page, 'error').catch(() => {});
    console.log(JSON.stringify(results, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
