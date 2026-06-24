import React from 'react';
import { motion } from 'framer-motion';
import { Table } from 'lucide-react';
import { useReducedMotion, getMotionProps, DURATIONS } from '../../lib/motion';

export interface RestorationPromptProps {
  rowCount: number;
  columnCount: number;
  datasetName?: string;
  lastModified?: number;
  warning?: string | null;
  onRestore: () => void;
  onDiscard: () => void;
}

export const RestorationPrompt: React.FC<RestorationPromptProps> = ({
  rowCount,
  columnCount,
  datasetName,
  lastModified,
  warning,
  onRestore,
  onDiscard,
}) => {
  const lastModifiedLabel = lastModified ? new Date(lastModified).toLocaleString() : null;
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      {...getMotionProps({ preset: 'fade', duration: DURATIONS.enter, reducedMotion })}
      className="fixed inset-0 flex items-center justify-center bg-[var(--bg-app)] z-40"
    >
      <div className="text-center space-y-6 max-w-md w-full px-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Welcome Back</h1>
          <p className="text-[var(--text-secondary)] text-lg">We found your previous session.</p>
        </div>
        <div className="bg-[var(--bg-surface)] rounded-xl p-6 text-left space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[var(--bg-active)] rounded-lg flex items-center justify-center">
              <Table className="w-5 h-5 text-[var(--text-accent)]" />
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">{datasetName || 'Previous Session'}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                {rowCount.toLocaleString()} rows, {columnCount} columns
              </p>
              {lastModifiedLabel && (
                <p className="text-xs text-[var(--text-secondary)]">Last opened: {lastModifiedLabel}</p>
              )}
            </div>
          </div>
          {warning && (
            <div className="text-xs text-[var(--status-warning-text)] bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] rounded-md p-2">
              {warning}
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <motion.button
            onClick={onRestore}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 px-6 py-3 bg-[var(--color-accent)] text-[var(--text-inverse)] font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Restore Session
          </motion.button>
          <motion.button
            onClick={onDiscard}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 px-6 py-3 bg-[var(--bg-active)] text-[var(--text-primary)] font-medium rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
          >
            Start Fresh
          </motion.button>
        </div>
        <p className="text-xs text-[var(--text-tertiary)]">Your data is stored locally in your browser.</p>
      </div>
    </motion.div>
  );
};
