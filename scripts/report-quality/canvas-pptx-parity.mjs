#!/usr/bin/env node
/**
 * WP2.4 — Canvas vs PPTX parity check for exported decks.
 *
 * Verifies structural export quality and compares candidate export against the
 * golden sleep-report fixture where applicable.
 *
 * Run:
 *   node scripts/report-quality/canvas-pptx-parity.mjs [path/to/export.pptx]
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { inspectPptx } from './inspect-pptx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DEFAULT_GOLDEN = path.resolve(ROOT, 'tests/fixtures/export/sleep-report.pptx');

async function main() {
  const candidatePath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.resolve(ROOT, 'docs/assets/design-reset-evidence/wp42-five-minute-pass.pptx');

  const goldenPath = process.env.GOLDEN_PPTX || DEFAULT_GOLDEN;

  const candidate = await inspectPptx(candidatePath);
  let golden = null;
  try {
    golden = await inspectPptx(goldenPath);
  } catch {
    console.warn(`Golden fixture missing at ${goldenPath}; inspecting candidate only.`);
  }

  const report = {
    checkedAt: new Date().toISOString(),
    goldenPath: golden ? goldenPath : null,
    candidatePath,
    golden: golden
      ? {
          slideCount: golden.slideCount,
          tableCount: golden.tableCount,
          editableTextBoxCount: golden.editableTextBoxCount,
          remainingTokens: golden.remainingTokens,
          emptySlides: golden.emptySlides,
        }
      : null,
    candidate: {
      slideCount: candidate.slideCount,
      tableCount: candidate.tableCount,
      editableTextBoxCount: candidate.editableTextBoxCount,
      emptySlides: candidate.emptySlides,
      remainingTokens: candidate.remainingTokens,
      overflowWarnings: candidate.overflowWarnings,
      warnings: candidate.warnings,
    },
    diffs: [],
    pass: true,
  };

  if (candidate.slideCount < 1) {
    report.pass = false;
    report.diffs.push({ label: 'slide-count', message: 'Export has no slides' });
  }

  if (candidate.tableCount < 1) {
    report.pass = false;
    report.diffs.push({ label: 'table-count', message: 'Export has no editable tables' });
  }

  if (candidate.emptySlides.length > 0) {
    report.pass = false;
    report.diffs.push({ label: 'empty-slides', slides: candidate.emptySlides });
  }

  if (candidate.remainingTokens.length > 0) {
    report.pass = false;
    report.diffs.push({ label: 'remaining-tokens', tokens: candidate.remainingTokens });
  }

  // WP2.4 gate: statistics margin note must not leak into PPTX body text
  const forbiddenPatterns = [/statistics status/i, /chi-square test/i, /margin note/i];
  if (candidate.warnings.some((w) => forbiddenPatterns.some((re) => re.test(w)))) {
    report.pass = false;
    report.diffs.push({ label: 'margin-note-warning', warnings: candidate.warnings });
  }

  if (golden) {
    if (candidate.slideCount < golden.slideCount) {
      report.diffs.push({
        label: 'slide-count-vs-golden',
        message: `Candidate has ${candidate.slideCount} slides; golden has ${golden.slideCount}`,
      });
    }
    if (candidate.tableCount < golden.tableCount) {
      report.diffs.push({
        label: 'table-count-vs-golden',
        message: `Candidate has ${candidate.tableCount} tables; golden has ${golden.tableCount}`,
      });
    }
  }

  const outPath = path.resolve(ROOT, 'docs/assets/design-reset-evidence/wp24-canvas-pptx-parity.json');
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Canvas/PPTX parity: ${report.pass ? 'PASS' : 'NEEDS REVIEW'}`);
  console.log(`Candidate slides: ${candidate.slideCount}, tables: ${candidate.tableCount}`);
  if (golden) console.log(`Golden slides: ${golden.slideCount}, tables: ${golden.tableCount}`);
  console.log(`Report: ${outPath}`);

  if (!report.pass || report.diffs.length > 0) {
    if (report.diffs.length > 0) console.error(JSON.stringify(report.diffs, null, 2));
    if (!report.pass) process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
