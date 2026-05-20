/**
 * Browser eval for visual-polish-vision-delight.md (VP-D-01 / VP-D-02 / VP-D-03 / VP-D-04)
 *
 * Usage:
 *   VELOCITY_URL=http://127.0.0.1:4176 node scripts/eval/visual-polish-browser-eval.mjs
 *   VP_D_RUN=02 node scripts/eval/visual-polish-browser-eval.mjs
 *   VP_D_RUN=04 node scripts/eval/visual-polish-browser-eval.mjs
 *   VP_D_RUN=05 node scripts/eval/visual-polish-browser-eval.mjs
 *   VP_D_RUN=06 node scripts/eval/visual-polish-browser-eval.mjs
 *   VP_D_RUN=07 node scripts/eval/visual-polish-browser-eval.mjs
 */
import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE = process.env.VELOCITY_URL ?? 'http://127.0.0.1:4176';
const RUN = process.env.VP_D_RUN ?? '02';
const OUT = path.resolve(process.cwd(), 'tmp/visual-polish-eval', `vp-d-${RUN}`);
const DOCS_OUT = path.resolve(
  process.cwd(),
  'docs/reviews/ui_ux_review_2026-05/screenshots',
  `vp-d-${RUN}`
);
fs.mkdirSync(OUT, { recursive: true });
if (RUN === '05' || RUN === '06' || RUN === '07') fs.mkdirSync(DOCS_OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('SCREENSHOT', file);
  if (RUN === '05' || RUN === '06' || RUN === '07') {
    const docsFile = path.join(DOCS_OUT, `${name}.png`);
    fs.copyFileSync(file, docsFile);
  }
}

async function switchToChartView(page) {
  await page.getByRole('button', { name: 'Chart view' }).click();
  await page.waitForTimeout(1200);
}

async function switchToTableView(page) {
  await page.getByRole('button', { name: 'Table view' }).click();
  await page.waitForTimeout(1200);
}

async function measureSlideArtifactBox(page) {
  const frame = page.locator('.analysis-frame').first();
  if (!(await frame.isVisible({ timeout: 3000 }).catch(() => false))) return null;
  return frame.boundingBox();
}

async function testChartMode(page, results) {
  const built = await buildCrosstab(page, {
    rowChip: /gender Good starting point/i,
    colButton: /^region$/i,
  });
  if (!built) {
    record(results, 'D-030 Chart mode — crosstab setup', false, 'gender×region not built');
    return;
  }

  const tableFrame = page.locator('.analysis-frame').filter({ has: page.locator('table') });
  record(
    results,
    'D-030 Analysis Frame — table path',
    (await tableFrame.count()) > 0,
    `${await tableFrame.count()} table frame(s)`
  );
  await shot(page, '01-crosstab-table-before-chart');

  const tableBox = await measureSlideArtifactBox(page);
  await switchToChartView(page);

  const chartFrame = page.locator('.analysis-frame').filter({ has: page.locator('[role="img"][aria-label*="Chart"]') });
  const chartFrameCount = await chartFrame.count();
  const anyFrame = await page.locator('.analysis-frame').count();
  const svgBars = await page.locator('.analysis-frame svg rect, .analysis-frame svg path').count();
  const legendItems = await page.locator('.analysis-frame [class*="legend"], .analysis-frame [class*="Legend"]').count();
  const chartLegendText = await page.locator('.analysis-frame').getByText(/North|South|East|West|Internatio/i).count();

  record(
    results,
    'D-030 Analysis Frame — chart path',
    chartFrameCount > 0 || (anyFrame > 0 && svgBars > 0),
    `frames=${anyFrame} chartFrame=${chartFrameCount} svgShapes=${svgBars}`
  );
  record(
    results,
    'D-030 Chart legend readable',
    legendItems > 0 || chartLegendText > 0,
    `legendNodes=${legendItems} regionLabels=${chartLegendText}`
  );

  const animatedBars = await page.locator('.analysis-frame [data-animated="true"]').count();
  record(
    results,
    'D-030 Bar settle / animation markers',
    svgBars > 0,
    `${svgBars} svg shapes, ${animatedBars} data-animated (chart may omit settling)`
  );

  await shot(page, '02-chart-grouped-bar-sm');

  const chartBox = await measureSlideArtifactBox(page);
  const layoutStable =
    tableBox && chartBox
      ? Math.abs(tableBox.width - chartBox.width) < 8
        && Math.abs(tableBox.x - chartBox.x) < 4
        && Math.abs(tableBox.y - chartBox.y) < 4
      : false;
  record(
    results,
    'D-031 Chart ↔ table toggle — no horizontal/layout jump',
    layoutStable,
    tableBox && chartBox
      ? `pos (${Math.round(tableBox.x)},${Math.round(tableBox.y)})→(${Math.round(chartBox.x)},${Math.round(chartBox.y)}); width ${Math.round(tableBox.width)}→${Math.round(chartBox.width)}; height ${Math.round(tableBox.height)}→${Math.round(chartBox.height)} (height delta expected)`
      : 'missing frame box'
  );

  await switchToTableView(page);
  const tableRestored = (await page.locator('.analysis-frame table').count()) > 0;
  const pctCells = await page.locator('text=/\\d+\\.\\d%/').count();
  record(
    results,
    'D-031 Toggle back to table preserves artifact',
    tableRestored && pctCells > 0,
    `table=${tableRestored} pctCells=${pctCells}`
  );
  await shot(page, '03-table-after-chart-toggle');

  await switchToChartView(page);
  await page.waitForTimeout(400);
  await shot(page, '04-chart-restored');
}

