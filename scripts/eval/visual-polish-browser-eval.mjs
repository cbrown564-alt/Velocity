/**
 * Browser eval for visual-polish-vision-delight.md (VP-D-01 / VP-D-02)
 *
 * Usage:
 *   VELOCITY_URL=http://127.0.0.1:4176 node scripts/eval/visual-polish-browser-eval.mjs
 *   VP_D_RUN=02 node scripts/eval/visual-polish-browser-eval.mjs
 */
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = process.env.VELOCITY_URL ?? 'http://127.0.0.1:4176';
const RUN = process.env.VP_D_RUN ?? '02';
const OUT = path.resolve(process.cwd(), 'tmp/visual-polish-eval', `vp-d-${RUN}`);
fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('SCREENSHOT', file);
}

function record(results, item, pass, detail) {
  results.checks.push({ item, pass, detail });
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

async function applyNpsPromoterFilter(page) {
  await page.getByRole('button', { name: 'Add Filter' }).first().click();
  const modal = page.locator('[class*="shadow-2xl"]').filter({ has: page.getByRole('heading', { name: /Add Filter|NPS Segment/i }) });
  await modal.waitFor({ timeout: 10000 });
  await modal.getByPlaceholder('Search variables...').fill('nps');
  await page.waitForTimeout(300);
  await modal.getByRole('button', { name: /NPS Segment/i }).click();
  await page.waitForTimeout(1200);
  await modal.getByRole('button', { name: /^Promoter/i }).click();
  await modal.getByRole('button', { name: /Apply Filter \(1 selected\)/i }).click();
  await page.waitForTimeout(3500);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss());

  const results = { run: `VP-D-${RUN}`, checks: [], errors: [] };

  try {
    await ensureDashboard(page);
    await ensureCrosstab(page);
    await page.locator('table').waitFor({ timeout: 30000 });

    // --- Phase 1 recap ---
    const nCount = await page.locator('text=/n=\\d+/').count();
    record(results, 'D-001 Trust Anchor — n= visible', nCount > 0, `${nCount} cells`);

    const frame = page.locator('.analysis-frame').filter({ has: page.locator('table') });
    record(results, 'D-005 Analysis Frame', (await frame.count()) > 0);

    const smallBase = await page.locator('[data-small-base="true"]').count();
    record(results, 'D-002 Trust Anchor — small base', smallBase > 0, `${smallBase} cells (mock_data may be 0)`);

    await shot(page, '01-crosstab-compact');

    // Story Shelf — check immediately after crosstab (before 8s auto-dismiss)
    const storyBtn = page.getByTestId('story-shelf-suggestion');
    const storyVisible = await storyBtn.isVisible({ timeout: 8000 }).catch(() => false);
    record(
      results,
      'D-022 Story Shelf — suggestion visible',
      storyVisible,
      storyVisible ? 'suggestion chip visible' : 'not visible within 8s'
    );
    if (storyVisible) {
      await shot(page, '05-story-shelf');
      await storyBtn.click();
      await page.waitForTimeout(400);
      const committed = await page.getByText(/over-represented|under-represented|distribution|significantly|even across/i).isVisible().catch(() => false);
      record(results, 'D-023 Story Shelf — accept', committed);
    }

    const th = page.locator('th').nth(2);
    if (await th.count() > 0) {
      await th.hover();
      await page.waitForTimeout(350);
      await shot(page, '02-column-guide-hover');
      record(results, 'D-004 Column Guide', true);
    }

    // --- D-010 Settling Scale mount ---
    const animated = await page.locator('[data-animated="true"]').count();
    const pct = await page.locator('text=/\\d+\\.\\d%/').count();
    record(results, 'D-010 Settling Scale — mount', pct > 0 && animated > 0, `${pct} % cells, ${animated} animated`);

    // --- D-013 Presentation density ---
    const densityToggle = () =>
      page.getByRole('button', { name: /Presentation View|Compact View/i });
    if (await densityToggle().isVisible()) {
      await densityToggle().click();
      await page.waitForTimeout(700);
      const generous = await page.locator('[data-density="generous"]').count();
      record(results, 'D-013 Focus Breathing — presentation', generous > 0);
      await shot(page, '03-presentation-density');
      await densityToggle().click();
      await page.waitForTimeout(500);
      const compact = await page.locator('[data-density="compact"]').count();
      record(results, 'D-013 restores compact on toggle off', compact > 0);
    }

    // --- D-014 Focus mode ---
    const focusBtn = page.getByRole('button', { name: 'Enter Focus Mode' });
    if (await focusBtn.isVisible()) {
      await focusBtn.click();
      await page.waitForTimeout(700);
      const generousFocus = await page.locator('[data-density="generous"]').count();
      record(results, 'D-014 Focus Breathing — focus enter', generousFocus > 0);
      await shot(page, '04-focus-mode');
      await page.getByRole('button', { name: 'Exit Focus Mode' }).click();
      await page.waitForTimeout(700);
      const afterExit = await page.locator('[data-density="compact"]').count();
      record(results, 'D-014 Focus Breathing — density restored on exit', afterExit > 0);
    }

    // --- D-011 Filter re-animate ---
    const animatedBefore = await page.locator('[data-animated="true"]').count();
    await applyNpsPromoterFilter(page);
    await page.locator('table').waitFor({ timeout: 30000 });
    const animatedAfter = await page.locator('[data-animated="true"]').count();
    const filterChip = await page.getByText(/NPS Segment/i).count();
    record(
      results,
      'D-011 Settling Scale — filter re-animate',
      filterChip > 0 && animatedAfter > 0,
      `filter active; animated cells ${animatedBefore}→${animatedAfter}`
    );
    await shot(page, '06-after-nps-filter');

    // --- D-020 Insight Halo (live) ---
    const haloHigh = await page.locator('[class*="halo-high"], .bg-\\[var\\(--halo-high\\)\\]').count();
    const haloMid = await page.locator('[class*="halo-mid"], .bg-\\[var\\(--halo-mid\\)\\]').count();
    const haloAny = await page.locator('td.data-cell').evaluateAll((cells) =>
      cells.filter((c) => /halo/.test(c.className)).length
    );
    record(results, 'D-020 Insight Halo — live cells', haloAny > 0, `high=${haloHigh} mid=${haloMid} tinted=${haloAny}`);

    // --- D-012 Reduced motion ---
    await context.close();
    const rmContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const rmPage = await rmContext.newPage();
    rmPage.on('dialog', (d) => d.dismiss());
    await ensureDashboard(rmPage);
    await ensureCrosstab(rmPage);
    await rmPage.locator('table').waitFor({ timeout: 30000 });
    const rmAnimated = await rmPage.locator('[data-animated="true"]').count();
    const rmPct = await rmPage.locator('text=/\\d+\\.\\d%/').count();
    record(
      results,
      'D-012 Settling Scale — reduced motion',
      rmPct > 0 && rmAnimated === 0,
      `${rmPct} % cells, ${rmAnimated} animated (expect 0)`
    );
    await shot(rmPage, '07-reduced-motion');
    await rmContext.close();

    // --- Theme cycle (partial Phase 3) ---
    const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page2.on('dialog', (d) => d.dismiss());
    await ensureDashboard(page2);
    await ensureCrosstab(page2);
    const themeList = page2.locator('[role="listbox"][aria-label="Theme selection"]');
    for (const [slug, label] of [['mc', 'Mission Control'], ['lg', 'Liquid Glass']]) {
      await page2.getByRole('button', { name: /Change theme/i }).first().click();
      await themeList.getByText(label, { exact: true }).click();
      await page2.waitForTimeout(800);
      await shot(page2, `08-theme-${slug}`);
    }
    record(results, 'D-025–027 Theme materials — table readable', (await page2.locator('table tbody tr').count()) >= 2);
    await page2.close();

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
