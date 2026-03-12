import { VelocityEngine } from "../../src/engine/index.js";

// Utility: format crosstab rows into a readable percentage table
function formatCrosstab(rows: Record<string, unknown>[], label: string) {
  // Group by rowKey_0 and colKey, compute column percentages
  const rowMap = new Map<string, Map<string, number>>();
  const colTotals = new Map<string, number>();
  const allCols = new Set<string>();

  for (const row of rows) {
    const rowLabel = String(row.rowKey_0 ?? "");
    const colLabel = String(row.colKey ?? "Total");
    const wCount = Number(row.weightedCount ?? row.count ?? 0);

    allCols.add(colLabel);
    if (!rowMap.has(rowLabel)) rowMap.set(rowLabel, new Map());
    rowMap.get(rowLabel)!.set(colLabel, wCount);
    colTotals.set(colLabel, (colTotals.get(colLabel) ?? 0) + wCount);
  }

  const cols = Array.from(allCols).sort();
  const rowLabels = Array.from(rowMap.keys());

  // Print header
  const colW = 10;
  const rowW = 50;
  console.log(`\n${label}`);
  console.log("-".repeat(rowW + cols.length * (colW + 1)));
  let header = "".padEnd(rowW);
  for (const col of cols) {
    header += col.substring(0, colW).padStart(colW) + " ";
  }
  console.log(header);
  console.log("-".repeat(rowW + cols.length * (colW + 1)));

  // Print each row as column percentages
  for (const rl of rowLabels) {
    let line = rl.substring(0, rowW - 2).padEnd(rowW);
    for (const col of cols) {
      const count = rowMap.get(rl)?.get(col) ?? 0;
      const total = colTotals.get(col) ?? 1;
      const pct = ((count / total) * 100).toFixed(1);
      line += `${pct}%`.padStart(colW) + " ";
    }
    console.log(line);
  }

  // Print base (N)
  let baseLine = "Base (weighted N)".padEnd(rowW);
  for (const col of cols) {
    const total = colTotals.get(col) ?? 0;
    baseLine += String(Math.round(total)).padStart(colW) + " ";
  }
  console.log(baseLine);
}

async function main() {
  const engine = await VelocityEngine.create({
    runtime: "node",
    dataDir: "./test_data/British Social Attitudes Survey",
  });
  await engine.loadFile("bsa2017_for_ukda.sav");
  await engine.annotateDataset();
  engine.setWeight("WtFactor");

  async function xtab(label: string, rowVars: string[], colVar: string) {
    try {
      const result = await engine.runAnalysis("crosstab", {
        rowVars,
        colVar,
        weightVar: "WtFactor",
        resolveLabels: true,
      });
      const data = result.data;
      formatCrosstab(data.rows, label);
      if (data.tableStats?.chiSquare) {
        const chi = data.tableStats.chiSquare;
        console.log(
          `  Chi²=${chi.statistic?.toFixed(1)}, df=${chi.df}, p=${chi.pValue < 0.001 ? "<0.001" : chi.pValue?.toFixed(3)}`
        );
      }
    } catch (err: unknown) {
      console.error(`ERROR in "${label}": ${err instanceof Error ? err.message : err}`);
    }
  }

  // ===== THEME 1: BREXIT DIVIDE =====
  console.log("\n\n########## THEME 1: THE BREXIT DIVIDE ##########\n");
  await xtab("EU Referendum Vote by Age Group", ["EUVOTWHO"], "RAgeCat");
  await xtab("EU Referendum Vote by Party Identification", ["EUVOTWHO"], "PartyId2");
  await xtab("EU Referendum Vote by Education", ["EUVOTWHO"], "HEdQual");
  await xtab("EU Referendum Vote by Social Class", ["EUVOTWHO"], "RClassGp");
  await xtab("Libertarian-Authoritarian Scale by EU Vote", ["libauth2"], "EUVOTWHO");

  // ===== THEME 2: NHS & SPENDING =====
  console.log("\n\n########## THEME 2: NHS & PUBLIC SPENDING ##########\n");
  await xtab("NHS Satisfaction by Age Group", ["NHSSat"], "RAgeCat");
  await xtab("NHS Satisfaction by Party Identification", ["NHSSat"], "PartyId2");
  await xtab("NHS Satisfaction by Income Quartile", ["NHSSat"], "HHIncQ");
  await xtab("Tax-Spend Preference by Party Identification", ["TaxSpend"], "PartyId2");
  await xtab("Spending Priority by Age Group", ["Spend1"], "RAgeCat");

  // ===== THEME 3: TRUST & INSTITUTIONS =====
  console.log("\n\n########## THEME 3: TRUST IN GOVERNMENT ##########\n");
  await xtab("Government Trust by Party Identification", ["GovTrust"], "PartyId2");
  await xtab("Government Trust by Age Group", ["GovTrust"], "RAgeCat");
  await xtab("Government Trust by EU Referendum Vote", ["GovTrust"], "EUVOTWHO");
  await xtab("Government Trust by Education", ["GovTrust"], "HEdQual");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
