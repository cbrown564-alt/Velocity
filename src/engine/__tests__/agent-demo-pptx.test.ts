/**
 * PPTX export demo — runs inside Vitest (Vite bundler resolves pptxgenjs correctly)
 */
import { describe, it } from 'vitest';
import { VelocityEngine } from '../VelocityEngine';
import { writeFileSync } from 'fs';
import path from 'path';

describe('Agent demo: sleep.sav → PPTX', () => {
  it('builds and exports a real PPTX from sleep.sav', async () => {
    const dataDir = path.resolve(__dirname, '../../../test_data');
    const engine = await VelocityEngine.create({ runtime: 'node', dataDir });

    // Load
    const load = await engine.loadFile('sleep.sav');
    console.log(`\nLoaded: ${load.data?.rowCount} rows, ${load.data?.variableCount} vars`);

    // Find variables
    const vars = engine.describe().dataset!.variables;
    const qualsleep = vars.find(v => v.name === 'qualsleep')!;
    const sex = vars.find(v => v.name === 'sex')!;
    const ess = vars.find(v => v.name === 'ess')!;
    const marital = vars.find(v => v.name === 'marital')!;
    const anxiety = vars.find(v => v.name === 'anxiety')!;

    // Annotate
    await engine.annotateDataset();

    // Build deck
    const deckResult = await engine.buildDeck({
      title: 'Sleep Health Report — Key Findings',
      sections: [
        {
          title: 'Sleep Quality',
          slides: [
            { rowVars: [qualsleep.id], colVar: sex.id, title: 'Quality of Sleep by Gender', chartType: 'horizontal-bar' },
            { rowVars: [ess.id], colVar: marital.id, title: 'Epworth Sleepiness Scale by Marital Status', chartType: 'grouped-bar' },
          ],
        },
        {
          title: 'Mental Health',
          slides: [
            { rowVars: [anxiety.id], colVar: sex.id, title: 'HADS Anxiety by Gender', chartType: 'horizontal-bar' },
          ],
        },
      ],
    });

    console.log(`Built deck: ${deckResult.data?.slides.length} slides, ${deckResult.data?.errors.length} errors`);

    // Export PPTX
    const exportResult = await engine.exportDeck(deckResult.data!, { format: 'pptx' });
    const bytes = exportResult.data!;

    const outPath = path.resolve(__dirname, '../../../scripts/sleep-report.pptx');
    writeFileSync(outPath, bytes);

    console.log(`\n✓ PPTX written: ${outPath}`);
    console.log(`  Size: ${(bytes.byteLength / 1024).toFixed(1)} KB`);
    console.log(`  Slides: ${deckResult.data?.slides.map(s => s.resolvedTitle).join(', ')}`);

    await engine.close();
  }, 30000);
});
