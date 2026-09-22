/* global pack, resolve -- reviewer page globals used inside evaluate callbacks */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [packFolder, outputFolder] = process.argv.slice(2);
if (!packFolder || !outputFolder)
  throw new Error('Usage: node review_expansion.browser.mjs PACK_FOLDER QA_OUTPUT_FOLDER');
const folder = path.resolve(packFolder),
  out = path.resolve(outputFolder);
await fs.mkdir(out, { recursive: true });
const payload = JSON.parse(await fs.readFile(path.join(folder, 'review_data.json'), 'utf8'));
const key = JSON.parse(await fs.readFile(path.join(folder, '../private_key.json'), 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const verified = [];
try {
  await page.goto(pathToFileURL(path.join(folder, 'index.html')).href);
  for (const study of payload.cases) {
    await page.getByRole('button', { name: study.study_id, exact: true }).click();
    await page.getByRole('button', { name: 'Review candidates', exact: true }).click();
    assert.match(await page.locator('#notice').textContent(), /Record your independent/);
    await page
      .getByLabel('Your important findings and unacceptable claims — before reading candidates')
      .fill(
        'SOFTWARE QA ONLY: check the preparation/review/export loop. This is not an independent researcher assessment.',
      );
    await page.getByLabel('I have checked the preparation, weights, universes and limitations').check();
    await page.getByRole('button', { name: 'Review candidates', exact: true }).click();
    const chosen = study.candidates.find(
      (c) => key[c.candidate_id].input_surface === 'analysis' && key[c.candidate_id].workflow === 'one_pass',
    );
    assert.ok(chosen, 'A completed analysis one-pass candidate is required for this QA slice');
    await page.getByLabel('Candidate', { exact: true }).selectOption(chosen.candidate_id);
    for (const candidate of study.candidates) {
      await page.getByLabel('Candidate', { exact: true }).selectOption(candidate.candidate_id);
      const unresolved = await page.evaluate(() => {
        const id = document.querySelector('select[aria-label="Candidate"]').value;
        const s = pack.cases.find((c) => c.candidates.some((x) => x.candidate_id === id));
        const x = s.candidates.find((c) => c.candidate_id === id);
        return x.output.findings
          .flatMap((f) => f.evidence_refs)
          .filter((r) => resolve(r, x.output)?.unresolved_reference);
      });
      assert.deepEqual(unresolved, [], candidate.candidate_id);
    }
    await page.getByLabel('Candidate', { exact: true }).selectOption(chosen.candidate_id);
    await page.getByRole('button', { name: 'Approve narrative and export', exact: true }).click();
    assert.match(await page.locator('#notice').textContent(), /Decide /);
    const decisions = page.locator('select[aria-label^="Decision "]');
    for (let i = 0; i < (await decisions.count()); i++) await decisions.nth(i).selectOption('accept');
    const first = page.getByLabel('Finding', { exact: true }).first(),
      original = await first.inputValue();
    await first.fill(original + ' [software QA edit]');
    await page.getByRole('button', { name: 'Approve narrative and export', exact: true }).click();
    assert.match(await page.locator('#notice').textContent(), /Give a reason/);
    await page
      .getByLabel('Reason or required correction', { exact: true })
      .first()
      .fill('Software QA: verify original wording survives a revision. No human assessment.');
    await page
      .getByLabel('Overall judgement and candidate preference (ties allowed)')
      .fill('SOFTWARE QA ONLY. Acceptance here tests export mechanics and is not substantive researcher approval.');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Approve narrative and export', exact: true }).click();
    const destination = path.join(out, study.study_id + '-qa-approved.json');
    await (await download).saveAs(destination);
    const approved = JSON.parse(await fs.readFile(destination, 'utf8'));
    assert.equal(approved.findings[0].original_proposition, original);
    assert.ok(approved.findings.every((f) => f.evidence.length));
    assert.ok(approved.story.beats.every((b) => b.original_headline_intent));
    await first.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, study.study_id + '-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(out, study.study_id + '-mobile.png') });
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
        .map((e) => ({ tag: e.tagName, cls: e.className, text: e.textContent.slice(0, 100) }))
        .slice(-10),
    );
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      JSON.stringify({
        overflow,
        widths: await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth })),
      }),
    );
    await page.screenshot({ path: path.join(out, study.study_id + '-mobile.png') });
    await page.setViewportSize({ width: 1440, height: 1050 });
    const revised = { ...study.evidence, source_sha256: 'qa-updated-source' };
    const revisedPath = path.join(out, study.study_id + '-revised.json');
    await fs.writeFile(revisedPath, JSON.stringify(revised));
    await page.getByLabel('Revised analysis', { exact: true }).setInputFiles(revisedPath);
    await page.locator('#notice').filter({ hasText: 'Evidence updated' }).waitFor();
    assert.equal(
      await page.getByLabel('I have checked the preparation, weights, universes and limitations').isChecked(),
      false,
    );
    assert.ok((await decisions.evaluateAll((nodes) => nodes.map((n) => n.value))).every((v) => v === 'pending'));
    assert.equal(await first.inputValue(), original + ' [software QA edit]');
    verified.push({
      study_id: study.study_id,
      candidate_id: chosen.candidate_id,
      status: 'PASS',
      kind: 'software_QA_not_human_validation',
    });
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, 'browser-verification.json'),
    JSON.stringify(
      {
        status: 'PASS',
        studies: verified,
        checks: [
          'baseline required',
          'unreviewed findings blocked',
          'every candidate evidence reference resolves, including file JSON pointers and local JSON paths',
          'revision reason required',
          'original wording and evidence exported',
          'data update clears approvals and keeps edits',
          'mobile overflow',
          'no page errors',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ status: 'PASS', studies: verified.length, out }));
} finally {
  await browser.close();
}
