import { useCallback, useEffect, useRef, useState } from 'react';
import { useVelocityStore } from '../../../store';
import {
  dismissMicroTip,
  incrementMicroTipAction,
  resolveActiveMicroTip,
  type MicroTipDefinition,
} from '../onboarding/contextualMicroTips';
import { isFirstCrosstabTourDone } from '../onboarding/firstCrosstabTour';

export function useContextualMicroTips(): {
  activeTip: MicroTipDefinition | null;
  dismissActiveTip: () => void;
} {
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const queryResult = useVelocityStore((state) => state.queryResult);
  const isQuerying = useVelocityStore((state) => state.isQuerying);
  const appMode = useVelocityStore((state) => state.appMode);

  const [, forceRefresh] = useState(0);
  const prevAppModeRef = useRef(appMode);
  const focusCountedRef = useRef(false);
  const crosstabRenderCountRef = useRef(0);

  const hasRenderedCrosstab =
    tableConfig.rowVars.length > 0 && tableConfig.colVar !== null && !isQuerying && queryResult.length > 0;

  const refresh = useCallback(() => forceRefresh((value) => value + 1), []);

  const dismissActiveTip = useCallback(() => {
    const active = resolveActiveMicroTip();
    if (active) {
      dismissMicroTip(active.id);
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    if (!hasRenderedCrosstab || !isFirstCrosstabTourDone() || focusCountedRef.current) return;
    focusCountedRef.current = true;
    incrementMicroTipAction('focus');
    refresh();
  }, [hasRenderedCrosstab, refresh]);

  useEffect(() => {
    if (!hasRenderedCrosstab) return;
    crosstabRenderCountRef.current += 1;
    incrementMicroTipAction('export');
    refresh();
  }, [hasRenderedCrosstab, queryResult, refresh]);

  useEffect(() => {
    if (prevAppModeRef.current !== 'variables' && appMode === 'variables') {
      incrementMicroTipAction('variable-manager');
      refresh();
    }
    prevAppModeRef.current = appMode;
  }, [appMode, refresh]);

  const activeTip = appMode === 'analysis' && isFirstCrosstabTourDone() ? resolveActiveMicroTip() : null;

  return { activeTip, dismissActiveTip };
}
