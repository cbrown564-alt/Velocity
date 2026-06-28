/**
 * S4-EVAL-5b: EVAL-05 follow-on — cross-wave harmonization with naming drift
 * and partial label overlap (ageg5 → ageg7 on ELSA waves 4/5).
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.VELOCITY_EVAL_BASE_URL ?? 'http://127.0.0.1:4174/';
const OUTPUT_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve('evals/eval-05/runs/run-2026-05-19/artifacts');

const SOURCE_FILE = path.resolve('test_data/English Longitudinal Study of Ageing/wave_4_ifs_derived_variables.sav');
const TARGET_FILE = path.resolve('test_data/English Longitudinal Study of Ageing/wave_5_ifs_derived_variables.sav');

const SOURCE_CONSTRUCT = 'ageg5';
const TARGET_CONSTRUCT = 'ageg7';
const OUTPUT_TABLE = 'harm_eval05b_wave4_wave5_ageg5_ageg7';

async function clearBrowserStorage(page) {
  await page.evaluate(async () => {
    try {
      localStorage.clear();
    } catch {
      // Ignore localStorage cleanup failures.
    }

    try {
      if (navigator.storage?.getDirectory) {
        const root = await navigator.storage.getDirectory();
        for await (const [name] of root.entries()) {
          try {
            await root.removeEntry(name, { recursive: true });
          } catch {
            // Ignore OPFS cleanup failures.
          }
        }
      }
    } catch {
      // Ignore OPFS cleanup failures.
    }
  });
}

function toCsv(result) {
  const labelByValue = new Map();
  for (const wave of result.validSummary) {
    for (const category of wave.categories) {
      labelByValue.set(String(category.value), category.label);
    }
  }

  const lines = ['wave,value,label,count'];
  for (const row of result.counts) {
    lines.push(
      [row._wave, row._value ?? '', JSON.stringify(labelByValue.get(String(row._value)) ?? ''), row.count].join(','),
    );
  }
  return lines.join('\n');
}

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(BASE_URL);
    await clearBrowserStorage(page);
    await page.reload();

    await page.evaluate(async () => {
      const { useVelocityStore } = await import('/src/store/index.ts');

      const start = Date.now();
      while (true) {
        const state = useVelocityStore.getState();
        if (state.isDbReady && state.persistenceState === 'ready') break;
        if (Date.now() - start > 120000) {
          throw new Error('Timed out waiting for engine readiness');
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    const upload = page.getByTestId('dataset-upload-input');
    await upload.setInputFiles(SOURCE_FILE);

    await page.evaluate(async () => {
      const { useVelocityStore } = await import('/src/store/index.ts');

      const start = Date.now();
      while (true) {
        if (useVelocityStore.getState().workspace.datasets.length === 1) break;
        if (Date.now() - start > 120000) {
          throw new Error('Timed out waiting for first upload');
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    });

    await upload.setInputFiles(TARGET_FILE);

    const result = await page.evaluate(
      async ({ sourceConstruct, targetConstruct, outputTable }) => {
        const { useVelocityStore } = await import('/src/store/index.ts');
        const { exportSession, serializeSessionFile } = await import('/src/core/session/index.ts');
        const {
          scoreVariablePair,
          generateValueMappings,
          detectScaleInversion,
          detectDataLoss,
          valueLabelOverlap,
          jaroWinklerSimilarity,
        } = await import('/src/core/harmonization/matchEngine.ts');

        const start = Date.now();
        while (true) {
          if (useVelocityStore.getState().workspace.datasets.length === 2) break;
          if (Date.now() - start > 120000) {
            throw new Error('Timed out waiting for second upload');
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        const store = useVelocityStore.getState();
        const [wave4, wave5] = store.workspace.datasets;

        store.createProject({
          name: 'ELSA Waves 4-5 (EVAL-05b)',
          color: '#2D4A3E',
          datasetIds: [wave4.id, wave5.id],
          isLongitudinal: true,
          respondentKeyVariable: 'idauniq',
        });
        store.setDatasetWave(wave4.id, 4);
        store.setDatasetWave(wave5.id, 5);
        store.setDatasetRespondentKey(wave4.id, 'idauniq');
        store.setDatasetRespondentKey(wave5.id, 'idauniq');

        const sourceVars = wave4.variables ?? [];
        const targetVars = wave5.variables ?? [];

        store.openHarmonization(wave4.id, wave5.id);
        store.runAutoMatch(sourceVars, targetVars);

        const sourceVar = sourceVars.find((v) => v.id === sourceConstruct);
        const targetVar = targetVars.find((v) => v.id === targetConstruct);
        if (!sourceVar || !targetVar) {
          throw new Error(`Missing construct variables: ${sourceConstruct} / ${targetConstruct}`);
        }

        const matchedState = useVelocityStore.getState();
        const mappings = matchedState.harmonization.session?.mappings ?? [];
        const autoSelected = mappings.find((m) => m.sourceVariableId === sourceConstruct);
        if (!autoSelected) {
          throw new Error(`${sourceConstruct} did not receive an auto-match row`);
        }

        const fuzzyScore = scoreVariablePair(sourceVar, targetVar);
        const warnings = [];
        if (detectScaleInversion(sourceVar, targetVar)) {
          warnings.push({ kind: 'scale_inversion' });
        }
        const orphans = detectDataLoss(sourceVar, targetVar);
        if (orphans.length > 0) {
          warnings.push({ kind: 'data_loss', orphanValues: orphans });
        }
        if (sourceVar.type !== targetVar.type) {
          warnings.push({
            kind: 'type_mismatch',
            sourceType: sourceVar.type,
            targetType: targetVar.type,
          });
        }

        const valueMappings = generateValueMappings(sourceVar, targetVar);

        store.updateMapping(autoSelected.id, {
          targetVariableId: targetConstruct,
          score: fuzzyScore,
          valueMappings,
          warnings,
          status: 'manual',
        });
        store.confirmMapping(autoSelected.id);

        const overlap = await useVelocityStore
          .getState()
          .engineProxy.getRespondentOverlap(wave4.tableName, wave5.tableName, 'idauniq');

        const applyResult = await useVelocityStore.getState().applyHarmonization({
          sourceTable: wave4.tableName,
          targetTable: wave5.tableName,
          sourceVars,
          targetVars,
          outputTableName: outputTable,
        });

        const queryResp = await useVelocityStore
          .getState()
          .engineProxy.query(`SELECT _wave, _value, COUNT(*) AS count FROM "${outputTable}" GROUP BY 1,2 ORDER BY 1,2`);

        const counts = queryResp.data ?? [];
        const labelByValue = new Map(sourceVar.valueLabels.map((item) => [item.value, item.label]));

        const validSummary = [1, 2].map((wave) => {
          const waveRows = counts.filter((row) => row._wave === wave && typeof row._value === 'number');
          const validRows = waveRows.filter((row) => row._value > 0);
          const validCount = validRows.reduce((sum, row) => sum + Number(row.count), 0);
          return {
            wave,
            validCount,
            categories: validRows.map((row) => ({
              value: row._value,
              label: labelByValue.get(row._value) ?? String(row._value),
              count: Number(row.count),
              pct: validCount > 0 ? Number(((Number(row.count) / validCount) * 100).toFixed(1)) : 0,
            })),
          };
        });

        const state = useVelocityStore.getState();
        const sessionFile = exportSession({
          dataset: state.dataset,
          variableSets: state.variableSets,
          folders: state.folders,
          transformLog: state.transformLog,
          tableConfig: state.tableConfig,
          activeFilters: state.activeFilters,
          analysisSettings: state.analysisSettings,
          slides: state.slides,
          sections: state.sections,
          workspace: {
            datasets: state.workspace.datasets.map((dataset) => ({
              id: dataset.id,
              name: dataset.fileName || dataset.name,
              rowCount: dataset.rowCount,
              waveNumber: dataset.waveNumber,
            })),
            projects: state.workspace.projects,
          },
          activeDatasetId: state.activeDatasetId,
          harmonizationSession: state.harmonization.session,
          velocityVersion: 'dev',
        });

        const confirmed = (useVelocityStore.getState().harmonization.session?.mappings ?? []).find(
          (m) => m.sourceVariableId === sourceConstruct && m.confirmed,
        );

        return {
          sourceFile: wave4.name,
          targetFile: wave5.name,
          workspace: useVelocityStore.getState().workspace.datasets.map((dataset) => ({
            id: dataset.id,
            name: dataset.name,
            rowCount: dataset.rowCount,
            tableName: dataset.tableName,
            waveNumber: dataset.waveNumber ?? 0,
          })),
          overlap,
          mappingCounts: {
            total: mappings.length,
            autoMatched: mappings.filter((m) => m.status === 'auto_matched').length,
            confirmed: (useVelocityStore.getState().harmonization.session?.mappings ?? []).filter((m) => m.confirmed)
              .length,
          },
          autoMatchTarget: autoSelected.targetVariableId,
          fuzzyConstruct: {
            sourceId: sourceConstruct,
            targetId: targetConstruct,
            nameSimilarity: jaroWinklerSimilarity(sourceConstruct, targetConstruct),
            valueLabelOverlap: valueLabelOverlap(sourceVar.valueLabels, targetVar.valueLabels),
            score: fuzzyScore,
            scaleInversion: detectScaleInversion(sourceVar, targetVar),
          },
          selectedMapping: confirmed
            ? {
                id: confirmed.id,
                sourceVariableId: confirmed.sourceVariableId,
                targetVariableId: confirmed.targetVariableId,
                score: confirmed.score,
                warnings: confirmed.warnings,
                valueMappings: confirmed.valueMappings,
              }
            : null,
          applyResult,
          counts,
          validSummary,
          sessionJson: serializeSessionFile(sessionFile),
        };
      },
      {
        sourceConstruct: SOURCE_CONSTRUCT,
        targetConstruct: TARGET_CONSTRUCT,
        outputTable: OUTPUT_TABLE,
      },
    );

    const sessionPath = path.join(OUTPUT_DIR, 'session.velocity');
    const countsPath = path.join(OUTPUT_DIR, 'harmonized_counts.csv');
    const detailPath = path.join(OUTPUT_DIR, 'harmonized_run.json');

    await writeFile(sessionPath, result.sessionJson, 'utf8');
    await writeFile(countsPath, toCsv(result), 'utf8');
    await writeFile(detailPath, JSON.stringify({ ...result, sessionJson: undefined }, jsonReplacer, 2), 'utf8');

    console.log(
      JSON.stringify(
        {
          outputDir: OUTPUT_DIR,
          sessionPath,
          countsPath,
          detailPath,
          autoMatchTarget: result.autoMatchTarget,
          fuzzyConstruct: result.fuzzyConstruct,
          selectedMapping: result.selectedMapping,
          applyResult: result.applyResult,
          overlap: result.overlap,
          validSummary: result.validSummary,
        },
        jsonReplacer,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

await main();
