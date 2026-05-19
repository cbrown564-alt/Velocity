import { VelocityEngine } from "../../../src/engine/index.js";
import type { DeckSpec } from "../../../src/engine/types.js";
import { writeFileSync } from "fs";

async function main() {
  const engine = await VelocityEngine.create({
    runtime: "node",
    dataDir: "./test_data/British Social Attitudes Survey",
  });
  await engine.loadFile("bsa2017_for_ukda.sav");
  await engine.annotateDataset();
  engine.setWeight("WtFactor");

  const spec: DeckSpec = {
    title: "Britain After the Referendum: Attitudes, Trust, and Public Services",
    subtitle: "Source: British Social Attitudes Survey 2017 (NatCen), N = 3,988",
    sections: [
      {
        title: "The Brexit Divide: Age, Class, and Values",
        slides: [
          {
            rowVars: ["EUVOTWHO"],
            colVar: "RAgeCat",
            weightVar: "WtFactor",
            title: "Young Voters Overwhelmingly Backed Remain — Over 80% of 18-24s",
            notes:
              "Among 18-24 year olds, 81% reported voting Remain vs just 18% Leave — a 63-point gap. This narrows steadily with age: by 65+, the balance reverses to 55% Leave vs 43% Remain. The age gradient is the single strongest demographic predictor of EU referendum vote in this dataset. Note: this is a split-sample question (versions A/B only), so ~44% of respondents are coded as missing. Chi-square is highly significant (p<0.001).",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
          {
            rowVars: ["EUVOTWHO"],
            colVar: "PartyId2",
            weightVar: "WtFactor",
            title: "Party Lines Mirror the Leave-Remain Split Almost Exactly",
            notes:
              "59% of Conservative identifiers voted Leave, while 68% of Labour and 83% of Liberal Democrat identifiers voted Remain. The alignment between party identity and referendum vote is striking — it suggests the Brexit question has been absorbed into existing partisan identity, or is reshaping it. Green Party supporters were also heavily Remain (72%). Among those with no party identification, Leave leads at 67%.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
          {
            rowVars: ["EUVOTWHO"],
            colVar: "HEdQual",
            weightVar: "WtFactor",
            title: "Education Is a Sharp Dividing Line: 77% of Graduates Chose Remain",
            notes:
              "The education gradient is nearly as strong as age. Among degree holders, 77% voted Remain. Among those with no qualifications, 69% voted Leave. The pattern is consistent across all intermediate levels — A-level holders split closer to Remain (59%), while those with O-levels or CSEs lean heavily Leave (61-62%). This echoes the widely reported 'diploma divide' in the 2016 vote.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
          {
            rowVars: ["EUVOTWHO"],
            colVar: "RClassGp",
            weightVar: "WtFactor",
            title: "Managerial Professionals Backed Remain; Routine Workers Backed Leave",
            notes:
              "67% of those in managerial and professional occupations voted Remain. By contrast, 60% of semi-routine and routine workers, and 65% of lower supervisory/technical workers, voted Leave. Small employers split 59% Leave. The class gradient is real but less dramatic than age or education, suggesting that education may mediate much of the class effect.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
          {
            rowVars: ["libauth2"],
            colVar: "EUVOTWHO",
            weightVar: "WtFactor",
            title: "Leave Voters Are Strongly Authoritarian; Remain Voters Split Liberal",
            notes:
              "69% of Leave voters score as 'authoritarian' on the BSA libertarian-authoritarian scale, compared to just 29% of Remain voters. Conversely, 22% of Remain voters are 'libertarian' vs only 2% of Leave voters. This confirms that the Leave-Remain divide is not just demographic but deeply values-based, aligning with attitudes on tradition, obedience, censorship, and sentencing. The libertarian-authoritarian dimension may be a better predictor of referendum vote than left-right economic position.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
        ],
      },
      {
        title: "The NHS and Public Spending: Consensus Across Divides",
        slides: [
          {
            rowVars: ["NHSSat"],
            colVar: "RAgeCat",
            weightVar: "WtFactor",
            title: "Older Adults Are More Satisfied With the NHS Than Younger Ones",
            notes:
              "Overall, 57% are satisfied with the NHS (17% very + 39% quite). Among 65+, 26% are very satisfied — three times the rate of 18-24s (9%). Younger respondents are more likely to sit in the 'neither' category (23% for 18-24 vs 10% for 65+). This could reflect greater NHS contact and appreciation in older age groups, or lower expectations. Dissatisfaction is fairly even across ages at around 22-30%.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
          {
            rowVars: ["NHSSat"],
            colVar: "HHIncQ",
            weightVar: "WtFactor",
            title: "NHS Satisfaction Does Not Significantly Vary by Income",
            notes:
              "Unlike many social attitudes, NHS satisfaction shows no significant variation across income quartiles (Chi-square p=0.062). The lowest quartile is slightly more 'very satisfied' (21%) than the highest (13%), but the overall satisfied/dissatisfied balance is remarkably similar. This reflects the universal nature of the NHS — it serves all income groups and is evaluated similarly across them. A notable finding in a dataset where most attitudes show clear socioeconomic gradients.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
          {
            rowVars: ["TaxSpend"],
            colVar: "PartyId2",
            weightVar: "WtFactor",
            title: "Even 53% of Conservatives Want Higher Taxes for More Spending",
            notes:
              "61% of the public overall wants higher taxes and more spending on health, education, and social benefits. This figure is 80% among Green supporters and 76% among LibDems, but even among Conservatives it is a majority at 53%. Only 4% overall want tax cuts with spending reductions. This remarkable cross-party consensus on public spending priorities suggests that austerity policies face significant headwinds in public opinion.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
          {
            rowVars: ["Spend1"],
            colVar: "RAgeCat",
            weightVar: "WtFactor",
            title: "Health Is the Top Spending Priority Across All Ages; Education Fades With Age",
            notes:
              "54% name health as their top spending priority, with education a distant second at 24%. However, among 18-24s, education comes close to health (39% vs 46%). By 60-64, health dominates at 74% with education at just 12%. Defence barely registers among the young but reaches 7% among 65+. Note: this was a split-sample question (version A only), so the base is ~985 respondents.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
        ],
      },
      {
        title: "Trust in Government: Low and Unevenly Distributed",
        slides: [
          {
            rowVars: ["GovTrust"],
            colVar: "PartyId2",
            weightVar: "WtFactor",
            title: "Half of Non-Partisans 'Almost Never' Trust Government",
            notes:
              "Only 2% of the public trust government 'just about always', and just 19% 'most of the time'. The partisan gap is significant: 28% of Conservatives say 'most of the time' (likely reflecting government incumbency — Conservatives were in power in 2017), vs 17% of Labour. Most striking is the 50% 'almost never' rate among those with no party identification and 45% among supporters of other parties, suggesting political disengagement and distrust go hand in hand.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
          {
            rowVars: ["GovTrust"],
            colVar: "EUVOTWHO",
            weightVar: "WtFactor",
            title: "Leave and Remain Voters Show Similar Levels of Government Distrust",
            notes:
              "Contrary to the narrative that Brexit was primarily a protest vote against the establishment, Leave and Remain voters show surprisingly similar trust profiles. 20% of both groups trust government 'most of the time'. Leave voters are actually slightly less likely to say 'almost never' (32% vs 24% for Remain). The direction of difference may reflect satisfaction with the referendum outcome among Leave voters in 2017, or greater Conservative identification (which correlates with higher trust during Conservative rule).",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
          {
            rowVars: ["GovTrust"],
            colVar: "HEdQual",
            weightVar: "WtFactor",
            title: "Education Has Little Effect on Government Trust",
            notes:
              "While education powerfully predicts Brexit vote and social liberalism, it is a weaker predictor of government trust. Degree holders (24% 'almost never') are actually slightly more trusting than those with no qualifications (33%), but the difference is modest. The 'most of the time' category is remarkably flat across education levels at 15-21%. This suggests that distrust of government is a genuinely cross-cutting attitude, not reducible to the usual demographic suspects.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
          {
            rowVars: ["NHSSat"],
            colVar: "PartyId2",
            weightVar: "WtFactor",
            title: "NHS Satisfaction Crosses Party Lines Too — A Rare Area of Consensus",
            notes:
              "While political attitudes are deeply polarised on Brexit and values, NHS satisfaction is one area where partisan differences are modest. Conservative and Labour supporters report very similar satisfaction levels (61% vs 55% quite/very satisfied). Liberal Democrats are most satisfied (66%). The main outlier is Green supporters, who show higher dissatisfaction (43% quite/very dissatisfied) — possibly reflecting stronger expectations of public services. This cross-party satisfaction may explain why no party campaigns against the NHS.",
            visualizationType: "table",
            displayOptions: { showSignificance: true, showPercents: true },
          },
        ],
      },
    ],
  };

  console.log("Building deck...");
  const built = await engine.buildDeck(spec);
  console.log("\n=== BUILD RESULT ===");
  console.log(`Slides built: ${built.data.slides.length}`);
  console.log(`Errors: ${built.data.errors?.length ?? 0}`);
  console.log(`Duration: ${built.durationMs?.toFixed(0)}ms`);

  if (built.data.errors && built.data.errors.length > 0) {
    console.log("\nErrors:");
    built.data.errors.forEach((e: unknown) => console.log(JSON.stringify(e)));
  }

  // Check each slide
  built.data.slides.forEach((s: Record<string, unknown>, i: number) => {
    const result = s.result as Record<string, unknown> | undefined;
    const meta = result?.metadata as Record<string, unknown> | undefined;
    console.log(
      `  Slide ${i + 1}: weighted=${meta?.isWeighted ?? "?"}, warnings=${JSON.stringify((result as Record<string, unknown>)?.warnings ?? [])}`
    );
  });

  // Export to PPTX
  console.log("\nExporting to PPTX...");
  const exported = await engine.exportDeck(built.data, { format: "pptx" });
  const bytes = exported.data;
  writeFileSync("output/bsa2017_analysis.pptx", bytes);
  console.log(`\nPPTX written to output/bsa2017_analysis.pptx (${bytes.length} bytes)`);

  // Export session
  console.log("\nExporting session...");
  const session = await engine.exportSession();
  writeFileSync("output/bsa2017_session.velocity", JSON.stringify(session.data, null, 2));
  console.log("Session written to output/bsa2017_session.velocity");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
