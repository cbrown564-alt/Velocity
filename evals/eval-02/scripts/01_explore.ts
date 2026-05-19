import { VelocityEngine } from "../../../src/engine/index.js";

async function main() {
  const engine = await VelocityEngine.create({
    runtime: "node",
    dataDir: "./test_data/British Social Attitudes Survey",
  });
  await engine.loadFile("bsa2017_for_ukda.sav");
  engine.setWeight("WtFactor");

  const varsToInspect = [
    "EUVOTWHO", "NHSSat", "PartyId2", "RAgeCat", "HEdQual",
    "libauth2", "welfare2", "GovTrust", "TaxSpend", "Rsex", "Spend1",
    "RClassGp", "HHIncQ",
  ];

  for (const id of varsToInspect) {
    const detail = await engine.describeVariable(id);
    const d = detail.data;
    const v = d.variable;
    const s = d.stats;
    console.log(`\n=== ${id}: ${v.label} ===`);
    console.log(
      `Type: ${v.type} | Valid: ${s.totalCount - s.missingCount} | Missing: ${s.missingCount} (${((s.missingCount / s.totalCount) * 100).toFixed(0)}%)`
    );
    const labelMap: Record<number, string> = {};
    (v.valueLabels || []).forEach((vl: { value: number; label: string }) => {
      labelMap[vl.value] = vl.label;
    });
    const missingSet = new Set(v.missingValues?.discrete || []);
    console.log("Frequencies (valid only):");
    s.frequencies
      .filter((f: { value: number }) => !missingSet.has(f.value))
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
      .slice(0, 10)
      .forEach((f: { value: number; count: number }) => {
        const label = labelMap[f.value] || String(f.value);
        const validN = s.totalCount - s.missingCount;
        const pct = ((f.count / validN) * 100).toFixed(1);
        console.log(
          `  ${label.substring(0, 50).padEnd(52)} ${String(f.count).padStart(5)} (${pct}%)`
        );
      });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
