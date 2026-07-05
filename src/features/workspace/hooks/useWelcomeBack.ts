/**
 * useWelcomeBack Hook
 *
 * Orchestrates the returning-researcher welcome-back card: store selectors,
 * resume candidate selection, and resume/dismiss handlers.
 */

import { useCallback, useMemo } from 'react';
import { useVelocityStore } from '../../../store';
import { findResumeCandidate, type ResumeCandidate } from '../lib/returningResearcher';
import { shouldShowWelcomeBack } from '../../../lib/welcomeBack';
import type { StoredDataset } from '../types';

export interface UseWelcomeBackOptions {
  datasets: StoredDataset[];
  onOpenDataset: (dataset: StoredDataset) => void;
}

export interface UseWelcomeBackReturn {
  showWelcomeBack: boolean;
  resumeCandidate: ResumeCandidate | null;
  onResume: () => void;
  onDismiss: () => void;
}

export function useWelcomeBack({ datasets, onOpenDataset }: UseWelcomeBackOptions): UseWelcomeBackReturn {
  const lastActiveAt = useVelocityStore((state) => state.lastActiveAt);
  const welcomeBackDismissed = useVelocityStore((state) => state.welcomeBackDismissed);
  const dismissWelcomeBack = useVelocityStore((state) => state.dismissWelcomeBack);
  const activeDatasetId = useVelocityStore((state) => state.activeDatasetId);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const liveVariables = useVelocityStore((state) => state.dataset?.variables);

  const resumeCandidate = useMemo(
    () => findResumeCandidate(datasets, activeDatasetId, tableConfig, { liveVariables }),
    [datasets, activeDatasetId, tableConfig, liveVariables],
  );

  const showWelcomeBack =
    datasets.length > 0 && shouldShowWelcomeBack(lastActiveAt, welcomeBackDismissed) && resumeCandidate !== null;

  const onResume = useCallback(() => {
    if (!resumeCandidate) return;
    const target = datasets.find((d) => d.id === resumeCandidate.datasetId);
    if (target) onOpenDataset(target);
    dismissWelcomeBack();
  }, [resumeCandidate, datasets, onOpenDataset, dismissWelcomeBack]);

  return {
    showWelcomeBack,
    resumeCandidate,
    onResume,
    onDismiss: dismissWelcomeBack,
  };
}

export default useWelcomeBack;
