import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), '.github/workflows/test.yml'), 'utf8');

describe('Test workflow manual reruns', () => {
  it('treats workflow_dispatch as a no-change verification run', () => {
    expect(source).toContain('[[ "${{ github.event_name }}" == "workflow_dispatch" ]]');
    // Diff-scoped planner: manual Test reruns set MUTATION_BASE_SHA=HEAD so the
    // plan sees no changed files vs itself (skip unless MUTATION_FULL=1).
    expect(source).toContain('export MUTATION_BASE_SHA=HEAD');
  });
});
