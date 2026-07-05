import { useEffect, useRef } from 'react';
import { useVelocityStore } from '../../../store';
import {
  pickAutoFirstCrosstabPair,
  resolveAutoCrosstabTableConfig,
  resolveExampleDatasetWeightVariable,
} from '../lib/autoFirstCrosstab';

/**
 * One-time auto-first-crosstab after Load Example (brandtracker_w4.sav, sleep.sav,
 * or mock_data.csv). STAB-UI-E §9.4 — no toast; Story Shelf + deferred backup reminder.
 */
const AUTO_CROSSTAB_EXAMPLES = new Set(['brandtracker_w4.sav', 'sleep.sav', 'mock_data.csv']);
export function useAutoFirstCrosstab(
  resolvedRowVarsLength: number,
  tableConfigColVar: string | null | undefined,
): void {
  const dataset = useVelocityStore((state) => state.dataset);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const hasSeenAutoCrosstab = useVelocityStore((state) => state.hasSeenAutoCrosstab);
  const markAutoCrosstabSeen = useVelocityStore((state) => state.markAutoCrosstabSeen);

  const autoCrosstabAppliedRef = useRef(false);

  useEffect(() => {
    if (autoCrosstabAppliedRef.current || hasSeenAutoCrosstab) return;

    const isExampleDataset = dataset?.name != null && AUTO_CROSSTAB_EXAMPLES.has(dataset.name);
    const isEmptyDeck = resolvedRowVarsLength === 0 && !tableConfigColVar;
    if (!isExampleDataset || !isEmptyDeck || variableSets.length === 0) {
      return;
    }

    const pair = pickAutoFirstCrosstabPair(dataset?.name, variableSets, dataset?.variables);
    if (!pair) return;

    const config = resolveAutoCrosstabTableConfig(pair, variableSets);
    if (!config) return;

    autoCrosstabAppliedRef.current = true;

    const weightVarId = resolveExampleDatasetWeightVariable(dataset?.name, dataset?.variables, dataset?.weightVariable);
    if (weightVarId) {
      useVelocityStore.getState().setWeightVariable(weightVarId);
    }

    useVelocityStore.getState().setTableConfig(config);
    markAutoCrosstabSeen();
  }, [
    dataset?.name,
    dataset?.variables,
    dataset?.weightVariable,
    resolvedRowVarsLength,
    tableConfigColVar,
    hasSeenAutoCrosstab,
    variableSets,
    markAutoCrosstabSeen,
  ]);
}
