#!/usr/bin/env node

import { chromium } from '@playwright/test';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildQualitySummary } from './demo-quality.mjs';

const DEFAULT_BASE_URL = process.env.DEMO_BASE_URL || 'http://127.0.0.1:4173';
const DEFAULT_CONTRACT = 'demo/contracts/first-analysis.json';
const DEFAULT_SETTLE_MS = 200;

function parseArgs(argv) {
  const result = {
    contractPath: DEFAULT_CONTRACT,
    baseUrl: DEFAULT_BASE_URL,
    headless: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--contract' && argv[i + 1]) {
      result.contractPath = argv[i + 1];
      i += 1;
    } else if (token === '--base-url' && argv[i + 1]) {
      result.baseUrl = argv[i + 1];
      i += 1;
    } else if (token === '--headed') {
      result.headless = false;
    }
  }

  return result;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function settle(page, settleMs) {
  if (!settleMs || settleMs <= 0) return;
  await page.waitForTimeout(settleMs);
}

async function waitForStableElement(page, selector, timeout) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      if (!el || (typeof el.checkVisibility === 'function' && !el.checkVisibility())) {
        return false;
      }

      let node = el;
      while (node) {
        const style = window.getComputedStyle(node);
        if (parseFloat(style.opacity) < 0.99) return false;
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        node = node.parentElement;
      }

      return true;
    },
    selector,
    { timeout },
  );
}

async function assertCondition(page, assertion, timeoutMs) {
  if (!assertion) return;
  const timeout = timeoutMs ?? 30000;

  if (assertion.type === 'visible') {
    await page.locator(assertion.selector).first().waitFor({ state: 'visible', timeout });
    return;
  }

  if (assertion.type === 'attached') {
    await page.locator(assertion.selector).first().waitFor({ state: 'attached', timeout });
    return;
  }

  if (assertion.type === 'stable') {
    await waitForStableElement(page, assertion.selector, timeout);
    return;
  }

  if (assertion.type === 'visibleAny') {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const selector of assertion.selectors || []) {
        const visible = await page
          .locator(selector)
          .first()
          .isVisible()
          .catch(() => false);
        if (visible) return;
      }
      await page.waitForTimeout(250);
    }
    throw new Error(`Timed out waiting for any selector: ${(assertion.selectors || []).join(', ')}`);
  }

  throw new Error(`Unsupported assertion type: ${assertion.type}`);
}

function resolveUrl(baseUrl, maybeRelative) {
  return new URL(maybeRelative, baseUrl).toString();
}

function sanitizeStepName(value) {
  return value.toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
}

async function saveDownload(download, downloadsDir, preferredName) {
  await ensureDir(downloadsDir);
  const suggested = download.suggestedFilename();
  const targetName = preferredName || suggested;
  const targetPath = path.join(downloadsDir, targetName);
  await download.saveAs(targetPath);
  const stats = await fs.stat(targetPath);
  return {
    filename: targetName,
    path: targetPath,
    byteLength: stats.size,
  };
}

async function executeStep(page, step, config) {
  const timeout = config.timeoutMs || 120000;
  let downloadMeta = null;

  switch (step.action) {
    case 'goto':
      await page.goto(resolveUrl(config.baseUrl, step.target), { waitUntil: 'domcontentloaded', timeout });
      break;
    case 'upload':
      await page.locator(step.selector).first().setInputFiles(path.resolve(process.cwd(), step.value));
      break;
    case 'click':
      await page.locator(step.selector).first().click({ timeout });
      break;
    case 'clickRole': {
      const name = step.namePattern ? new RegExp(step.namePattern, step.nameFlags || '') : step.name;
      await page.getByRole(step.role, { name }).first().click({ timeout });
      break;
    }
    case 'clickAndWaitForDownload': {
      const downloadPromise = page.waitForEvent('download', { timeout });
      await page.locator(step.selector).first().click({ timeout });
      const download = await downloadPromise;
      const suggestedFilename = download.suggestedFilename();
      if (step.expectedExtension && !suggestedFilename.endsWith(step.expectedExtension)) {
        throw new Error(`Download filename "${suggestedFilename}" does not end with "${step.expectedExtension}"`);
      }
      if (config.downloadsDir) {
        downloadMeta = await saveDownload(download, config.downloadsDir, step.downloadFilename);
      }
      break;
    }
    case 'clickRoleAndWaitForDownload': {
      const downloadPromise = page.waitForEvent('download', { timeout });
      const name = step.namePattern ? new RegExp(step.namePattern, step.nameFlags || '') : step.name;
      await page.getByRole(step.role, { name }).first().click({ timeout });
      const download = await downloadPromise;
      const suggestedFilename = download.suggestedFilename();
      if (step.expectedExtension && !suggestedFilename.endsWith(step.expectedExtension)) {
        throw new Error(`Download filename "${suggestedFilename}" does not end with "${step.expectedExtension}"`);
      }
      if (config.downloadsDir) {
        downloadMeta = await saveDownload(download, config.downloadsDir, step.downloadFilename);
      }
      break;
    }
    case 'clickIfVisible': {
      const locator = page.locator(step.selector).first();
      const visible = await locator.isVisible().catch(() => false);
      if (visible) {
        await locator.click({ timeout });
      }
      break;
    }
    case 'type':
      await page.locator(step.selector).first().fill(step.value);
      break;
    case 'waitForTimeout':
      await page.waitForTimeout(Number(step.value || 500));
      break;
    default:
      throw new Error(`Unsupported action: ${step.action}`);
  }

  await assertCondition(page, step.assert, timeout);

  return { downloadMeta };
}

