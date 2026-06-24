/**
 * useWelcomeBack Hook
 *
 * Orchestrates the returning-researcher welcome-back card: store selectors,
 * resume candidate selection, and resume/dismiss handlers.
 */

import { useCallback, useMemo } from 'react';
import { useVelocityStore } from '../../../store';
import {
  findResumeCandidate,
  shouldShowWelcomeBack,
  type ResumeCandidate,
} from '../lib/returningResearcher';
import type { StoredDataset } from '../components/WorkspaceView';

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

export function useWelcomeBack({
  datasets,
  onOpenDataset,
}: UseWelcomeBackOptions): UseWelcomeBackReturn {
  const {
    lastActiveAt,
    welcomeBackDismissed,
    dismissWelcomeBack,
    activeDatasetId,
    tableConfig,
  } = useVelocityStore();

  const resumeCandidate = useMemo(
    () => findResumeCandidate(datasets, activeDatasetId, tableConfig),
    [datasets, activeDatasetId, tableConfig],
  );

  const showWelcomeBack =
    datasets.length > 0 &&
    shouldShowWelcomeBack(lastActiveAt, welcomeBackDismissed) &&
    resumeCandidate !== null;

  const onResume = useCallback(() => {
    if (!resumeCandidate) return;
    const target = datasets.find(d => d.id === resumeCandidate.datasetId);
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
