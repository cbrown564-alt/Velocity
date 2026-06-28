#!/usr/bin/env node

import JSZip from 'jszip';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const EMU_PER_INCH = 914400;

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function extractMatches(text, pattern, group = 1) {
  return [...text.matchAll(pattern)].map((match) => match[group]).filter(Boolean);
}

function slideNumberFromName(name) {
  const match = name.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}

function sortSlideNames(a, b) {
  return slideNumberFromName(a) - slideNumberFromName(b);
}

function stripTags(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTextRuns(xml) {
  return extractMatches(xml, /<a:t[^>]*>([\s\S]*?)<\/a:t>/g).map((value) =>
    value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
  );
}

function detectOverflowWarnings(xml, slideNumber) {
  const warnings = [];
  const shapeBlocks = extractMatches(xml, /<p:sp[\s\S]*?<\/p:sp>/g, 0);

  for (const [index, shapeXml] of shapeBlocks.entries()) {
    const text = extractTextRuns(shapeXml).join(' ').trim();
    if (!text) continue;

    const extMatch = shapeXml.match(/<a:ext[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/);
    if (!extMatch) continue;

    const widthInches = Number(extMatch[1]) / EMU_PER_INCH;
    const heightInches = Number(extMatch[2]) / EMU_PER_INCH;
    const roughCapacity = Math.max(12, Math.floor(widthInches * Math.max(0.15, heightInches) * 90));

    if (text.length > roughCapacity) {
      warnings.push({
        slideNumber,
        shapeIndex: index + 1,
        textLength: text.length,
        roughCapacity,
        message: 'Text may overflow its XML bounds.',
      });
    }
  }

  return warnings;
}

function isSlideEmpty(xml) {
  const text = stripTags(extractTextRuns(xml).join(' '));
  const hasTable = /<a:tbl\b/.test(xml);
  const hasChart = /c:chart\b|\/chart\d+\.xml/.test(xml);
  const hasPicture = /<p:pic\b|<a:blip\b/.test(xml);
  return !text && !hasTable && !hasChart && !hasPicture;
}

export async function inspectPptx(pptxPath) {
  const absolutePath = path.resolve(pptxPath);
  const buffer = await readFile(absolutePath);
  const zip = await JSZip.loadAsync(buffer);
  const fileNames = Object.keys(zip.files);
  const slideNames = fileNames.filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort(sortSlideNames);
  const notesNames = fileNames.filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name));
  const mediaNames = fileNames.filter((name) => /^ppt\/media\/.+/.test(name) && !zip.files[name].dir);
  const themeNames = fileNames.filter((name) => /^ppt\/theme\/theme\d+\.xml$/.test(name));

  const warnings = [];
  const remainingTokens = [];
  const emptySlides = [];
  const overflowWarnings = [];
  const fonts = [];
  const colors = [];
  const themeFonts = [];
  const themeColors = [];
  let editableTextBoxCount = 0;
  let tableCount = 0;
  let chartCount = 0;
  let pictureCount = 0;

  if (slideNames.length === 0) {
    warnings.push('No slide XML files were found.');
  }

  for (const slideName of slideNames) {
    const slideNumber = slideNumberFromName(slideName);
    const xml = await zip.file(slideName).async('string');
    editableTextBoxCount += extractMatches(xml, /<p:sp[\s\S]*?<p:txBody[\s\S]*?<\/p:sp>/g, 0).length;
    tableCount += countMatches(xml, /<a:tbl\b/g);
    chartCount += countMatches(xml, /c:chart\b|<c:chart\b|\/charts\/chart\d+\.xml/g);
    pictureCount += countMatches(xml, /<p:pic\b/g);
    remainingTokens.push(...extractMatches(xml, /(\{\{[^{}]+\}\})/g));
    fonts.push(...extractMatches(xml, /typeface="([^"]+)"/g));
    colors.push(...extractMatches(xml, /<a:srgbClr[^>]*\bval="([A-Fa-f0-9]{6})"/g).map((value) => value.toUpperCase()));
    overflowWarnings.push(...detectOverflowWarnings(xml, slideNumber));

    if (isSlideEmpty(xml)) {
      emptySlides.push(slideNumber);
    }
  }

  for (const themeName of themeNames) {
    const xml = await zip.file(themeName).async('string');
    themeFonts.push(...extractMatches(xml, /typeface="([^"]+)"/g));
    themeColors.push(
      ...extractMatches(xml, /<a:srgbClr[^>]*\bval="([A-Fa-f0-9]{6})"/g).map((value) => value.toUpperCase()),
    );
  }

  const fontList = uniqueSorted(fonts);
  const colorList = uniqueSorted(colors);
  const themeFontList = uniqueSorted(themeFonts);
  const themeColorList = uniqueSorted(themeColors);

  if (remainingTokens.length > 0) warnings.push('Unresolved placeholder tokens remain.');
  if (emptySlides.length > 0) warnings.push('Empty slides detected.');
  if (overflowWarnings.length > 0) warnings.push('Potential text overflow detected.');
  if (fontList.length > 2) warnings.push('More than two fonts detected.');
  if (colorList.length > 4) warnings.push('Palette has more than four detected colors.');

  return {
    status: warnings.length === 0 ? 'passed' : slideNames.length === 0 ? 'blocked' : 'needs_review',
    pptxPath: absolutePath,
    inspectedAt: new Date().toISOString(),
    fileSizeBytes: buffer.byteLength,
    slideCount: slideNames.length,
    notesSlideCount: notesNames.length,
    mediaCount: mediaNames.length,
    editableTextBoxCount,
    tableCount,
    chartCount,
    pictureCount,
    remainingTokens: uniqueSorted(remainingTokens),
    emptySlides,
    overflowWarnings,
    fonts: fontList,
    colors: colorList,
    themeFonts: themeFontList,
    themeColors: themeColorList,
    fontCount: fontList.length,
    paletteSize: colorList.length,
    media: mediaNames,
    warnings,
  };
}

function parseArgs(argv) {
  const args = { pptxPath: null, outPath: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--out' && argv[i + 1]) {
      args.outPath = argv[i + 1];
      i += 1;
    } else if (!args.pptxPath) {
      args.pptxPath = argv[i];
    }
  }
  return args;
}

export async function runCli(argv = process.argv) {
  const args = parseArgs(argv);
  if (!args.pptxPath) {
    throw new Error('Usage: node scripts/report-quality/inspect-pptx.mjs <deck.pptx> [--out pptx_inspection.json]');
  }

  const inspection = await inspectPptx(args.pptxPath);
  const json = `${JSON.stringify(inspection, null, 2)}\n`;
  if (args.outPath) {
    await writeFile(path.resolve(args.outPath), json, 'utf8');
  } else {
    process.stdout.write(json);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(`[inspect-pptx] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
