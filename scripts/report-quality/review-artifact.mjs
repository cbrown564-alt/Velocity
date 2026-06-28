#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inspectPptx } from './inspect-pptx.mjs';

const BUNDLED_BIN_DIR = '/Users/cobro/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin';

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function commandExists(commandPath) {
  return Boolean(commandPath && existsSync(commandPath));
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe', ...options });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr.trim()}`));
      }
    });
  });
}

export function summarizeInspectionForReview(inspection) {
  const blockers = [];
  const positives = [];

  if (inspection.slideCount > 0) positives.push(`${pluralize(inspection.slideCount, 'slide')} inspected`);
  if (inspection.editableTextBoxCount > 0) positives.push(`${pluralize(inspection.editableTextBoxCount, 'editable text box', 'editable text boxes')}`);
  if (inspection.tableCount > 0) positives.push(`${pluralize(inspection.tableCount, 'editable table')}`);
  if (inspection.notesSlideCount > 0) positives.push(`${pluralize(inspection.notesSlideCount, 'speaker-notes slide')}`);

  if (inspection.remainingTokens?.length) blockers.push('Unresolved placeholder tokens');
  if (inspection.emptySlides?.length) blockers.push('Empty slides detected');
  if (inspection.overflowWarnings?.length) blockers.push('Potential text overflow');
  if (inspection.fontCount > 2) blockers.push('More than two fonts detected');
  if (inspection.paletteSize > 4) blockers.push('Palette has more than four detected colors');
  if (inspection.slideCount === 0) blockers.push('No slides found');

  return {
    status: blockers.length > 0 ? 'needs_review' : 'passed',
    positives,
    blockers,
  };
}

export function buildVisualReviewMarkdown({ pptxPath, inspection, renderedSlides, renderer }) {
  const summary = summarizeInspectionForReview(inspection);
  const renderLine = renderedSlides.length > 0
    ? `Rendered slide evidence: ${pluralize(renderedSlides.length, 'image')}`
    : `Rendered slide evidence: unavailable\nStatus: needs manual render${renderer?.command ? ` with \`${renderer.command}\`` : ''}`;

  const gateLines = [
    inspection.remainingTokens?.length
      ? `Unresolved tokens: ${inspection.remainingTokens.join(', ')}`
      : 'No unresolved placeholder tokens',
    inspection.emptySlides?.length
      ? `Empty slides: ${inspection.emptySlides.join(', ')}`
      : 'No empty slides detected',
    inspection.overflowWarnings?.length
      ? `Potential overflow warnings: ${inspection.overflowWarnings.length}`
      : 'No XML-bound overflow warnings',
    `Fonts detected: ${inspection.fonts?.join(', ') || 'none'}`,
    `Colors detected: ${inspection.colors?.join(', ') || 'none'}`,
  ];

  return `# Visual Review

Deck: \`${pptxPath}\`
Inspection status: \`${inspection.status}\`
Renderer: \`${renderer?.status ?? 'unknown'}\`
${renderLine}

## Automated Gates

${gateLines.map((line) => `- ${line}`).join('\n')}

## Taste Check

Could this be mistaken for a deck a competent consultant made by hand?

- [ ] Yes
- [ ] No
- [ ] Cite three specifics:

## Reviewer Notes

- [ ] Legible at tablet width
- [ ] No overlapping or clipped text in rendered slides
- [ ] One message per slide
- [ ] Action title states a conclusion, not a topic
- [ ] Base/source/method notes are visible or inspectable

## Inspection Summary

${summary.positives.map((line) => `- ${line}`).join('\n') || '- No positive inspection signals recorded'}
${summary.blockers.length ? `\n### Review Blockers\n\n${summary.blockers.map((line) => `- ${line}`).join('\n')}` : ''}
`;
}

export function buildExemplarDiffMarkdown({ generatedPptxPath, exemplarPath, inspectionSummary }) {
  const blockers = inspectionSummary.blockers?.length
    ? inspectionSummary.blockers.map((line) => `- ${line}`).join('\n')
    : '- No automated technical blockers detected';

  return `# Exemplar Diff

Generated deck: \`${generatedPptxPath}\`
North-star exemplar: \`${exemplarPath || 'not supplied'}\`

## Automated Differences To Resolve

${blockers}

## Human Diff Checklist

- [ ] Section order matches the brand-tracker story arc
- [ ] Executive summary follows Situation-Complication-Resolution
- [ ] Each slide has one takeaway title and one visible point
- [ ] Chart type matches the data relationship
- [ ] Bases, filters, weights, and caveats are visible or inspectable
- [ ] The generated deck would save PowerPoint rebuild time against the exemplar
`;
}

