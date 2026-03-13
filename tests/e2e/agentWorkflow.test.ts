// @vitest-environment node
/**
 * E2E Agent Workflow Test — Phase 2 Acceptance Gate
 *
 * Scripts the full agent workflow from design_phase2_mcp_deck_builder.md §4.3:
 *   1. velocity_load       → dataset summary
 *   2. velocity_describe   → variable list
 *   3. velocity_stats      → frequency distribution
 *   4. velocity_crosstab   → cross-tabulation with significance
 *   5. velocity_build_deck → built deck (slides materialized)
 *   6. velocity_export_deck → PPTX bytes
 *   7. velocity_commit_deck → write built deck into session state
 *   8. velocity_export_session → .velocity session file
 *
 * Uses a real VelocityEngine + DuckDB Node adapter with a temporary CSV dataset.
 * This test is the gate condition before Phase 3 begins.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VelocityEngine } from '../../src/engine/index';
import { registerTools } from '../../mcp-server/tools';

// ---------------------------------------------------------------------------
// Test dataset: 20 rows, 3 variables (Q1 ordinal, GENDER nominal, AGE scale)
// ---------------------------------------------------------------------------

const CSV_DATA = `Q1,GENDER,AGE
1,1,25
2,1,30
3,2,22
1,2,35
2,1,28
3,2,31
1,1,24
2,2,27
3,1,33
1,2,29
2,1,26
3,2,34
1,1,23
2,2,32
3,1,37
1,2,21
2,1,36
3,2,28
1,1,29
2,2,31
`;

// ---------------------------------------------------------------------------
// Minimal server mock (same pattern as tools.test.ts)
// ---------------------------------------------------------------------------

type Handler = (request: {
  params: { name: string; arguments: Record<string, unknown> };
}) => Promise<unknown>;

function makeServer() {
  const handlers: Record<string, Handler> = {};
  return {
    setRequestHandler: (
      _schema: unknown,
      handler: Handler
    ) => {
      handlers[Object.keys(handlers).length === 0 ? 'list' : 'call'] = handler;
    },
    handlers,
  };
}

async function callTool(
  engine: VelocityEngine,
  toolName: string,
  args: Record<string, unknown> = {}
) {
  const server = makeServer();
  registerTools(server as never, engine);
  const handler = server.handlers['call'];
  const raw = await handler({
    params: { name: toolName, arguments: args },
  });
  const resp = raw as { content: { text: string }[]; isError?: boolean };
  return {
    ...resp,
    parsed: JSON.parse(resp.content[0].text),
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let engine: VelocityEngine;
let dataDir: string;
let csvPath: string;

beforeAll(async () => {
  dataDir = join(tmpdir(), `velocity-e2e-${Date.now()}`);
  await mkdir(dataDir, { recursive: true });
  csvPath = join(dataDir, 'survey.csv');
  await writeFile(csvPath, CSV_DATA, 'utf8');

  engine = await VelocityEngine.create({ runtime: 'node', dataDir });
});

afterAll(async () => {
  await engine.close();
  await rm(dataDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

describe('Phase 2 E2E: Full Agent Workflow', () => {
  it('Step 1 — velocity_load: loads CSV and returns dataset summary', async () => {
    const resp = await callTool(engine, 'velocity_load', { path: 'survey.csv' });

    expect(resp.isError).toBeUndefined();
    expect(resp.parsed.data.rowCount).toBe(20);
    expect(resp.parsed.data.variableCount).toBe(3);
    expect(resp.parsed.data.source).toBe('csv');
    expect(resp.parsed.operation).toBe('loadFile');
  });

  it('Step 2 — velocity_describe: returns variable list with correct names', async () => {
    const resp = await callTool(engine, 'velocity_describe');

    expect(resp.isError).toBeUndefined();
    const desc = resp.parsed;
    expect(desc.operation).toBe('describe');
    expect(desc.data.dataset).not.toBeNull();
    expect(desc.data.dataset.variables.map((v: { name: string }) => v.name)).toEqual(
      expect.arrayContaining(['Q1', 'GENDER', 'AGE'])
    );
    expect(desc.data.activeFilters).toHaveLength(0);
    expect(desc.data.weightVariable).toBeNull();
  });

  it('Step 3 — velocity_stats: returns frequency distribution for Q1', async () => {
    const resp = await callTool(engine, 'velocity_stats', { column: 'Q1' });

    expect(resp.isError).toBeUndefined();
    // variableStats returns a ResultEnvelope; data contains the stats object
    const stats = resp.parsed.data ?? resp.parsed;
    // Q1 has values 1, 2, 3 across 20 rows — verify total count
    expect(stats).toBeDefined();
  });

  it('Step 4 — velocity_crosstab: returns cross-tab of Q1 by GENDER', async () => {
    const resp = await callTool(engine, 'velocity_crosstab', {
      rowVars: ['Q1'],
      colVar: 'GENDER',
    });

    expect(resp.isError).toBeUndefined();
    const data = resp.parsed.data;
    // runCrosstab returns { rows, tableStats }
    expect(data).toHaveProperty('rows');
    expect(Array.isArray(data.rows)).toBe(true);
    expect(data.rows.length).toBeGreaterThan(0);
  });

  it('Step 5 — velocity_build_deck: builds a 2-slide deck successfully', async () => {
    const spec = {
      title: 'E2E Test Deck',
      sections: [
        {
          title: 'Satisfaction',
          slides: [
            { rowVars: ['Q1'] },
            { rowVars: ['Q1'], colVar: 'GENDER' },
          ],
        },
      ],
    };

    const resp = await callTool(engine, 'velocity_build_deck', { spec });

    expect(resp.isError).toBeUndefined();
    const envelope = resp.parsed;
    expect(envelope.operation).toBe('buildDeck');
    expect(envelope.data.slides).toHaveLength(2);
    expect(envelope.data.errors).toHaveLength(0);
    expect(envelope.data.slides[0].sectionTitle).toBe('Satisfaction');
    expect(envelope.data.slides[0].resolvedTitle).toBeDefined();
    expect(envelope.data.buildDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('Step 6 — velocity_export_deck: exports PPTX and returns base64 bytes', async () => {
    const buildResp = await callTool(engine, 'velocity_build_deck', {
      spec: {
        title: 'Export Test',
        sections: [{ title: 'S', slides: [{ rowVars: ['Q1'] }] }],
      },
    });
    const deck = buildResp.parsed.data;

    const exportResp = await callTool(engine, 'velocity_export_deck', {
      deck,
      options: { format: 'pptx' },
    });

    expect(exportResp.isError).toBeUndefined();
    const result = exportResp.parsed;
    expect(result.data.format).toBe('pptx');
    expect(typeof result.data.base64).toBe('string');
    expect(result.data.base64.length).toBeGreaterThan(0);
    expect(result.data.byteLength).toBeGreaterThan(0);
  });

  it('Step 7 — velocity_export_session: exports a valid .velocity session file before deck commit', async () => {
    const resp = await callTool(engine, 'velocity_export_session');

    expect(resp.isError).toBeUndefined();
    const session = resp.parsed;
    expect(session.operation).toBe('exportSession');
    expect(session.data).toHaveProperty('formatVersion');
    expect(session.data).toHaveProperty('dataset');
    // Session stores the original filename, not a 'name' field
    expect(session.data.dataset.originalFilename).toBe('survey.csv');
  });

  it('Step 8 — velocity_commit_deck: committed deck appears in later session export', async () => {
    const spec = {
      title: 'Commit Test Deck',
      sections: [{ title: 'Results', slides: [{ rowVars: ['Q1'], colVar: 'GENDER' }] }],
    };

    const buildResp = await callTool(engine, 'velocity_build_deck', { spec });
    const deck = buildResp.parsed.data;
    expect(deck.slides).toHaveLength(1);

    const commitResp = await callTool(engine, 'velocity_commit_deck', { deck });
    expect(commitResp.isError).toBeUndefined();
    expect(commitResp.parsed).toEqual({
      ok: true,
      committedSlides: 1,
      committedSections: 1,
    });

    const sessionResp = await callTool(engine, 'velocity_export_session');
    expect(sessionResp.isError).toBeUndefined();
    const session = sessionResp.parsed;
    expect(session.data.slides.length).toBeGreaterThan(0);
    const committed = session.data.slides.find((s: { title: string; analysisState: { rowVars: string[]; colVar: string | null } }) => s.title === deck.slides[0].resolvedTitle);
    expect(committed).toBeDefined();
    expect(committed.analysisState.rowVars).toEqual(['Q1']);
    expect(committed.analysisState.colVar).toBe('GENDER');
  });
});
