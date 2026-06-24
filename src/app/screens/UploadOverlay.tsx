import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useReducedMotion, getMotionProps, DURATIONS } from '../../lib/motion';
import type { LoadProgressState } from '../../store/slices/data/types';

export interface UploadOverlayProps {
  loadStageHeadline: string;
  loadProgress: LoadProgressState | null;
  pendingSavFileName?: string;
  datasetName?: string;
}

export const UploadOverlay: React.FC<UploadOverlayProps> = ({
  loadStageHeadline,
  loadProgress,
  pendingSavFileName,
  datasetName,
}) => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      {...getMotionProps({ preset: 'fade', duration: DURATIONS.enter, reducedMotion })}
      className="fixed inset-0 flex items-center justify-center bg-[var(--bg-app)] z-40"
    >
      <div className="text-center space-y-4 max-w-md w-full px-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-[var(--bg-panel)] border border-[var(--border-color)] flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-[var(--color-accent)] animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="font-medium text-[var(--text-primary)]" data-testid="upload-stage-headline">
            {loadStageHeadline}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {loadProgress?.message || pendingSavFileName || datasetName || 'Preparing analysis engine'}
          </p>
          {loadProgress?.totalRows != null && loadProgress.totalRows > 0 && (
            <p className="text-xs text-[var(--text-tertiary)]">
              {Math.min(loadProgress.rowsProcessed ?? 0, loadProgress.totalRows).toLocaleString()} of{' '}
              {loadProgress.totalRows.toLocaleString()} rows
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
