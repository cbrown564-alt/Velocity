import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.VELOCITY_EVAL_BASE_URL ?? 'http://127.0.0.1:4174/';
const OUTPUT_DIR = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve('evals/eval-06/runs/run-2026-03-13/artifacts');

const DATASETS = {
  wvs: {
    key: 'wvs',
    label: 'WVS Wave 7',
    filePath: path.resolve('test_data/WVS/WVS_Cross-National_Wave_7_spss_v6_0.sav'),
    weightVar: 'W_WEIGHT',
    analyses: [
      { id: 'happiness_overall', rowVars: ['Q46'], colVar: null },
      { id: 'happiness_by_generalized_trust', rowVars: ['Q46'], colVar: 'Q57' },
    ],
    discoveryTerms: ['happiness', 'trust', 'government'],
  },
  trust: {
    key: 'trust',
    label: 'People_s Trust fallback',
    filePath: path.resolve('test_data/People_s Trust - A Survey-Based Experiment/trust.sav'),
    weightVar: null,
    analyses: [],
    discoveryTerms: ['trust', 'government', 'happiness'],
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonReplacer(_key, value) {
  return typeof value === 'bigint' ? Number(value) : value;
}

function normalizeValue(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function csvEscape(value) {
  const text = normalizeValue(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return `${lines.join('\n')}\n`;
}

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

async function waitForEngineReady(page, timeoutMs = 120000) {
  await page.evaluate(async ({ timeoutMs: timeout }) => {
    const { useVelocityStore } = await import('/src/store/index.ts');

    const start = Date.now();
    while (true) {
      const state = useVelocityStore.getState();
      if (state.isDbReady && state.persistenceState === 'ready') return;
      if (Date.now() - start > timeout) {
        throw new Error('Timed out waiting for engine readiness');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }, { timeoutMs });
}

async function resetToFreshState(page) {
  await page.goto(BASE_URL);
  await clearBrowserStorage(page);
  await page.reload();
  await waitForEngineReady(page);
}

async function attemptDataset(page, datasetConfig) {
  const upload = page.getByTestId('dataset-upload-input');
  const attempt = {
    datasetKey: datasetConfig.key,
    datasetLabel: datasetConfig.label,
    datasetPath: path.relative(process.cwd(), datasetConfig.filePath),
    startedAt: new Date().toISOString(),
    metadataStage: null,
    fullLoadStage: null,
    succeeded: false,
    failureReason: null,
  };

  await upload.setInputFiles(datasetConfig.filePath);

  const metadataStage = await page.evaluate(
    async ({ timeoutMs, discoveryTerms }) => {
      const { useVelocityStore } = await import('/src/store/index.ts');

      const start = Date.now();
      while (true) {
        const state = useVelocityStore.getState();
        const dataset = state.dataset;
        const mode = dataset
          ? dataset.metadataOnly
            ? 'metadata'
            : 'dashboard'
          : 'pending';

        if (mode !== 'pending') {
          const variables = dataset?.variables ?? [];
          const discovery = discoveryTerms.map((term) => ({
            term,
            matches: variables
              .filter((variable) => {
                const haystack = `${variable.id} ${variable.name} ${variable.label ?? ''}`.toLowerCase();
                return haystack.includes(term.toLowerCase());
              })
              .slice(0, 8)
              .map((variable) => ({
                id: variable.id,
                label: variable.label ?? variable.name,
              })),
          }));

          return {
            mode,
            rowCount: dataset?.rowCount ?? 0,
            variableCount: variables.length,
            sampleRowCount: dataset?.sampleRowCount ?? null,
            metadataOnly: dataset?.metadataOnly ?? false,
            loadDiagnostics: dataset?.loadDiagnostics ?? null,
            variableSetCount: state.variableSets.length,
            discovery,
          };
        }

        if (Date.now() - start > timeoutMs) {
          throw new Error('Timed out waiting for metadata or full-load stage');
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    },
    { timeoutMs: 180000, discoveryTerms: datasetConfig.discoveryTerms }
  );

  attempt.metadataStage = metadataStage;

  if (metadataStage.mode === 'metadata') {
    const loadFull = page.getByRole('button', { name: 'Load Full Data' });
    await loadFull.click();

    const fullLoadStage = await page.evaluate(async ({ timeoutMs }) => {
      const { useVelocityStore } = await import('/src/store/index.ts');

      const start = Date.now();
      while (true) {
        const state = useVelocityStore.getState();
        const dataset = state.dataset;

        if (dataset && !dataset.metadataOnly) {
          return {
            mode: 'dashboard',
            rowCount: dataset.rowCount,
            variableCount: dataset.variables.length,
            variableSetCount: state.variableSets.length,
            metadataOnly: dataset.metadataOnly ?? false,
          };
        }

        if (Date.now() - start > timeoutMs) {
          throw new Error('Timed out waiting for full dataset load');
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }, { timeoutMs: 300000 });

    attempt.fullLoadStage = fullLoadStage;
  } else {
    attempt.fullLoadStage = metadataStage;
  }

  attempt.succeeded = true;
  attempt.completedAt = new Date().toISOString();
  return attempt;
}

function variableInfo(dataset, variableId) {
  const variable = dataset.variables.find((item) => item.id === variableId);
  if (!variable) {
    throw new Error(`Variable not found in loaded dataset: ${variableId}`);
  }
  return {
    id: variable.id,
    label: variable.label ?? variable.name,
    valueLabels: (variable.valueLabels ?? []).map((item) => ({
      value: normalizeValue(item.value),
      label: item.label,
    })),
    missingValues: variable.missingValues ?? {},
  };
}

function labelFor(variable, value) {
  const normalized = normalizeValue(value);
  const match = (variable.valueLabels ?? []).find((item) => normalizeValue(item.value) === normalized);
  return match?.label ?? normalized;
}

function summarizeFrequency(rows, rowVariable) {
  const totalWeight = rows.reduce((sum, row) => sum + Number(row.weightedCount ?? row.count ?? 0), 0);
  return rows.map((row) => {
    const weightedCount = Number(row.weightedCount ?? row.count ?? 0);
    const value = normalizeValue(row.rowKeys?.[0] ?? '');
    return {
      value,
      label: labelFor(rowVariable, value),
      weightedCount: Number(weightedCount.toFixed(3)),
      pct: totalWeight > 0 ? Number(((weightedCount / totalWeight) * 100).toFixed(1)) : 0,
    };
  });
}

function summarizeCrosstab(rows, rowVariable, colVariable) {
  const grouped = new Map();
  for (const row of rows) {
    const colKey = normalizeValue(row.colKey);
    const bucket = grouped.get(colKey) ?? [];
    bucket.push(row);
    grouped.set(colKey, bucket);
  }

  const summaries = [];
  for (const [colKey, bucket] of grouped.entries()) {
    const totalWeight = bucket.reduce((sum, row) => sum + Number(row.weightedCount ?? row.count ?? 0), 0);
    const categories = bucket
      .map((row) => {
        const weightedCount = Number(row.weightedCount ?? row.count ?? 0);
        const rowValue = normalizeValue(row.rowKeys?.[0] ?? '');
        return {
          rowValue,
          rowLabel: labelFor(rowVariable, rowValue),
          weightedCount: Number(weightedCount.toFixed(3)),
          pct: totalWeight > 0 ? Number(((weightedCount / totalWeight) * 100).toFixed(1)) : 0,
        };
      })
      .sort((left, right) => left.rowValue.localeCompare(right.rowValue, undefined, { numeric: true }));

    summaries.push({
      colValue: colKey,
      colLabel: labelFor(colVariable, colKey),
      totalWeightedCount: Number(totalWeight.toFixed(3)),
      categories,
    });
  }

  return summaries.sort((left, right) => left.colValue.localeCompare(right.colValue, undefined, { numeric: true }));
}

function buildFindingsMarkdown(result) {
  const frequency = result.analysisResults.find((item) => item.id === 'happiness_overall');
  const trust = result.analysisResults.find((item) => item.id === 'happiness_by_generalized_trust');

  const overallBullets = frequency?.summary.map((row) => `- ${row.label}: ${row.pct}% weighted share`) ?? [];
  const trustBullets = trust?.summary.map((column) => {
    const happyShare = column.categories
      .filter((category) => category.rowValue === '1' || category.rowValue === '2')
      .reduce((sum, category) => sum + category.pct, 0);
    const unhappyShare = column.categories
      .filter((category) => category.rowValue === '3' || category.rowValue === '4')
      .reduce((sum, category) => sum + category.pct, 0);
    return `- ${column.colLabel}: ${happyShare.toFixed(1)}% weighted happy/quite happy vs ${unhappyShare.toFixed(1)}% weighted not very/not at all happy`;
  }) ?? [];

  const chiSquare = trust?.tableStats?.chiSquare;
  const chiSquareLine = chiSquare
    ? `Weighted crosstab signal: chi-square ${chiSquare.chiSquare.toFixed(1)} (df ${chiSquare.df}, p ${chiSquare.pValue.toExponential(2)}, Cramer's V ${chiSquare.cramersV.toFixed(3)}).`
    : 'Weighted crosstab signal: table-level chi-square was not available in the captured result.';

  return `# EVAL-06 Findings Summary

Dataset: \`${result.dataset.path}\`
Weight: \`${result.weightVariable ?? 'none'}\`
Theme: \`Happiness and generalized trust\`

## Run Read

WVS Wave 7 completed the real browser metadata gate and then the full chunked load path without falling back to the Trust dataset. The bounded analysis stayed deliberately small: one weighted frequency on happiness and one weighted crosstab of happiness by generalized trust.

## Overall Happiness

${overallBullets.join('\n')}

## Happiness by Generalized Trust

${trustBullets.join('\n')}

${chiSquareLine}
`;
}

function buildFrequencyCsv(summary) {
  return writeCsv(
    ['value', 'label', 'weighted_count', 'weighted_pct'],
    summary.map((row) => [row.value, row.label, row.weightedCount, row.pct])
  );
}

function buildCrosstabCsv(summary) {
  return writeCsv(
    ['col_value', 'col_label', 'row_value', 'row_label', 'weighted_count', 'weighted_pct_within_col'],
    summary.flatMap((column) =>
      column.categories.map((category) => [
        column.colValue,
        column.colLabel,
        category.rowValue,
        category.rowLabel,
        category.weightedCount,
        category.pct,
      ])
    )
  );
}

async function runBoundedAnalysis(page, datasetConfig) {
  return page.evaluate(
    async ({ analyses, weightVar }) => {
      const { useVelocityStore } = await import('/src/store/index.ts');
      const { exportSession, serializeSessionFile } = await import('/src/core/session/index.ts');

      const waitForQuery = async () => {
        const start = Date.now();
        while (true) {
          const state = useVelocityStore.getState();
          if (!state.isQuerying && state.queryResult.length > 0) return;
          if (Date.now() - start > 120000) {
            throw new Error('Timed out waiting for analysis result');
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      };

      const state = useVelocityStore.getState();
      const dataset = state.dataset;
      if (!dataset) {
        throw new Error('No dataset loaded for bounded analysis');
      }

      if (weightVar) {
        state.setWeightVariable(weightVar);
      }

      const analysisResults = [];
      for (const analysis of analyses) {
        useVelocityStore.getState().setTableConfig({
          rowVars: analysis.rowVars,
          colVar: analysis.colVar,
        });
        await waitForQuery();
        const current = useVelocityStore.getState();
        analysisResults.push({
          id: analysis.id,
          rowVars: analysis.rowVars,
          colVar: analysis.colVar,
          rows: current.queryResult,
          tableStats: current.tableStats,
        });
      }

      const finalState = useVelocityStore.getState();
      const sessionFile = exportSession({
        dataset: finalState.dataset,
        variableSets: finalState.variableSets,
        folders: finalState.folders,
        transformLog: finalState.transformLog,
        tableConfig: finalState.tableConfig,
        activeFilters: finalState.activeFilters,
        analysisSettings: finalState.analysisSettings,
        slides: finalState.slides,
        sections: finalState.sections,
        workspace: {
          datasets: finalState.workspace.datasets.map((datasetEntry) => ({
            id: datasetEntry.id,
            name: datasetEntry.fileName || datasetEntry.name,
            rowCount: datasetEntry.rowCount,
            waveNumber: datasetEntry.waveNumber,
          })),
          projects: finalState.workspace.projects,
        },
        activeDatasetId: finalState.activeDatasetId,
        harmonizationSession: finalState.harmonization.session,
        velocityVersion: 'dev',
      });

      return {
        dataset: {
          id: finalState.dataset?.id ?? null,
          name: finalState.dataset?.name ?? null,
          rowCount: finalState.dataset?.rowCount ?? 0,
          variableCount: finalState.dataset?.variables.length ?? 0,
          weightVariable: finalState.dataset?.weightVariable ?? null,
          variables: finalState.dataset?.variables ?? [],
        },
        variableSetCount: finalState.variableSets.length,
        workspaceDatasets: finalState.workspace.datasets.map((datasetEntry) => ({
          id: datasetEntry.id,
          name: datasetEntry.name,
          rowCount: datasetEntry.rowCount,
          tableName: datasetEntry.tableName,
        })),
        analysisResults,
        sessionJson: serializeSessionFile(sessionFile),
      };
    },
    { analyses: datasetConfig.analyses, weightVar: datasetConfig.weightVar }
  );
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleEvents = [];
  const dialogEvents = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (/Worker|DataSlice|ReadStat|Error|error|warn|Warn|SAV/i.test(text)) {
      consoleEvents.push({
        type: msg.type(),
        text,
      });
    }
  });

  page.on('dialog', async (dialog) => {
    dialogEvents.push({
      type: dialog.type(),
      message: dialog.message(),
    });
    await dialog.accept();
  });

  try {
    await resetToFreshState(page);

    const attemptResults = [];
    let selectedConfig = DATASETS.wvs;
    let selectedAttempt = null;

    try {
      selectedAttempt = await attemptDataset(page, DATASETS.wvs);
      attemptResults.push(selectedAttempt);
    } catch (error) {
      attemptResults.push({
        datasetKey: DATASETS.wvs.key,
        datasetLabel: DATASETS.wvs.label,
        datasetPath: path.relative(process.cwd(), DATASETS.wvs.filePath),
        startedAt: new Date().toISOString(),
        succeeded: false,
        failureReason: error instanceof Error ? error.message : String(error),
      });
    }

    if (!selectedAttempt?.succeeded) {
      await resetToFreshState(page);
      selectedConfig = DATASETS.trust;
      selectedAttempt = await attemptDataset(page, DATASETS.trust);
      attemptResults.push(selectedAttempt);
    }

    if (!selectedAttempt?.succeeded) {
      throw new Error('Neither WVS nor fallback Trust completed the load path');
    }

    const analysisPayload = selectedConfig.analyses.length > 0
      ? await runBoundedAnalysis(page, selectedConfig)
      : null;

    let result = {
      dataset: {
        key: selectedConfig.key,
        label: selectedConfig.label,
        path: path.relative(process.cwd(), selectedConfig.filePath),
        rowCount: selectedAttempt.fullLoadStage?.rowCount ?? selectedAttempt.metadataStage?.rowCount ?? 0,
        variableCount: analysisPayload?.dataset.variableCount
          ?? selectedAttempt.fullLoadStage?.variableCount
          ?? selectedAttempt.metadataStage?.variableCount
          ?? 0,
      },
      fallbackUsed: selectedConfig.key !== DATASETS.wvs.key,
      attempts: attemptResults,
      weightVariable: analysisPayload?.dataset.weightVariable ?? selectedConfig.weightVar ?? null,
      boundedTheme: selectedConfig.key === 'wvs' ? 'Happiness and generalized trust' : null,
      variableSetCount: analysisPayload?.variableSetCount ?? selectedAttempt.fullLoadStage?.variableSetCount ?? null,
      workspaceDatasets: analysisPayload?.workspaceDatasets ?? [],
      dialogs: dialogEvents,
      consoleEvents,
      analysisResults: [],
    };

    if (analysisPayload) {
      const dataset = analysisPayload.dataset;
      const q46 = variableInfo(dataset, 'Q46');
      const q57 = variableInfo(dataset, 'Q57');

      const frequencyResult = analysisPayload.analysisResults.find((item) => item.id === 'happiness_overall');
      const trustResult = analysisPayload.analysisResults.find((item) => item.id === 'happiness_by_generalized_trust');

      const frequencySummary = summarizeFrequency(frequencyResult.rows, q46);
      const trustSummary = summarizeCrosstab(trustResult.rows, q46, q57);

      result.analysisResults = [
        {
          id: frequencyResult.id,
          rowVariables: [q46],
          colVariable: null,
          tableStats: frequencyResult.tableStats,
          summary: frequencySummary,
        },
        {
          id: trustResult.id,
          rowVariables: [q46],
          colVariable: q57,
          tableStats: trustResult.tableStats,
          summary: trustSummary,
        },
      ];

      const findingsMarkdown = buildFindingsMarkdown(result);
      const findingsPath = path.join(OUTPUT_DIR, 'findings_summary.md');
      const frequencyCsvPath = path.join(OUTPUT_DIR, 'happiness_overall.csv');
      const trustCsvPath = path.join(OUTPUT_DIR, 'happiness_by_generalized_trust.csv');
      const sessionPath = path.join(OUTPUT_DIR, 'session.velocity');
      const runJsonPath = path.join(OUTPUT_DIR, 'stress_run.json');

      await writeFile(findingsPath, findingsMarkdown, 'utf8');
      await writeFile(frequencyCsvPath, buildFrequencyCsv(frequencySummary), 'utf8');
      await writeFile(trustCsvPath, buildCrosstabCsv(trustSummary), 'utf8');
      await writeFile(sessionPath, analysisPayload.sessionJson, 'utf8');
      await writeFile(runJsonPath, `${JSON.stringify(result, jsonReplacer, 2)}\n`, 'utf8');
    } else {
      const runJsonPath = path.join(OUTPUT_DIR, 'stress_run.json');
      await writeFile(runJsonPath, `${JSON.stringify(result, jsonReplacer, 2)}\n`, 'utf8');
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
