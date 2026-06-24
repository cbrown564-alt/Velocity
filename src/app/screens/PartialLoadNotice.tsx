import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion, getBackdropProps, getMotionProps, DURATIONS } from '../../lib/motion';

export interface PartialLoadNoticeProps {
  title: string;
  message: string;
  details?: string;
  canRebuild: boolean;
  onRebuild: () => void;
  onDismiss: () => void;
}

export const PartialLoadNotice: React.FC<PartialLoadNoticeProps> = ({
  title,
  message,
  details,
  canRebuild,
  onRebuild,
  onDismiss,
}) => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      {...getBackdropProps(reducedMotion)}
      className="fixed inset-0 flex items-center justify-center bg-[var(--text-primary)]/30 z-[110] px-4"
    >
      <motion.div
        {...getMotionProps({
          preset: 'fadeScale',
          duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
          reducedMotion,
        })}
        className="w-full max-w-lg rounded-xl border border-[var(--status-warning-border)] bg-[var(--bg-panel)] shadow-2xl p-6 space-y-4"
      >
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-[var(--status-warning-text)]">{title}</h2>
          <p className="text-sm text-[var(--text-primary)]">{message}</p>
          {details && (
            <p className="text-xs text-[var(--text-secondary)] bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] rounded-md p-2">
              {details}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          {canRebuild && (
            <button
              onClick={onRebuild}
              className="flex-1 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Rebuild From Source
            </button>
          )}
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--bg-panel)] text-[var(--status-warning-text)] text-sm font-medium hover:bg-[var(--status-warning-surface)] transition-colors"
          >
            Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
