import { useCallback, useEffect, useRef, useState } from 'react';
import { useVelocityStore } from '../../../store';
import {
  dismissContextualTip,
  getContextualTipCounters,
  recordContextualTipEvent,
  resolveActiveContextualTip,
  type ContextualTipId,
} from '../onboarding/contextualMicroTips';

export interface UseContextualMicroTipsOptions {
  onExport?: () => void;
}

export function useContextualMicroTips(options: UseContextualMicroTipsOptions = {}): {
  activeTip: ContextualTipId | null;
  dismissActiveTip: () => void;
  handleTipAction: () => void;
} {
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const queryResult = useVelocityStore((state) => state.queryResult);
  const isQuerying = useVelocityStore((state) => state.isQuerying);
  const activeSlideId = useVelocityStore((state) => state.activeSlideId);
  const focusMode = useVelocityStore((state) => state.focusMode);
  const appMode = useVelocityStore((state) => state.appMode);
  const dataset = useVelocityStore((state) => state.dataset);

  const [, forceRefresh] = useState(0);
  const prevSlideIdRef = useRef<string | null>(null);
  const prevCrosstabKeyRef = useRef<string | null>(null);

  const hasRenderedCrosstab =
    tableConfig.rowVars.length > 0 &&
    tableConfig.colVar !== null &&
    !isQuerying &&
    queryResult.length > 0;

  const crosstabKey = hasRenderedCrosstab
    ? `${tableConfig.rowVars.join(',')}:${tableConfig.colVar}:${queryResult.length}`
    : null;

  useEffect(() => {
    if (!crosstabKey || crosstabKey === prevCrosstabKeyRef.current) return;
    prevCrosstabKeyRef.current = crosstabKey;
    recordContextualTipEvent('crosstab-render');
    forceRefresh((value) => value + 1);
  }, [crosstabKey]);

  useEffect(() => {
    if (!activeSlideId || activeSlideId === prevSlideIdRef.current) return;
    if (prevSlideIdRef.current !== null) {
      recordContextualTipEvent('slide-navigation');
      forceRefresh((value) => value + 1);
    }
    prevSlideIdRef.current = activeSlideId;
  }, [activeSlideId]);

  useEffect(() => {
    if (focusMode) {
      recordContextualTipEvent('focus-mode');
      forceRefresh((value) => value + 1);
    }
  }, [focusMode]);

  useEffect(() => {
    if (appMode === 'variables') {
      recordContextualTipEvent('variable-manager-open');
      forceRefresh((value) => value + 1);
    }
  }, [appMode]);

  const activeTip =
    dataset && appMode === 'analysis' && !focusMode
      ? resolveActiveContextualTip(getContextualTipCounters())
      : null;

  const dismissActiveTip = useCallback(() => {
    forceRefresh((value) => value + 1);
  }, []);

  const handleTipAction = useCallback(() => {
    if (!activeTip) return;

    switch (activeTip) {
      case 'focus':
        useVelocityStore.getState().toggleFocusMode();
        break;
      case 'export':
        recordContextualTipEvent('export-open');
        options.onExport?.();
        break;
      case 'variable-manager':
        useVelocityStore.getState().toggleAppMode();
        break;
    }

    dismissContextualTip(activeTip);
    forceRefresh((value) => value + 1);
  }, [activeTip, options]);

  return { activeTip, dismissActiveTip, handleTipAction };
}