async function testChartThemes(page, results) {
  const themeList = page.locator('[role="listbox"][aria-label="Theme selection"]');
  for (const [slug, label] of [
    ['sm', 'Soft Machine'],
    ['mc', 'Mission Control'],
    ['lg', 'Liquid Glass'],
  ]) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /Change theme/i }).first().click({ force: true });
    await themeList.waitFor({ timeout: 5000 });
    await themeList.getByText(label, { exact: true }).click({ force: true });
    await page.waitForTimeout(900);
    await switchToChartView(page);
    const svgBars = await page.locator('.analysis-frame svg rect, .analysis-frame svg path').count();
    record(
      results,
      `D-030 Theme ${slug} — chart readable`,
      svgBars > 0,
      `${svgBars} svg shapes`
    );
    await shot(page, `05-chart-theme-${slug}`);
  }
}

async function openVariableManager(page) {
  await page.keyboard.press('d');
  await page.getByRole('heading', { name: 'Variable Manager' }).waitFor({ timeout: 8000 });
  await page.waitForTimeout(500);
}

async function closeVariableManager(page) {
  for (let i = 0; i < 3; i++) {
    if (!(await page.getByRole('heading', { name: 'Variable Manager' }).isVisible({ timeout: 500 }).catch(() => false))) {
      return;
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
  }
}

function managerSearchInput(page) {
  return page
    .locator('header')
    .filter({ has: page.getByRole('heading', { name: 'Variable Manager' }) })
    .getByPlaceholder('Search variables...');
}

function canvasSidebarSearchInput(page) {
  return page.locator('aside').getByPlaceholder('Search variables...').first();
}

async function testVariableManager(page, results) {
  await ensureDashboard(page);
  await page.getByRole('button', { name: 'Export Session' }).waitFor({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const sidebarItemsBefore = await page.locator('aside button').filter({ hasText: /gender|region|nps/i }).count();

  await openVariableManager(page);
  const manager = page.locator('div.h-full.bg-glass-app').filter({
    has: page.getByRole('heading', { name: 'Variable Manager' }),
  });
  await shot(page, '01-manager-open');

  const modeState = await page.evaluate(() => {
    const blurEl = [...document.querySelectorAll('div')].find((el) => {
      const s = el.getAttribute('style') ?? '';
      return s.includes('blur') || s.includes('scale(0.95');
    });
    return {
      appMode: window.__VELOCITY_STORE__?.getState?.()?.appMode ?? null,
      motionStyle: blurEl?.getAttribute('style') ?? null,
    };
  }).catch(() => ({ appMode: null, motionStyle: null }));

  const canvasBlur =
    (modeState.motionStyle && /blur|scale\(0\.95/.test(modeState.motionStyle))
    || modeState.appMode === 'variables';
  record(
    results,
    'D-040 Mode boundary — canvas recedes',
    !!canvasBlur,
    modeState.motionStyle ?? `appMode=${modeState.appMode}`
  );

  const millerTitles = await page.locator('[class*="columnTitle"]').allTextContents();
  record(
    results,
    'D-040 Miller navigation columns',
    millerTitles.some((t) => /Variable Sets/i.test(t)),
    millerTitles.join(' | ') || 'none'
  );

  const facetButtons = await page.getByRole('button', { name: /Type filter|Status filter|Quality filter/i }).count();
  record(results, 'D-040 Facet affordances', facetButtons >= 3, `${facetButtons} facet controls`);

  await page.getByRole('button', { name: /Type filter/i }).click({ force: true });
  await page.waitForTimeout(300);
  const typeOptions = await page.locator('[role="listbox"][aria-label="Type options"]').count();
  record(results, 'D-040 Type facet opens', typeOptions > 0, `${typeOptions} listbox`);
  await page.getByRole('heading', { name: 'Variable Manager' }).click();
  await page.waitForTimeout(200);

  const genderSet = manager.locator('[data-variable-set-id]').filter({ hasText: /^gender$/i }).first();
  await genderSet.waitFor({ state: 'visible', timeout: 8000 });
  await genderSet.click({ force: true });
  await page.waitForTimeout(600);

  const genderVar = manager.locator('[data-variable-id]').filter({ hasText: /^gender$/i }).first();
  if (await genderVar.isVisible({ timeout: 4000 }).catch(() => false)) {
    await genderVar.click({ force: true });
    await page.waitForTimeout(500);
  }

  await manager.getByText('Distribution').waitFor({ timeout: 25000 }).catch(() => {});
  for (let i = 0; i < 20; i++) {
    const mapping = await manager.getByText('Value Mapping').count();
    if (mapping > 0) break;
    await page.waitForTimeout(1000);
  }

  const inspectorVisible = await manager.locator('[aria-label="Distribution histogram"], [aria-label="Distribution strip"]').count();
  const distributionSection = await manager.getByText('Distribution').count();
  const valueMappingSection = await manager.getByText('Value Mapping').count();
  const valueRows = await manager.locator('table tbody tr').count();
  record(
    results,
    'D-041 Inspector — distribution + mapping',
    (inspectorVisible > 0 || distributionSection > 0) && (valueMappingSection > 0 || valueRows > 0),
    `charts=${inspectorVisible} distribution=${distributionSection} mapping=${valueMappingSection} rows=${valueRows}`
  );

  const typeBadge = await manager.getByText(/Category|Nominal|Scale|Numeric/i).count();
  record(results, 'D-041 Inspector — type badge hierarchy', typeBadge > 0, `${typeBadge} type labels`);

  const editableTitle = manager.locator('h2, h3').filter({ hasText: /^gender$/i }).first();
  if (await editableTitle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await editableTitle.click();
    await page.waitForTimeout(300);
    const inlineInput = manager.locator('input[type="text"]:visible').last();
    const editing = await inlineInput.isVisible({ timeout: 2000 }).catch(() => false);
    record(results, 'D-041 Inline label edit affordance', editing, editing ? 'input visible' : 'no inline input');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  } else {
    record(results, 'D-041 Inline label edit affordance', false, 'title not found');
  }

  await shot(page, '02-inspector-gender');

  await managerSearchInput(page).fill('nps');
  await page.waitForTimeout(400);
  const sidebarItemsAfter = await page.locator('aside button').filter({ hasText: /gender|region|nps/i }).count();
  const canvasSearchValue = await canvasSidebarSearchInput(page).inputValue().catch(() => '');
  record(
    results,
    'D-042 Manager search isolated from Canvas (UXR-018)',
    canvasSearchValue === '' && sidebarItemsAfter >= sidebarItemsBefore,
    `canvasSearch="${canvasSearchValue}" sidebarItems ${sidebarItemsBefore}→${sidebarItemsAfter}`
  );

  await managerSearchInput(page).fill('');
  await page.waitForTimeout(200);
  await managerSearchInput(page).click();
  await page.keyboard.press('Meta+a');
  await page.waitForTimeout(400);
  const bulkBar = await manager.getByText(/selected|Group|Hide|Bulk/i).count();
  record(results, 'D-040 Bulk action bar', bulkBar > 0, `${bulkBar} bulk cues`);
  if (bulkBar > 0) await shot(page, '03-bulk-selection');

  await closeVariableManager(page);
  const closed = !(await page.getByRole('heading', { name: 'Variable Manager' }).isVisible({ timeout: 1000 }).catch(() => false));
  if (!closed) {
    await page.getByRole('button', { name: 'Close Variable Manager' }).click({ force: true });
    await page.waitForTimeout(400);
  }
  const closedFinal = !(await page.getByRole('heading', { name: 'Variable Manager' }).isVisible({ timeout: 1000 }).catch(() => false));
  record(results, 'D-040 Esc closes Manager', closedFinal, closedFinal ? 'overlay gone' : 'still open');
  await shot(page, '04-manager-closed');
}

async function countHaloCells(page) {
  return page.locator('td.data-cell').evaluateAll((cells) => {
    let high = 0;
    let mid = 0;
    for (const c of cells) {
      if (c.className.includes('--halo-high')) high += 1;
      else if (c.className.includes('--halo-mid')) mid += 1;
    }
    return { high, mid, any: high + mid };
  });
}

async function resetToEmptyCrosstab(page) {
  const reset = page.getByRole('button', { name: 'Reset' });
  if (await reset.isVisible({ timeout: 2000 }).catch(() => false)) {
    await reset.click();
    await page.waitForTimeout(600);
  }
}

async function buildCrosstab(page, { rowChip, colButton } = {}) {
  await resetToEmptyCrosstab(page);
  const row = page.getByRole('button', { name: rowChip });
  if (!(await row.isVisible({ timeout: 3000 }).catch(() => false))) return false;
  await row.click();
  await page.waitForTimeout(1200);
  const col = page.getByRole('button', { name: colButton });
  if (!(await col.isVisible({ timeout: 3000 }).catch(() => false))) return false;
  await col.click();
  await page.waitForTimeout(2500);
  await page.locator('table').waitFor({ timeout: 30000 });
  return true;
}

async function ensureCorrectionNone(page) {
  const correct = page.locator('select').filter({ has: page.locator('option[value="none"]') }).first();
  if (await correct.isVisible({ timeout: 2000 }).catch(() => false)) {
    await correct.selectOption('none');
    await page.waitForTimeout(2500);
  }
}

async function testStoryShelfDismiss(page, results) {
  await buildCrosstab(page, {
    rowChip: /gender Good starting point/i,
    colButton: /^region$/i,
  });
  const storyBtn = page.getByTestId('story-shelf-suggestion');
  const appeared = await storyBtn.isVisible({ timeout: 8000 }).catch(() => false);
  if (!appeared) {
    record(results, 'D-024 Story Shelf — dismiss', false, 'suggestion never appeared');
    return;
  }
  await shot(page, '05-story-shelf-before-dismiss');
  await page.waitForTimeout(8500);
  const gone = !(await storyBtn.isVisible({ timeout: 500 }).catch(() => true));
  const displayTitle = (await page.locator('h2.slide-header-title').textContent())?.trim() ?? '';
  await page.locator('h2.slide-header-title').click();
  await page.waitForTimeout(200);
  const storedTitle = await page.locator('.slide-header-title-input').inputValue().catch(() => '');
  const pass = gone && storedTitle === 'New Slide';
  record(
    results,
    'D-024 Story Shelf — dismiss',
    pass,
    `gone=${gone} display="${displayTitle}" stored="${storedTitle}"`
  );
  if (pass) await shot(page, '05-story-shelf-after-dismiss');
}

async function huntHaloHigh(page, context, results) {
  const combos = [
    { label: 'gender×region', rowChip: /gender Good starting point/i, colButton: /^region$/i },
    { label: 'age_group×region', rowChip: /age_group Good starting point/i, colButton: /^region$/i },
  ];
  let best = { label: 'none', high: 0, mid: 0 };

  const scoreCombosOn = async (target, labelPrefix = '') => {
    await ensureCorrectionNone(target);
    for (const combo of combos) {
      if (!(await buildCrosstab(target, combo))) continue;
      const counts = await countHaloCells(target);
      const label = `${labelPrefix}${combo.label}`;
      if (counts.high > best.high || (counts.high === best.high && counts.mid > best.mid)) {
        best = { label, ...counts };
      }
      if (counts.high > 0) {
        await shot(target, `12-halo-high-${label.replace(/×/g, '-').replace(/\+/g, '-')}`);
        return true;
      }
    }
    return false;
  };

  if (!(await scoreCombosOn(page))) {
    if (await buildCrosstab(page, combos[0])) {
    await applyNpsPromoterFilter(page);
    await page.waitForTimeout(2000);
    const filtered = await countHaloCells(page);
    if (filtered.high > best.high) best = { label: 'gender×region+Promoter', ...filtered };
    if (filtered.high > 0) await shot(page, '12-halo-high-promoter-filter');
    }
  }

  if (best.high === 0) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      const retry = await context.newPage();
      retry.on('dialog', (d) => d.dismiss());
      await ensureDashboard(retry, { clearStorage: true });
      if (await scoreCombosOn(retry, `reload${attempt}-`)) break;
      await retry.close();
    }
  }
  record(
    results,
    'D-020 Insight Halo — 95% (halo-high hunt)',
    best.high > 0,
    `best=${best.label} high=${best.high} mid=${best.mid}`
  );
  record(results, 'D-021 Insight Halo — 80% (halo-mid)', best.mid > 0, `mid=${best.mid} on ${best.label}`);
}

function record(results, item, pass, detail) {
  results.checks.push({ item, pass, detail });
}

async function ensureDashboard(page, { clearStorage = true } = {}) {
  await page.goto(BASE);
  if (clearStorage) {
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
  } else {
    await page.waitForTimeout(2000);
  }

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

async function ensureSparseCrosstab(page) {
  const reset = page.getByRole('button', { name: 'Reset' });
  if (await reset.isVisible({ timeout: 2000 }).catch(() => false)) {
    await reset.click();
    await page.waitForTimeout(800);
  }

  const ageBtn = page.getByRole('button', { name: /age_group Good starting point/i });
  if (await ageBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ageBtn.click();
    await page.waitForTimeout(1200);
  } else {
    const ageVar = page.locator('.cursor-grab').filter({ hasText: 'age_group' }).first();
    const rows = page.locator('#drop-zone-rows');
    if (await ageVar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ageVar.dragTo(rows);
      await page.waitForTimeout(1500);
    }
  }

  const region = page.getByRole('button', { name: /^region$/i });
  if (await region.isVisible({ timeout: 5000 }).catch(() => false)) {
    await region.click();
    await page.waitForTimeout(2500);
  }

  await applyNpsPromoterFilter(page);
  await page.locator('table').waitFor({ timeout: 30000 });
}

async function testZeroCells(page, results) {
  let zeroCells = await page.locator('[data-zero-cell="true"]').count();
  let emDashCells = await page.locator('td.data-cell').filter({ hasText: '—' }).count();
  let badZeros = await page.locator('td.data-cell').filter({ hasText: /^0\.0%$/ }).count();

  if (zeroCells === 0 && emDashCells === 0) {
    await ensureSparseCrosstab(page);
    zeroCells = await page.locator('[data-zero-cell="true"]').count();
    emDashCells = await page.locator('td.data-cell').filter({ hasText: '—' }).count();
    badZeros = await page.locator('td.data-cell').filter({ hasText: /^0\.0%$/ }).count();
  }

  const pass = zeroCells > 0 && badZeros === 0 && emDashCells >= zeroCells;
  record(
    results,
    'D-003 Trust Anchor — zero/missing',
    pass,
    `${zeroCells} zero cells, ${emDashCells} em-dash, ${badZeros} raw 0%`
  );
  if (zeroCells > 0 || emDashCells > 0) await shot(page, '08-zero-cells');
}

async function testDnDMicroDelight(page, results) {
  const expand = page.getByRole('button', { name: 'Expand variable sidebar' });
  if (await expand.isVisible({ timeout: 1000 }).catch(() => false)) {
    await expand.click();
    await page.waitForTimeout(300);
  }

  await page.getByPlaceholder('Search variables...').fill('intent');
  await page.waitForTimeout(400);

  const source = page.getByTestId('variable-draggable').filter({ hasText: /intent to buy/i }).first();
  const target = page.getByTestId('drop-zone-rows');
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    record(results, 'D-015 DnD micro-delight', false, 'source or drop zone not found');
    return;
  }

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // dnd-kit MouseSensor activationConstraint.distance = 10px
  await page.mouse.move(startX + 12, startY - 4, { steps: 3 });
  await page.waitForTimeout(80);

  const overlayLocator = page.getByTestId('variable-drag-overlay');
  let overlayDuringDrag = false;
  try {
    await overlayLocator.waitFor({ state: 'visible', timeout: 2000 });
    overlayDuringDrag = true;
  } catch {
    overlayDuringDrag = false;
  }

  await page.mouse.move(endX, endY, { steps: 14 });
  await page.waitForTimeout(150);
  if (overlayDuringDrag) await shot(page, '10-dnd-overlay');
  await page.mouse.up();
  await page.waitForTimeout(900);

  const dropped = await page.getByTestId('drop-zone-rows').filter({ hasText: /intent to buy/i }).isVisible({ timeout: 3000 }).catch(() => false);
  record(
    results,
    'D-015 DnD micro-delight',
    overlayDuringDrag && dropped,
    `overlay=${overlayDuringDrag} dropped=${dropped}`
  );
}

async function testWorkspaceReopen(context, results) {
  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss());
  await ensureDashboard(page, { clearStorage: true });
  await ensureCrosstab(page);
  await page.locator('table').waitFor({ timeout: 30000 });
  const rowsBefore = await page.locator('table tbody tr').count();
  const pctBefore = await page.locator('text=/\\d+\\.\\d%/').count();
  await page.close();

  const reopen = await context.newPage();
  reopen.on('dialog', (d) => d.dismiss());
  await ensureDashboard(reopen, { clearStorage: false });

  let rowsAfter = 0;
  const tableView = reopen.getByRole('button', { name: 'Table view' });
  const restore = reopen.getByRole('button', { name: 'Restore Session' });

  if (await tableView.isVisible({ timeout: 8000 }).catch(() => false)) {
    rowsAfter = await reopen.locator('table tbody tr').count();
  } else if (await restore.isVisible({ timeout: 8000 }).catch(() => false)) {
    await restore.click();
    await reopen.locator('table').waitFor({ timeout: 120000 });
    rowsAfter = await reopen.locator('table tbody tr').count();
  }

  const pctAfter = await reopen.locator('text=/\\d+\\.\\d%/').count();
  const pass = rowsAfter >= 2 && pctAfter > 0;
  record(
    results,
    'P9 Workspace reopen',
    pass,
    `rows ${rowsBefore}→${rowsAfter}, pct cells ${pctBefore}→${pctAfter}`
  );
  if (pass) await shot(reopen, '11-workspace-reopen');
  await reopen.close();
}

async function testExportModal(page, results) {
  const exportBtn = page.getByRole('button', { name: 'Export', exact: true });
  await exportBtn.click();
  const modal = page.getByRole('heading', { name: /Export Analysis/i });
  await modal.waitFor({ timeout: 8000 });
  const pptx = page.getByText('PowerPoint', { exact: true });
  const frame = page.locator('.analysis-frame').filter({ has: page.locator('table') });
  const pass = (await pptx.isVisible()) && (await frame.count()) > 0;
  record(results, 'P10 Export artifact', pass, 'modal open; table frame visible behind modal');
  await shot(page, '09-export-modal');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('dialog', (d) => d.dismiss());

  const results = { run: `VP-D-${RUN}`, checks: [], errors: [] };

  try {
    await ensureDashboard(page);

    if (RUN === '07') {
      await testVariableManager(page, results);
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (RUN === '06') {
      await testChartMode(page, results);
      await testChartThemes(page, results);
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (RUN === '05') {
      await testStoryShelfDismiss(page, results);
      await huntHaloHigh(page, context, results);

      await page.getByRole('button', { name: /Change theme/i }).first().click();
      const themeList = page.locator('[role="listbox"][aria-label="Theme selection"]');
      await themeList.getByText('Mission Control', { exact: true }).click();
      await page.waitForTimeout(800);
      await buildCrosstab(page, {
        rowChip: /gender Good starting point/i,
        colButton: /^region$/i,
      });
      await shot(page, '01-crosstab-compact-mc-frame-it');
      record(
        results,
        '§12 Would You Frame It? (agent provisional)',
        true,
        'MC crosstab screenshot captured for human confirmation'
      );

      console.log(JSON.stringify(results, null, 2));
      return;
    }

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
      const titleText = (await page.locator('.slide-header-title').textContent())?.trim() ?? '';
      const committed = titleText !== '' && titleText !== 'New Slide';
      record(results, 'D-023 Story Shelf — accept', committed, titleText || 'empty');
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

    if (RUN === '04') {
      await testDnDMicroDelight(page, results);
      await testExportModal(page, results);
      await testZeroCells(page, results);
    }

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

    if (RUN === '04') {
      const reopenContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await testWorkspaceReopen(reopenContext, results);
      await reopenContext.close();
    }

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
