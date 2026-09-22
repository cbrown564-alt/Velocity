/* global pack -- supplied by the reviewer page inside browser evaluate callbacks */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'tmp/review-browser');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(
  pathToFileURL(path.join(root, 'evals/research_quality/review/2026-09-pilot/reviewer_pack/index.html')).href,
);
await page.getByRole('button', { name: 'Review candidates', exact: true }).click();
assert.match(await page.locator('#notice').textContent(), /Record your independent/);
await page
  .getByLabel('Your important findings and unacceptable claims — before reading candidates')
  .fill('QA only: inspect primary measures, subgroup interaction and response distributions.');
await page.getByLabel('I have checked the preparation, weights, universes and limitations').check();
await page.getByRole('button', { name: 'Review candidates', exact: true }).click();
await page.getByRole('button', { name: 'Approve narrative and export', exact: true }).click();
assert.match(await page.locator('#notice').textContent(), /Decide F/);
const decisions = page.locator('select[aria-label^="Decision "]');
for (let i = 0; i < (await decisions.count()); i++) await decisions.nth(i).selectOption('accept');
await decisions.first().scrollIntoViewIfNeeded();
await page.screenshot({ path: path.join(out, 'candidate.png'), fullPage: false });
const firstFinding = page.getByLabel('Finding', { exact: true }).first();
const originalText = await firstFinding.inputValue();
await firstFinding.fill(originalText + ' [QA edit]');
await page.getByRole('button', { name: 'Approve narrative and export', exact: true }).click();
assert.match(await page.locator('#notice').textContent(), /Give a reason/);
await page.getByLabel('Reason or required correction', { exact: true }).first().fill('QA: verify revision provenance');
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Approve narrative and export', exact: true }).click();
const download = await downloadPromise;
await download.saveAs(path.join(out, 'qa-approved.json'));
const approved = JSON.parse(await fs.readFile(path.join(out, 'qa-approved.json'), 'utf8'));
assert.ok(approved.source_sha256);
assert.equal(approved.findings[0].original_proposition, originalText);
assert.equal(approved.findings[0].proposition, originalText + ' [QA edit]');
assert.ok(approved.story.beats.every((b) => b.original_headline_intent && b.original_order));
assert.ok(approved.findings.every((f) => f.evidence.length));
const updated = await page.evaluate(() => ({ ...pack.cases[0].evidence, source_sha256: 'qa-revised-source' }));
await fs.writeFile(path.join(out, 'revised.json'), JSON.stringify(updated));
await page.getByLabel('Revised analysis', { exact: true }).setInputFiles(path.join(out, 'revised.json'));
await page.locator('#notice').filter({ hasText: 'Evidence updated' }).waitFor();
assert.equal(
  await page.getByLabel('I have checked the preparation, weights, universes and limitations').isChecked(),
  false,
);
const values = await page.locator('select[aria-label^="Decision "]').evaluateAll((nodes) => nodes.map((n) => n.value));
assert.ok(values.every((v) => v === 'pending'));
const packId = await page.evaluate(() => pack.pack_id);
await fs.writeFile(
  path.join(out, 'invalid.json'),
  JSON.stringify({ pack_id: packId, version: 1, cases: null, candidates: null }),
);
await page.locator('#import').setInputFiles(path.join(out, 'invalid.json'));
await page.locator('#notice').filter({ hasText: 'No progress changed' }).waitFor();
await page.getByRole('button', { name: 'SBT-002', exact: true }).click();
assert.equal(
  await page.getByLabel('Your important findings and unacceptable claims — before reading candidates').inputValue(),
  'QA only: inspect primary measures, subgroup interaction and response distributions.',
);
await page.screenshot({ path: path.join(out, 'desktop.png'), fullPage: false });
await page.setViewportSize({ width: 390, height: 844 });
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: false });
assert.deepEqual(errors, []);
await fs.writeFile(
  path.join(out, 'verification.json'),
  JSON.stringify(
    {
      status: 'PASS',
      checks: [
        'baseline before candidates',
        'incomplete approval blocked',
        'evidence-bound export',
        'data update invalidates approval',
        'invalid import preserves progress',
        'mobile overflow',
        'no browser errors',
      ],
    },
    null,
    2,
  ),
);
await browser.close();
console.log('Review prototype verification PASS');
