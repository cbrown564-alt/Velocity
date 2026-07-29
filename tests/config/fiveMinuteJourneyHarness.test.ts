import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const harnessPath = resolve(process.cwd(), 'scripts/design-reset-five-minute-pass.mjs');
const harnessSource = readFileSync(harnessPath, 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
  devDependencies?: Record<string, string>;
};

describe('five-minute journey measurement contract', () => {
  it('uses Grammar A palette shortcuts (↵ columns, ⌥↵ rows, ⇧↵ filter)', () => {
    expect(harnessSource).toContain("if (target === 'rows') {");
    expect(harnessSource).toContain("await page.keyboard.press('Alt+Enter');");
    expect(harnessSource).toContain("} else if (target === 'filter') {");
    expect(harnessSource).toContain("await page.keyboard.press('Shift+Enter');");
    expect(harnessSource).toContain("await page.keyboard.press('Enter');");
    // Default branch (columns) must remain Enter — not Alt+Enter.
    const insertVariable = harnessSource.match(
      /async function insertVariable[\s\S]*?\n}\n\nasync function waitForFirstCrosstab/,
    )?.[0];
    expect(insertVariable).toBeDefined();
    expect(insertVariable).toMatch(/} else \{\s*await page\.keyboard\.press\('Enter'\);\s*\}/);
  });

  it('asserts resulting tableConfig recipes after palette inserts (DESIGN-CONV-K1)', () => {
    expect(harnessSource).toContain('async function assertActiveRecipe(page, expected');
    expect(harnessSource).toContain('window.__velocityStore?.getState()');
    expect(harnessSource).toContain('resolveName');
    expect(harnessSource).toContain('variableSets');
    expect(harnessSource).toContain("await assertActiveRecipe(page, { rowVars: ['sex'], colVar: 'marital' })");
    expect(harnessSource).toContain("await assertActiveRecipe(page, { rowVars: ['edlevel'], colVar: 'sex' })");
    expect(harnessSource).toContain("await assertActiveRecipe(page, { rowVars: ['marital'], colVar: null })");
  });

  it('does not add fixed interaction sleeps to first-crosstab timing', () => {
    const insertVariable = harnessSource.match(
      /async function insertVariable[\s\S]*?\n}\n\nasync function waitForFirstCrosstab/,
    )?.[0];

    expect(insertVariable).toBeDefined();
    expect(insertVariable).not.toMatch(/waitForTimeout\((?:250|700)\)/);
  });

  it('waits for the newly uploaded dataset instead of a stale returning dashboard', () => {
    expect(harnessSource).toContain("state?.datasetStatus === 'ready'");
    expect(harnessSource).toContain('state.dataset?.id !== priorId');
    expect(harnessSource).toContain('async function waitForUploadBaseline(page)');
    expect(harnessSource).toContain('await waitForUploadBaseline(page);');
    expect(harnessSource).toContain('await waitForUploadedDataset(page, previousDatasetId);');
  });

  it('writes a repository-relative PPTX evidence path', () => {
    expect(harnessSource).toContain('pptxPath: path.relative(ROOT, savePath)');
  });

  it('declares the TypeScript runner used by the wave-refresh gate', () => {
    expect(packageJson.devDependencies?.tsx).toMatch(/^\^4\./);
  });
});
