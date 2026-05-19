/**
 * S4-EVAL-5b discovery: find cross-wave ELSA constructs with naming drift,
 * partial label overlap, or scale inversion (not exact id matches).
 */
import { loadSavMetadata } from '../../../src/core/ingestion/savIngestion';
import {
  autoMatchVariables,
  detectScaleInversion,
  jaroWinklerSimilarity,
  scoreVariablePair,
  valueLabelOverlap,
} from '../../../src/core/harmonization/matchEngine';

const WAVE4 =
  'test_data/English Longitudinal Study of Ageing/wave_4_ifs_derived_variables.sav';
const WAVE5 =
  'test_data/English Longitudinal Study of Ageing/wave_5_ifs_derived_variables.sav';

async function main() {
  const [wave4, wave5] = await Promise.all([
    loadSavMetadata(WAVE4),
    loadSavMetadata(WAVE5),
  ]);

  const src = wave4.variables;
  const tgt = wave5.variables;

  const candidates: Array<{
    source: string;
    target: string;
    nameSim: number;
    total: number;
    overlap: number;
    inverted: boolean;
    warningTypes: string[];
  }> = [];

  for (const sv of src) {
    if (!sv.valueLabels?.length) continue;
    for (const tv of tgt) {
      if (!tv.valueLabels?.length) continue;
      if (sv.id === tv.id) continue;

      const nameSim = jaroWinklerSimilarity(sv.id, tv.id);
      if (nameSim < 0.7) continue;

      const scored = scoreVariablePair(sv, tv);
      if (scored.total < 0.82) continue;

      const overlap = valueLabelOverlap(sv.valueLabels, tv.valueLabels);
      const inverted = detectScaleInversion(sv, tv);

      if (overlap < 0.95 || inverted) {
        candidates.push({
          source: sv.id,
          target: tv.id,
          nameSim,
          total: scored.total,
          overlap,
          inverted,
          warningTypes: (scored.warnings ?? []).map((w) => w.type),
        });
      }
    }
  }

  candidates.sort((a, b) => b.total - a.total);

  const mappings = autoMatchVariables(src, tgt);
  const idDrift = mappings.filter(
    (m) =>
      m.sourceVariableId !== m.targetVariableId &&
      (m.score?.total ?? 0) >= 0.88
  );

  console.log(
    JSON.stringify(
      {
        wave4Vars: src.length,
        wave5Vars: tgt.length,
        candidatePairs: candidates.length,
        topCandidates: candidates.slice(0, 20),
        autoMatchIdDrift: idDrift.slice(0, 20).map((m) => ({
          source: m.sourceVariableId,
          target: m.targetVariableId,
          total: m.score?.total,
          warnings: (m.warnings ?? []).map((w) => w.type),
        })),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
