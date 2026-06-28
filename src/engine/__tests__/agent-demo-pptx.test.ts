/**
 * PPTX export demo — runs inside Vitest (Vite bundler resolves pptxgenjs correctly)
 */
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { VelocityEngine } from '../VelocityEngine';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const normalizeTimestampMetadata = (xml: string): string =>
  xml.replace(
    /<dcterms:(created|modified) xsi:type="dcterms:W3CDTF">[^<]+<\/dcterms:\1>/g,
    '<dcterms:$1 xsi:type="dcterms:W3CDTF">NORMALIZED</dcterms:$1>',
  );

async function normalizedPptxEntries(bytes: Uint8Array): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(bytes);
  const entries: Record<string, string> = {};

  for (const name of Object.keys(zip.files).sort()) {
    const file = zip.file(name);
    if (!file) {
      continue;
    }

    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      const xml = await file.async('string');
      entries[name] = name === 'docProps/core.xml' ? normalizeTimestampMetadata(xml) : xml;
      continue;
    }

    const data = await file.async('uint8array');
    entries[name] = Buffer.from(data).toString('base64');
  }

  return entries;
}

describe('Agent demo: sleep.sav → PPTX', () => {
  it('builds and exports a real PPTX from sleep.sav', async () => {
    const dataDir = path.resolve(__dirname, '../../../test_data');
    const engine = await VelocityEngine.create({ runtime: 'node', dataDir });
    const fixturePath = path.resolve(__dirname, '../../../tests/fixtures/export/sleep-report.pptx');

    try {
      // Load
      const load = await engine.loadFile('sleep.sav');
      console.log(`\nLoaded: ${load.data?.rowCount} rows, ${load.data?.variableCount} vars`);

      // Find variables
      const vars = engine.describe().data.dataset!.variables;
      const qualsleep = vars.find((v) => v.name === 'qualsleep')!;
      const sex = vars.find((v) => v.name === 'sex')!;
      const ess = vars.find((v) => v.name === 'ess')!;
      const marital = vars.find((v) => v.name === 'marital')!;
      const anxiety = vars.find((v) => v.name === 'anxiety')!;

      // Annotate
      await engine.annotateDataset();

      // Build deck
      const deckResult = await engine.buildDeck({
        title: 'Sleep Health Report — Key Findings',
        sections: [
          {
            title: 'Sleep Quality',
            slides: [
              {
                rowVars: [qualsleep.id],
                colVar: sex.id,
                title: 'Quality of Sleep by Gender',
                chartType: 'horizontal-bar',
              },
              {
                rowVars: [ess.id],
                colVar: marital.id,
                title: 'Epworth Sleepiness Scale by Marital Status',
                chartType: 'grouped-bar',
              },
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
      expect(deckResult.data?.errors).toEqual([]);
      expect(deckResult.data?.slides.map((s) => s.resolvedTitle)).toEqual([
        'Quality of Sleep by Gender',
        'Epworth Sleepiness Scale by Marital Status',
        'HADS Anxiety by Gender',
      ]);

      // Export PPTX
      const exportResult = await engine.exportDeck(deckResult.data!, { format: 'pptx' });
      const bytes = exportResult.data!;

      if (process.env.UPDATE_EXPORT_FIXTURES === '1') {
        writeFileSync(fixturePath, bytes);
      }

      const fixtureBytes = readFileSync(fixturePath);
      expect(await normalizedPptxEntries(bytes)).toEqual(await normalizedPptxEntries(fixtureBytes));

      console.log(`\n✓ PPTX matched fixture: ${fixturePath}`);
      console.log(`  Size: ${(bytes.byteLength / 1024).toFixed(1)} KB`);
      console.log(`  Slides: ${deckResult.data?.slides.map((s) => s.resolvedTitle).join(', ')}`);
    } finally {
      await engine.close();
    }
  }, 30000);
});
