import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useReducedMotion, DURATIONS } from '../../lib/motion';
import type { LoadProgressState } from '../../store/slices/data/types';

export interface UploadProgressBarProps {
  progress: LoadProgressState | null;
}

export const UploadProgressBar: React.FC<UploadProgressBarProps> = ({ progress }) => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ width: '0%' }}
      animate={{ width: `${Math.round((progress?.progress ?? 0) * 100)}%` }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.01 : 0.25, ease: 'easeOut' }}
      className="fixed top-0 left-0 h-1 bg-[var(--color-accent)] z-50 shadow-[0_0_10px_var(--color-accent)]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((progress?.progress ?? 0) * 100)}
      aria-label="Dataset load progress"
    />
  );
};
