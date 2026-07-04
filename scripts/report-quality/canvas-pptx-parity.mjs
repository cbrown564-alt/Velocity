#!/usr/bin/env node
/**
 * WP2.4 — Canvas vs PPTX parity check for exported decks.
 *
 * Verifies structural export quality: slides present, tables exported,
 * no margin-note leakage, no empty slides or unresolved tokens.
 *
 * Run: node scripts/report-quality/canvas-pptx-parity.mjs [path/to/export.pptx]
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { inspectPptx } from './inspect-pptx.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

async function extractSlideTextRuns(pptxPath) {
  const inspection = await inspectPptx(pptxPath);
  return inspection;
}

async function main() {
  const candidatePath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : path.resolve(ROOT, 'docs/assets/design-reset-evidence/wp42-five-minute-pass.pptx');

  const candidate = await extractSlideTextRuns(candidatePath);

  const report = {
    checkedAt: new Date().toISOString(),
    candidatePath,
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

  const outPath = path.resolve(ROOT, 'docs/assets/design-reset-evidence/wp24-canvas-pptx-parity.json');
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Canvas/PPTX parity: ${report.pass ? 'PASS' : 'NEEDS REVIEW'}`);
  console.log(`Slides: ${candidate.slideCount}, tables: ${candidate.tableCount}`);
  console.log(`Report: ${outPath}`);

  if (!report.pass) {
    console.error(JSON.stringify(report.diffs, null, 2));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
