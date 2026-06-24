import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, BarChart3, LayoutGrid } from 'lucide-react';
import { useReducedMotion, getMotionProps, DURATIONS } from '../../lib/motion';
import type { Dataset } from '../../types/dataset';

export interface MetadataScreenProps {
  dataset: Dataset;
  pendingSavSizeMb?: number;
  onCancel: () => void;
  onLoadFull: () => void;
}

export const MetadataScreen: React.FC<MetadataScreenProps> = ({
  dataset,
  pendingSavSizeMb,
  onCancel,
  onLoadFull,
}) => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      {...getMotionProps({ preset: 'fade', duration: DURATIONS.enter, reducedMotion })}
      className="fixed inset-0 flex items-center justify-center bg-[var(--bg-app)] z-40"
    >
      <div className="text-center space-y-8 max-w-2xl w-full px-6">
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight text-[var(--text-primary)]">Metadata Loaded</h1>
          <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto">
            We loaded a small row sample to improve analytics heuristics and avoid a memory crash.
          </p>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-8 text-left space-y-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] rounded-xl flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-[var(--status-warning-text)]" />
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <p className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  {dataset.name}
                </p>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Full data is not loaded, so analysis actions are disabled until you continue.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <div className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color-muted)] rounded-lg text-sm text-[var(--text-primary)] flex flex-col">
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Rows</span>
                  <span className="font-semibold">{dataset.rowCount.toLocaleString()}</span>
                </div>
                <div className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color-muted)] rounded-lg text-sm text-[var(--text-primary)] flex flex-col">
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Variables</span>
                  <span className="font-semibold">{dataset.variables.length.toLocaleString()}</span>
                </div>
                {dataset.sampleRowCount && (
                  <div className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color-muted)] rounded-lg text-sm text-[var(--text-primary)] flex flex-col">
                    <span className="text-xs text-[var(--text-secondary)] font-medium">Sampled Rows</span>
                    <span className="font-semibold">
                      {dataset.sampleRowCount.toLocaleString()}
                      {dataset.sampleStrategy === 'spread' ? (
                        <span className="text-[var(--text-secondary)] font-normal text-xs ml-1">(spread)</span>
                      ) : (
                        ''
                      )}
                    </span>
                  </div>
                )}
                {pendingSavSizeMb && (
                  <div className="px-3 py-1.5 bg-[var(--bg-panel)] border border-[var(--border-color-muted)] rounded-lg text-sm text-[var(--text-primary)] flex flex-col">
                    <span className="text-xs text-[var(--text-secondary)] font-medium">File Size</span>
                    <span className="font-semibold">{pendingSavSizeMb.toFixed(1)} MB</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-2xl p-6 text-left shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Variables Preview</p>
            <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-panel)] px-2 py-0.5 rounded-full">
              Showing top 20
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
            {dataset.variables.slice(0, 20).map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border-color-muted)] bg-[var(--bg-panel)] hover:bg-[var(--bg-active)] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color-muted)] flex items-center justify-center shrink-0">
                  {v.type === 'numeric' || v.type === 'scale' ? (
                    <BarChart3 className="w-4 h-4 text-[var(--tag-scale-text)]" />
                  ) : (
                    <LayoutGrid className="w-4 h-4 text-[var(--tag-nominal-text)]" />
                  )}
                </div>
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate" title={v.label || v.name}>
                    {v.label || v.name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {v.name} · {v.type}
                  </p>
                </div>
              </div>
            ))}
            {dataset.variables.length > 20 && (
              <div className="flex items-center justify-center p-2.5 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] text-sm text-[var(--text-secondary)]">
                + {dataset.variables.length - 20} more variables
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-4 pt-2 max-w-md mx-auto">
          <motion.button
            onClick={onCancel}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 py-3.5 px-6 rounded-xl text-[var(--text-primary)] font-medium hover:bg-[var(--bg-active)] transition-colors"
          >
            Back to Upload
          </motion.button>
          <motion.button
            onClick={onLoadFull}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex-1 py-3.5 px-6 rounded-xl bg-[var(--color-accent)] text-[var(--text-inverse)] font-semibold shadow-md shadow-[var(--color-accent)]/20"
          >
            Load Full Data
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};
