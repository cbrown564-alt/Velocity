/**
 * Agent Demo: End-to-End Velocity Flow with sleep.sav
 *
 * Simulates what an MCP-connected agent would do:
 * 1. Load the dataset
 * 2. Describe it
 * 3. Run semantic auto-annotation
 * 4. Search variables by meaning
 * 5. Get analysis suggestions
 * 6. Run a crosstab with significance testing
 * 7. Build a presentation deck
 * 8. Export a session
 */

import { VelocityEngine } from '../src/engine/VelocityEngine.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../test_data');

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

function show(label: string, data: unknown) {
  console.log(`\n▸ ${label}:`);
  if (typeof data === 'string') {
    console.log(`  ${data}`);
  } else {
    const str = JSON.stringify(data, null, 2);
    const lines = str.split('\n');
    // Trim very long outputs
    const display = lines.length > 40 ? [...lines.slice(0, 40), `  ... (${lines.length - 40} more lines)`] : lines;
    console.log(display.map(l => `  ${l}`).join('\n'));
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║     VELOCITY AGENT — sleep.sav end-to-end demo   ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // ── Step 1: Create engine ─────────────────────────────────────────────────
  section('STEP 1 · Boot engine');
  const engine = await VelocityEngine.create({
    runtime: 'node',
    dataDir: DATA_DIR,
  });
  console.log('  Engine online.');

  // ── Step 2: Load dataset ──────────────────────────────────────────────────
  section('STEP 2 · Load sleep.sav');
  const loadResult = await engine.loadFile('sleep.sav');
  if (loadResult.error) throw new Error(`Load failed: ${loadResult.error.message}`);
  show('Dataset summary', loadResult.data);
  console.log(`  ✓ ${loadResult.durationMs}ms`);

  // ── Step 3: Describe dataset ──────────────────────────────────────────────
  section('STEP 3 · Describe dataset');
  const description = engine.describe();
  const vars = description.dataset!.variables;
  console.log(`  ${vars.length} variables loaded`);

  // Print first 15 with their types
  const varTable = vars.slice(0, 15).map(v =>
    `  ${v.name.padEnd(12)} ${v.type.padEnd(10)} ${v.label ?? ''}`
  );
  console.log('\n  Name         Type       Label');
  console.log('  ' + '─'.repeat(55));
  varTable.forEach(r => console.log(r));
  if (vars.length > 15) console.log(`  ... and ${vars.length - 15} more`);

  // ── Step 4: Auto-annotate semantics ───────────────────────────────────────
  section('STEP 4 · Semantic auto-annotation');
  const annotateResult = await engine.annotateDataset();
  if (annotateResult.error) throw new Error(`Annotation failed: ${annotateResult.error.message}`);
  show('Annotation result', annotateResult.data);

  // Show sample annotations
  console.log('\n  Sample annotations (first 10 variables):');
  console.log('  ' + '─'.repeat(70));
  console.log(`  ${'Name'.padEnd(12)} ${'Topic'.padEnd(16)} ${'Intent'.padEnd(20)} Confidence`);
  console.log('  ' + '─'.repeat(70));
  for (const v of vars.slice(0, 10)) {
    const ann = engine.getAnnotation(v.id);
    if (ann) {
      console.log(`  ${v.name.padEnd(12)} ${(ann.topic ?? '—').padEnd(16)} ${(ann.measurementIntent ?? '—').padEnd(20)} ${ann.confidence?.toFixed(2) ?? '—'}`);
    }
  }

  // ── Step 5: Semantic search ───────────────────────────────────────────────
  section('STEP 5 · Semantic search: "sleep quality"');
  const searchResult = await engine.searchVariables('sleep quality', { limit: 8 });
  if (searchResult.error) throw new Error(`Search failed: ${searchResult.error.message}`);
  console.log(`\n  Top matches for "sleep quality":`);
  console.log(`  ${'Name'.padEnd(12)} ${'Label'.padEnd(35)} Score`);
  console.log('  ' + '─'.repeat(60));
  for (const r of searchResult.data!) {
    console.log(`  ${r.variable.name.padEnd(12)} ${(r.variable.label ?? '').padEnd(35)} ${r.relevance.toFixed(3)}`);
  }

  // ── Step 6: Search for demographic variables ──────────────────────────────
  section('STEP 6 · Semantic search: "demographics gender age"');
  const demoSearch = await engine.searchVariables('demographics gender age', { limit: 6 });
  if (demoSearch.error) throw new Error(`Search failed: ${demoSearch.error.message}`);
  console.log('\n  Top demographic matches:');
  for (const r of demoSearch.data!) {
    console.log(`  ${r.variable.name.padEnd(12)} ${(r.variable.label ?? '').padEnd(35)} ${r.relevance.toFixed(3)}`);
  }

  // ── Step 7: Get analysis suggestions ─────────────────────────────────────
  section('STEP 7 · Analysis suggestions');
  // Find key variables by name (names are lowercased on ingest)
  const qualSleep = vars.find(v => v.name.toLowerCase() === 'qualslee' || v.name === 'qualsleep');
  const sex = vars.find(v => v.name === 'sex');
  const ess = vars.find(v => v.name === 'ess');
  const anxiety = vars.find(v => v.name === 'anxiety');

  if (qualSleep && sex && ess && anxiety) {
    const suggIds = [qualSleep.id, sex.id, ess.id, anxiety.id];
    const suggestResult = await engine.suggestAnalyses(suggIds);
    if (suggestResult.error) throw new Error(`Suggest failed: ${suggestResult.error.message}`);
    console.log(`\n  ${suggestResult.data!.length} suggestions for [qualsleep, sex, ess, anxiety]:`);
    for (const s of suggestResult.data!.slice(0, 5)) {
      console.log(`\n  [${s.priority}] ${s.analysisType}`);
      console.log(`       ${s.rationale}`);
      if (s.config && Object.keys(s.config).length > 0) {
        console.log(`       Config: ${JSON.stringify(s.config).slice(0, 80)}`);
      }
    }
  } else {
    console.log('  (Key variables not found by name, skipping suggestion step)');
  }

  // ── Step 8: Crosstab — quality of sleep by sex ────────────────────────────
  section('STEP 8 · Crosstab: qualsleep × sex (with significance)');

  if (!qualSleep || !sex) {
    console.log(`  qualsleep or sex not found (found: ${vars.map(v=>v.name).slice(0,10).join(', ')}), skipping crosstab.`);
  } else {
    const crosstabResult = await engine.runAnalysis('crosstab', {
      rowVars: [qualSleep.id],
      colVar: sex.id,
      resolveLabels: true,
      analysisSettings: {
        significanceLevel: 0.05,
        applyCorrections: false,
      },
    });

    if (crosstabResult.error) {
      console.log(`  Crosstab error: ${crosstabResult.error.message}`);
    } else {
      const rows = (crosstabResult.data as { rows: unknown[] })?.rows ?? [];
      show('Crosstab metadata', {
        durationMs: crosstabResult.durationMs,
        rowCount: rows.length,
        isWeighted: (crosstabResult.metadata as { isWeighted?: boolean })?.isWeighted,
      });

      // Print condensed table
      console.log('\n  Condensed crosstab output (first 8 rows):');
      if (rows.length > 0) {
        const first = rows[0] as Record<string, unknown>;
        const cols = Object.keys(first);
        console.log('  ' + cols.slice(0, 6).map(c => c.padEnd(14)).join(' '));
        console.log('  ' + '─'.repeat(90));
        for (const row of rows.slice(0, 8)) {
          const r = row as Record<string, unknown>;
          const line = cols.slice(0, 6).map(c => String(r[c] ?? '').slice(0, 13).padEnd(14)).join(' ');
          console.log('  ' + line);
        }
        if (rows.length > 8) console.log(`  ... (${rows.length - 8} more rows)`);
      }
    }
  }

  // ── Step 9: Crosstab — ESS by marital status ─────────────────────────────
  section('STEP 9 · Crosstab: ess × marital (sleepiness by marital status)');
  const marital = vars.find(v => v.name === 'marital');

  if (!ess || !marital) {
    console.log('  ESS or MARITAL not found, skipping.');
  } else {
    const essResult = await engine.runAnalysis('crosstab', {
      rowVars: [ess.id],
      colVar: marital.id,
      resolveLabels: true,
    });

    if (essResult.error) {
      console.log(`  Crosstab error: ${essResult.error.message}`);
    } else {
      const rows = (essResult.data as { rows: unknown[] })?.rows ?? [];
      console.log(`  ✓ ${rows.length} rows, ${essResult.durationMs}ms`);
      if (rows.length > 0) {
        console.log('\n  Sample rows (rowKey_0 resolved):');
        for (const row of rows.slice(0, 6)) {
          const r = row as Record<string, unknown>;
          console.log(`  rowKey_0: ${r.rowKey_0}  colKey: ${r.colKey}  mean: ${r.mean}  n: ${r.count ?? r.n}`);
        }
      }
    }
  }

  // ── Step 10: Raw SQL ──────────────────────────────────────────────────────
  section('STEP 10 · Raw SQL: avg sleep hours by sex');
  const sqlResult = await engine.query(`
    SELECT sex,
           ROUND(AVG(hourweeknight), 2) as avg_weeknight_hours,
           ROUND(AVG(hourswkend), 2) as avg_weekend_hours,
           COUNT(*) as n
    FROM main
    WHERE sex IS NOT NULL
    GROUP BY sex
    ORDER BY sex
  `);

  if (sqlResult.error) {
    console.log(`  SQL error: ${sqlResult.error.message}`);
  } else {
    show('Avg sleep hours by sex', sqlResult.data?.rows);
  }

  // ── Step 11: Build a deck ─────────────────────────────────────────────────
  section('STEP 11 · Build presentation deck');

  const deckSpec = {
    title: 'Sleep Health Report — Key Findings',
    description: 'Auto-generated from sleep.sav via Velocity MCP agent',
    sections: [
      {
        title: 'Sleep Quality',
        slides: [
          {
            rowVars: qualSleep ? [qualSleep.id] : [],
            colVar: sex?.id ?? null,
            title: 'Quality of Sleep by Gender',
            subtitle: 'Source: sleep.sav',
            chartType: 'horizontal-bar' as const,
          },
          ...(ess ? [{
            rowVars: [ess.id],
            colVar: marital?.id ?? null,
            title: 'Epworth Sleepiness Scale by Marital Status',
            chartType: 'grouped-bar' as const,
          }] : []),
        ],
      },
      {
        title: 'Mental Health & Wellbeing',
        slides: [
          ...(anxiety ? [{
            rowVars: [anxiety.id],
            colVar: sex?.id ?? null,
            title: 'HADS Anxiety by Gender',
            chartType: 'horizontal-bar' as const,
          }] : []),
        ],
      },
    ],
  };

  const deckResult = await engine.buildDeck(deckSpec);
  if (deckResult.error) {
    console.log(`  Deck build error: ${deckResult.error.message}`);
  } else {
    const deck = deckResult.data!;
    console.log(`\n  Deck built: "${deck.spec.title}"`);
    console.log(`  Sections: ${deck.spec.sections?.length ?? 0}`);
    console.log(`  Slides built: ${deck.slides.length}`);
    console.log(`  Build errors: ${deck.errors.length}`);
    console.log(`  Build time: ${deck.buildDurationMs}ms`);

    if (deck.errors.length > 0) {
      console.log('\n  Build errors:');
      for (const err of deck.errors) {
        console.log(`  ⚠ Slide ${err.slideIndex}: ${err.error}`);
      }
    }

    for (const slide of deck.slides) {
      const rows = slide.processed?.rows?.length ?? 0;
      console.log(`\n  ✓ "${slide.resolvedTitle}" → ${rows} rows, chart: ${slide.resolvedChartType}`);
    }
  }

  // ── Step 11b: Export deck to PPTX ────────────────────────────────────────
  section('STEP 11b · Export deck → PPTX');

  if (!deckResult.error) {
    const exportResult = await engine.exportDeck(deckResult.data!, { format: 'pptx' });
    if (exportResult.error) {
      console.log(`  Export error: ${exportResult.error.message}`);
    } else {
      const bytes = exportResult.data!;
      const outPath = path.resolve(__dirname, '../scripts/sleep-report.pptx');
      const { writeFileSync } = await import('fs');
      writeFileSync(outPath, bytes);
      console.log(`\n  ✓ PPTX written: ${outPath}`);
      console.log(`  File size: ${(bytes.byteLength / 1024).toFixed(1)} KB`);
      console.log(`  Slides: ${deckResult.data!.slides.length}`);
      console.log(`  Duration: ${exportResult.durationMs?.toFixed(0)}ms`);
    }
  }

  // ── Step 11c: Commit deck to session ─────────────────────────────────────
  section('STEP 11c · Commit deck to session');

  if (!deckResult.error) {
    engine.commitDeck(deckResult.data!);
    console.log('  ✓ Deck committed to session state.');
  }

  // ── Step 12: Export session ────────────────────────────────────────────────
  section('STEP 12 · Export session');
  const session = engine.getSession();
  console.log(`\n  Session exported:`);
  console.log(`  Format version:  ${session.formatVersion}`);
  console.log(`  Exported at:     ${session.exportedAt}`);
  console.log(`  Variables:       ${session.variables.length}`);
  console.log(`  Slides:          ${session.slides?.length ?? 0}`);
  console.log(`  Active filters:  ${session.activeFilters?.length ?? 0}`);
  console.log(`  Semantic state:  ${session.semantic ? `${Object.keys(session.semantic.annotations).length} annotations` : 'none'}`);

  // ── Step 13: Chart recommendation ─────────────────────────────────────────
  section('STEP 13 · Chart recommendation');
  if (qualSleep) {
    const recResult = await engine.recommendChart([qualSleep.id], sex?.id ?? null);
    if (!recResult.error) {
      show('Chart recommendation', recResult.data);
    }
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  section('COMPLETE');
  console.log('\n  End-to-end agent flow completed successfully.');
  console.log('  All 13 steps executed against real sleep.sav data.\n');

  await engine.close();
}

main().catch(err => {
  console.error('\n✗ Agent demo failed:', err);
  process.exit(1);
});