async function renderSlides({ pptxPath, outputDir }) {
  const soffice = process.env.SOFFICE_BIN || path.join(BUNDLED_BIN_DIR, 'soffice');
  const pdftoppm = process.env.PDFTOPPM_BIN || '/opt/homebrew/bin/pdftoppm';

  if (!commandExists(soffice) || !commandExists(pdftoppm)) {
    return {
      renderer: { status: 'unavailable', command: commandExists(soffice) ? soffice : null },
      renderedSlides: [],
    };
  }

  const pdfDir = path.join(outputDir, 'render-work');
  const slideRenderDir = path.join(outputDir, 'slide_renders');
  const officeProfileDir = path.join(outputDir, 'lo-profile');
  await mkdir(pdfDir, { recursive: true });
  await mkdir(slideRenderDir, { recursive: true });
  await mkdir(officeProfileDir, { recursive: true });

  try {
    await runCommand(soffice, [
      `-env:UserInstallation=file://${officeProfileDir}`,
      '--headless',
      '--convert-to',
      'pdf',
      '--outdir',
      pdfDir,
      path.resolve(pptxPath),
    ]);
  } catch (error) {
    return {
      renderer: {
        status: 'unavailable',
        command: soffice,
        error: error instanceof Error ? error.message : String(error),
      },
      renderedSlides: [],
    };
  }

  const baseName = path.basename(pptxPath, path.extname(pptxPath));
  const pdfPath = path.join(pdfDir, `${baseName}.pdf`);
  if (!existsSync(pdfPath)) {
    return {
      renderer: { status: 'unavailable', command: soffice },
      renderedSlides: [],
    };
  }

  const outputPrefix = path.join(slideRenderDir, 'slide');
  try {
    await runCommand(pdftoppm, ['-png', '-r', '144', pdfPath, outputPrefix]);
  } catch (error) {
    return {
      renderer: {
        status: 'unavailable',
        command: pdftoppm,
        error: error instanceof Error ? error.message : String(error),
      },
      renderedSlides: [],
    };
  }
  const renderedSlides = (await readdir(slideRenderDir))
    .filter((file) => file.endsWith('.png'))
    .sort()
    .map((file) => path.join('slide_renders', file));

  return {
    renderer: { status: 'available', command: soffice },
    renderedSlides,
  };
}

function parseArgs(argv) {
  const args = { pptxPath: null, outDir: null, exemplarPath: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--out-dir' && argv[i + 1]) {
      args.outDir = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--exemplar' && argv[i + 1]) {
      args.exemplarPath = argv[i + 1];
      i += 1;
    } else if (!args.pptxPath) {
      args.pptxPath = argv[i];
    }
  }
  return args;
}

export async function createReviewArtifact({ pptxPath, outDir, exemplarPath = null }) {
  await mkdir(outDir, { recursive: true });
  const inspection = await inspectPptx(pptxPath);
  await writeFile(path.join(outDir, 'pptx_inspection.json'), `${JSON.stringify(inspection, null, 2)}\n`, 'utf8');

  const renderResult = await renderSlides({ pptxPath, outputDir: outDir });
  await writeFile(
    path.join(outDir, 'visual_review.md'),
    buildVisualReviewMarkdown({
      pptxPath,
      inspection,
      renderedSlides: renderResult.renderedSlides,
      renderer: renderResult.renderer,
    }),
    'utf8'
  );
  await writeFile(
    path.join(outDir, 'exemplar_diff.md'),
    buildExemplarDiffMarkdown({
      generatedPptxPath: pptxPath,
      exemplarPath,
      inspectionSummary: summarizeInspectionForReview(inspection),
    }),
    'utf8'
  );
  return { inspection, ...renderResult };
}

export async function runCli(argv = process.argv) {
  const args = parseArgs(argv);
  if (!args.pptxPath || !args.outDir) {
    throw new Error('Usage: node scripts/report-quality/review-artifact.mjs <deck.pptx> --out-dir demo/artifacts/report-quality/<run-id> [--exemplar exemplar.pptx]');
  }
  await createReviewArtifact(args);
  const inspection = JSON.parse(await readFile(path.join(path.resolve(args.outDir), 'pptx_inspection.json'), 'utf8'));
  process.stdout.write(`Report-quality artifact created at ${path.resolve(args.outDir)} (${inspection.status}).\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`[review-artifact] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
