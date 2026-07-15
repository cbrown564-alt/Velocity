import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), '.github/workflows/test.yml'), 'utf8');

describe('Test workflow manual reruns', () => {
  it('treats workflow_dispatch as a no-change verification run', () => {
    expect(source).toContain('[[ "${{ github.event_name }}" == "workflow_dispatch" ]]');
    expect(source).toContain('base="HEAD"');
  });
});
