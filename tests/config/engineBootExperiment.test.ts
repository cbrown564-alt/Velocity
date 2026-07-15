import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const experimentSource = readFileSync(resolve(process.cwd(), 'scripts/engine-boot-experiment.mjs'), 'utf8');

describe('engine boot experiment controls', () => {
  it('dispatches file drops on the element that owns the drop handler', () => {
    expect(experimentSource).toContain('workspace-upload-dropzone');
  });

  it('retains browser errors for failed experiment cells', () => {
    expect(experimentSource).toContain("page.on('console'");
    expect(experimentSource).toContain("page.on('pageerror'");
    expect(experimentSource).toContain("page.on('requestfailed'");
    expect(experimentSource).toContain('diagnostics,');
  });

  it('supports distinct compact artifacts for diagnostic and final matrices', () => {
    expect(experimentSource).toContain("'--artifact-name'");
    expect(experimentSource).toContain('`${artifactName}.raw.json`');
    expect(experimentSource).toContain('`${artifactName}.json`');
  });
});
