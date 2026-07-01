import { useCallback, useEffect, useRef, useState } from 'react';
import { useVelocityStore } from '../../../store';
import {
  dismissMicroTip,
  incrementMicroTipAction,
  resolveActiveMicroTip,
  type MicroTipDefinition,
} from '../onboarding/contextualMicroTips';
import { isFirstCrosstabTourDone, shouldSuppressFirstRunCoaching } from '../onboarding/firstCrosstabTour';

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
  const prevExportConfigRef = useRef<string | null>(null);

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
    if (!hasRenderedCrosstab || !isFirstCrosstabTourDone()) return;

    const configKey = `${tableConfig.rowVars.join(',')}|${tableConfig.colVar ?? ''}`;
    if (prevExportConfigRef.current === configKey) return;
    prevExportConfigRef.current = configKey;

    incrementMicroTipAction('export');
    refresh();
  }, [hasRenderedCrosstab, tableConfig.rowVars, tableConfig.colVar, refresh]);

  useEffect(() => {
    if (prevAppModeRef.current !== 'variables' && appMode === 'variables') {
      incrementMicroTipAction('variable-manager');
      refresh();
    }
    prevAppModeRef.current = appMode;
  }, [appMode, refresh]);

  const activeTip =
    appMode === 'analysis' && isFirstCrosstabTourDone() && !shouldSuppressFirstRunCoaching()
      ? resolveActiveMicroTip()
      : null;

  return { activeTip, dismissActiveTip };
}
