import { VelocityEngine } from "../src/engine/index.js";

async function main() {
  const engine = await VelocityEngine.create({
    runtime: "node",
    dataDir: "./test_data/British Social Attitudes Survey",
  });
  await engine.loadFile("bsa2017_for_ukda.sav");
  await engine.annotateDataset();
  engine.setWeight("WtFactor");

  async function xtab(label: string, rowVars: string[], colVar: string) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`CROSSTAB: ${label}`);
    console.log(`Row: ${rowVars.join(", ")} | Col: ${colVar}`);
    console.log("=".repeat(80));
    try {
      const result = await engine.runAnalysis("crosstab", {
        rowVars,
        colVar,
        weightVar: "WtFactor",
        resolveLabels: true,
      });
      const data = result.data;
      // Print rows
      if (data.rows) {
        console.log("\nRows:");
        data.rows.forEach((row: Record<string, unknown>) => {
          console.log(JSON.stringify(row));
        });
      }
      // Print stats
      if (data.tableStats) {
        const chi = data.tableStats.chiSquare;
        if (chi) {
          console.log(`\nChi-Square: ${chi.statistic?.toFixed(2)}, df=${chi.df}, p=${chi.pValue?.toFixed(6)}`);
        }
      }
      // Print metadata
      if (result.metadata) {
        console.log(`Weighted: ${result.metadata.isWeighted}`);
      }
    } catch (err: unknown) {
      console.error(`ERROR: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ===== THEME 1: BREXIT DIVIDE =====
  console.log("\n\n### THEME 1: THE BREXIT DIVIDE ###\n");

  // EU vote by age
  await xtab("EU Referendum Vote by Age", ["EUVOTWHO"], "RAgeCat");
  // EU vote by party
  await xtab("EU Referendum Vote by Party", ["EUVOTWHO"], "PartyId2");
  // EU vote by education
  await xtab("EU Referendum Vote by Education", ["EUVOTWHO"], "HEdQual");
  // EU vote by social class
  await xtab("EU Referendum Vote by Social Class", ["EUVOTWHO"], "RClassGp");
  // Lib-auth scale by EU vote
  await xtab("Lib-Auth Scale by EU Vote", ["libauth2"], "EUVOTWHO");

  // ===== THEME 2: NHS & SPENDING =====
  console.log("\n\n### THEME 2: NHS & PUBLIC SPENDING ###\n");

  // NHS satisfaction by age
  await xtab("NHS Satisfaction by Age", ["NHSSat"], "RAgeCat");
  // NHS satisfaction by party
  await xtab("NHS Satisfaction by Party", ["NHSSat"], "PartyId2");
  // NHS satisfaction by income
  await xtab("NHS Satisfaction by Income Quartile", ["NHSSat"], "HHIncQ");
  // Tax & spend by party
  await xtab("Tax-Spend Preference by Party", ["TaxSpend"], "PartyId2");

  // ===== THEME 3: TRUST & INSTITUTIONS =====
  console.log("\n\n### THEME 3: TRUST & INSTITUTIONS ###\n");

  // Government trust by party
  await xtab("Government Trust by Party", ["GovTrust"], "PartyId2");
  // Government trust by age
  await xtab("Government Trust by Age", ["GovTrust"], "RAgeCat");
  // Government trust by EU vote
  await xtab("Government Trust by EU Vote", ["GovTrust"], "EUVOTWHO");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
