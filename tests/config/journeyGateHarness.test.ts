import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'scripts/plan-06-journey-gate.mjs'), 'utf8');

describe('Journey Gate server ownership', () => {
  it('starts Vite directly instead of leaving an npm child process in CI', () => {
    expect(source).toContain("path.join(ROOT, 'node_modules/vite/bin/vite.js')");
    expect(source).not.toContain("spawn('npm', ['run', 'dev'");
  });

  it('waits for bounded server teardown before the gate exits', () => {
    expect(source).toContain('async function stopDevServer(server)');
    expect(source).toContain('await stopDevServer(server);');
    expect(source).toContain("server.kill('SIGKILL')");
  });
});
