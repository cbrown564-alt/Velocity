import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVelocityStore } from '../../../store';
import {
  markFirstCrosstabTourDone,
  resolveFirstCrosstabTourStep,
  type FirstCrosstabTourStep,
} from '../onboarding/firstCrosstabTour';
import { recordPilotEvent } from '../../../services/pilotOnboarding';

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

  const dismissTourStep = useCallback(() => {
    markFirstCrosstabTourDone();
    if (hasRenderedCrosstab) {
      recordPilotEvent('first_crosstab', { source: 'activation-tour-complete' });
    }
    forceRefresh((value) => value + 1);
  }, [hasRenderedCrosstab]);

  useEffect(() => {
    if (tourStep === 'significance' && hasRenderedCrosstab) {
      recordPilotEvent('first_crosstab', { source: 'activation-tour-reached-significance' });
    }
  }, [tourStep, hasRenderedCrosstab]);

  return { tourStep, dismissTourStep };
}