export async function run() {
  const args = parseArgs(process.argv);
  const contractPath = path.resolve(process.cwd(), args.contractPath);
  const contract = await readJson(contractPath);
  const artifactsDir = path.resolve(process.cwd(), contract.artifactsDir || 'demo/artifacts/latest');
  const screenshotsDir = path.join(artifactsDir, 'screens');
  const downloadsDir = path.join(artifactsDir, 'downloads');
  const runTimestamp = new Date().toISOString();
  const defaultSettleMs = contract.settleMs ?? DEFAULT_SETTLE_MS;

  await ensureDir(screenshotsDir);
  await ensureDir(downloadsDir);

  const browser = await chromium.launch({ headless: args.headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (message) => {
    consoleMessages.push({
      type: message.type(),
      text: message.text(),
    });
  });
  page.on('pageerror', (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
    });
  });

  const runLog = {
    contract: {
      name: contract.name,
      path: path.relative(process.cwd(), contractPath),
      startUrl: contract.startUrl,
      timeoutMs: contract.timeoutMs ?? 120000,
    },
    startedAt: runTimestamp,
    baseUrl: args.baseUrl,
    completedSteps: 0,
    failedStepId: null,
    steps: [],
    downloads: [],
    status: 'passed',
  };

  try {
    await page.goto(resolveUrl(args.baseUrl, contract.startUrl || '/'), {
      waitUntil: 'domcontentloaded',
      timeout: contract.timeoutMs ?? 120000,
    });

    for (const step of contract.steps || []) {
      const stepStart = Date.now();
      const { downloadMeta } = await executeStep(page, step, {
        baseUrl: args.baseUrl,
        timeoutMs: contract.timeoutMs,
        downloadsDir,
      });

      const settleMs = step.settleMs ?? defaultSettleMs;
      await settle(page, settleMs);

      if (step.captureSelector) {
        await page.locator(step.captureSelector).first().scrollIntoViewIfNeeded();
        await settle(page, 150);
      }

      const screenshotFile = step.capture
        ? `${String(runLog.completedSteps + 1).padStart(2, '0')}-${sanitizeStepName(step.id)}.png`
        : null;

      if (screenshotFile) {
        await page.screenshot({
          path: path.join(screenshotsDir, screenshotFile),
          fullPage: true,
          animations: 'disabled',
        });
      }

      const stepLog = {
        id: step.id,
        goal: step.goal,
        action: step.action,
        durationMs: Date.now() - stepStart,
        screenshot: screenshotFile ? path.join('screens', screenshotFile) : null,
        status: 'passed',
      };

      if (downloadMeta) {
        stepLog.download = {
          filename: downloadMeta.filename,
          path: path.relative(artifactsDir, downloadMeta.path),
          byteLength: downloadMeta.byteLength,
        };
        runLog.downloads.push(stepLog.download);
      }

      runLog.steps.push(stepLog);
      runLog.completedSteps += 1;
    }
  } catch (error) {
    runLog.status = 'failed';
    runLog.failedStepId = contract.steps?.[runLog.completedSteps]?.id ?? null;
    runLog.steps.push({
      id: runLog.failedStepId,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    runLog.finishedAt = new Date().toISOString();
    runLog.quality = buildQualitySummary({
      steps: runLog.steps,
      timingTargets: contract.quality?.timingTargets ?? [],
      recoverabilityChecks: contract.quality?.recoverabilityChecks ?? [],
      consoleMessages,
      pageErrors,
    });
    await fs.writeFile(path.join(artifactsDir, 'steps.json'), JSON.stringify(runLog, null, 2), 'utf8');
    await context.close();
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(`[demo-runner] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
