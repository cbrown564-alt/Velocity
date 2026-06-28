import { useEffect, useRef } from 'react';
import { useVelocityStore } from '../../../store';
import { pickAutoFirstCrosstabPair, resolveAutoCrosstabTableConfig } from '../lib/autoFirstCrosstab';

/**
 * One-time auto-first-crosstab after Load Example (mock_data.csv only).
 * STAB-UI-E §9.4 — no toast; Story Shelf + deferred backup reminder.
 */
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

    const isMockDataset = dataset?.name === 'mock_data.csv';
    const isEmptyDeck = resolvedRowVarsLength === 0 && !tableConfigColVar;
    if (!isMockDataset || !isEmptyDeck || variableSets.length === 0) {
      return;
    }

    const pair = pickAutoFirstCrosstabPair(dataset?.name, variableSets, dataset?.variables);
    if (!pair) return;

    const config = resolveAutoCrosstabTableConfig(pair, variableSets);
    if (!config) return;

    autoCrosstabAppliedRef.current = true;
    useVelocityStore.getState().setTableConfig(config);
    markAutoCrosstabSeen();
  }, [
    dataset?.name,
    dataset?.variables,
    resolvedRowVarsLength,
    tableConfigColVar,
    hasSeenAutoCrosstab,
    variableSets,
    markAutoCrosstabSeen,
  ]);
}
