import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVelocityStore } from '../../../store';
import {
  isFocusTipSeen,
  markFirstCrosstabTourDone,
  markFocusTipSeen,
  resolveFirstCrosstabTourStep,
  type FirstCrosstabTourStep,
} from '../onboarding/firstCrosstabTour';
import { recordPilotEvent } from '../../../services/pilotOnboarding';

const FOCUS_TIP_DELAY_MS = 1200;

export function useFirstCrosstabTour(): {
  tourStep: FirstCrosstabTourStep | null;
  dismissTourStep: () => void;
} {
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const queryResult = useVelocityStore((state) => state.queryResult);
  const isQuerying = useVelocityStore((state) => state.isQuerying);
  const focusMode = useVelocityStore((state) => state.focusMode);
  const appMode = useVelocityStore((state) => state.appMode);
  const dataset = useVelocityStore((state) => state.dataset);

  const [, forceRefresh] = useState(0);
  const focusTipTimerRef = useRef<number | null>(null);

  const hasRenderedCrosstab =
    tableConfig.rowVars.length > 0 && tableConfig.colVar !== null && !isQuerying && queryResult.length > 0;

  const tourStep = useMemo(() => {
    if (!dataset || focusMode || appMode !== 'analysis') return null;
    return resolveFirstCrosstabTourStep({
      rowCount: tableConfig.rowVars.length,
      hasColumn: Boolean(tableConfig.colVar),
      hasRenderedCrosstab,
    });
  }, [dataset, focusMode, appMode, tableConfig.rowVars.length, tableConfig.colVar, hasRenderedCrosstab]);

  const scheduleFocusTip = useCallback(() => {
    if (isFocusTipSeen() || !hasRenderedCrosstab) return;

    if (focusTipTimerRef.current !== null) {
      window.clearTimeout(focusTipTimerRef.current);
    }

    focusTipTimerRef.current = window.setTimeout(() => {
      if (isFocusTipSeen()) return;
      markFocusTipSeen();
      useVelocityStore.getState().addToast({
        dedupeKey: 'focus-mode-tip',
        title: 'Presentation-ready view',
        message: 'Press F for Focus mode when you want a cleaner, client-facing layout.',
        type: 'info',
        duration: 9000,
      });
    }, FOCUS_TIP_DELAY_MS);
  }, [hasRenderedCrosstab]);

  const dismissTourStep = useCallback(() => {
    markFirstCrosstabTourDone();
    if (hasRenderedCrosstab) {
      recordPilotEvent('first_crosstab', { source: 'activation-tour-complete' });
      scheduleFocusTip();
    }
    forceRefresh((value) => value + 1);
  }, [hasRenderedCrosstab, scheduleFocusTip]);

  useEffect(() => {
    return () => {
      if (focusTipTimerRef.current !== null) {
        window.clearTimeout(focusTipTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (tourStep === 'significance' && hasRenderedCrosstab) {
      recordPilotEvent('first_crosstab', { source: 'activation-tour-reached-significance' });
    }
  }, [tourStep, hasRenderedCrosstab]);

  return { tourStep, dismissTourStep };
}
