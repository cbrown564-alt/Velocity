/**
 * One-shot probe script to discover variables in SAV files.
 * Run: npx tsx scripts/probe-sav.ts
 */
import { DuckDBNodeAdapter } from '../src/adapters/DuckDBNodeAdapter';
import path from 'path';

const FILES = [
  { key: 'sleep', path: 'test_data/sleep.sav' },
  { key: 'bsa93', path: 'test_data/British Social Attitudes Survey/bsa93.sav' },
  { key: 'wvs7',  path: 'test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav' },
];

async function probeFile(key: string, filePath: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FILE: ${key} (${filePath})`);
  console.log('='.repeat(60));

  const adapter = await DuckDBNodeAdapter.create();
  try {
    const result = await adapter.loadSav(path.resolve(process.cwd(), filePath));
    console.log(`Rows: ${result.rowCount}`);
    console.log(`Variables (${result.variables.length}):`);

    for (const v of result.variables.slice(0, 40)) {
      const labels = v.valueLabels.slice(0, 4).map(l => `${l.value}="${l.label}"`).join(', ');
      const ellipsis = v.valueLabels.length > 4 ? ` +${v.valueLabels.length - 4} more` : '';
      console.log(`  ${v.name.padEnd(20)} type=${v.type.padEnd(8)} label="${v.label}" ${labels ? `[${labels}${ellipsis}]` : ''}`);
    }
    if (result.variables.length > 40) {
      console.log(`  ... and ${result.variables.length - 40} more variables`);
    }

    // Check for weight variable candidates
    const weightCandidates = result.variables.filter(v =>
      v.name.toLowerCase().includes('weight') ||
      v.name.toLowerCase().includes('wt') ||
      v.name.toLowerCase() === 'wgt'
    );
    if (weightCandidates.length > 0) {
      console.log(`\nWeight variable candidates: ${weightCandidates.map(v => v.name).join(', ')}`);
    }

    // Sample a few distinct value distributions for numeric vars
    const nominalVars = result.variables.filter(v => v.type === 'nominal' || v.type === 'ordinal').slice(0, 3);
    for (const v of nominalVars) {
      try {
        const dist = await adapter.query(
          `SELECT "${v.name}", COUNT(*) as n FROM main GROUP BY "${v.name}" ORDER BY n DESC LIMIT 8`
        );
        const summary = dist.rows.map(r => `${r[v.name]}=${r.n}`).join(', ');
        console.log(`  dist[${v.name}]: ${summary}`);
      } catch {
        // skip
      }
    }
  } finally {
    await adapter.close();
  }
}

async function main() {
  for (const f of FILES) {
    try {
      await probeFile(f.key, f.path);
    } catch (e) {
      console.error(`\nFAILED ${f.key}: ${e}`);
    }
  }
}

main().catch(console.error);
