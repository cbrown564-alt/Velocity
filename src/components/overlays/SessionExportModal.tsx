import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getBackdropProps, getMotionProps } from '../../lib/motion';
import { Download, FileText, LayoutGrid, Wand2, Filter, Layers, ShieldCheck, X } from 'lucide-react';

export interface SessionExportSummary {
  datasetName: string;
  rowCount: number;
  columnCount: number;
  recodeCount: number;
  slideCount: number;
  filterCount: number;
  sectionCount: number;
}

interface SessionExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: () => Promise<void>;
  summary: SessionExportSummary;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;
}

export const SessionExportModal: React.FC<SessionExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  summary,
}) => {
  const [isExporting, setIsExporting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setIsExporting(false);
      setDone(false);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isOpen]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport();
      setDone(true);
      // Auto-close after brief confirmation
      closeTimerRef.current = setTimeout(() => {
        onClose();
      }, 1200);
    } catch {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (isExporting) return;
    onClose();
  };

  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center bg-[var(--text-primary)]/40 px-4"
          {...getBackdropProps(reducedMotion)}
          onClick={handleClose}
        >
          <motion.div
            className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-2xl"
            {...getMotionProps({ preset: 'fadeScale', duration: reducedMotion ? 0.01 : 0.25, reducedMotion })}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Export Session</h2>
                <p className="text-xs text-[var(--text-secondary)]">Download a portable backup of your analysis recipe</p>
              </div>
              <button
                onClick={handleClose}
                disabled={isExporting}
                className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-active)] disabled:opacity-40"
                aria-label="Close export modal"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {/* Dataset summary */}
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Session Contents
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    <FileText size={14} className="shrink-0 text-[var(--text-secondary)]" />
                    <span className="font-medium truncate">{summary.datasetName}</span>
                    <span className="ml-auto shrink-0 text-xs text-[var(--text-secondary)]">
                      {formatCount(summary.rowCount)} rows × {formatCount(summary.columnCount)} cols
                    </span>
                  </li>
                  {summary.recodeCount > 0 && (
                    <li className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                      <Wand2 size={14} className="shrink-0 text-[var(--text-secondary)]" />
                      <span>{plural(summary.recodeCount, 'recoded variable')}</span>
                    </li>
                  )}
                  {summary.slideCount > 0 && (
                    <li className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                      <LayoutGrid size={14} className="shrink-0 text-[var(--text-secondary)]" />
                      <span>{plural(summary.slideCount, 'analysis slide')}</span>
                    </li>
                  )}
                  {summary.filterCount > 0 && (
                    <li className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                      <Filter size={14} className="shrink-0 text-[var(--text-secondary)]" />
                      <span>{plural(summary.filterCount, 'active filter')}</span>
                    </li>
                  )}
                  {summary.sectionCount > 0 && (
                    <li className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                      <Layers size={14} className="shrink-0 text-[var(--text-secondary)]" />
                      <span>{plural(summary.sectionCount, 'slide section')}</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Privacy note */}
              <div className="flex items-start gap-2 rounded-lg border border-[var(--border-color-muted)] bg-[var(--bg-app)] px-3 py-2.5">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[var(--text-secondary)]" />
                <p className="text-xs text-[var(--text-secondary)]">
                  Contains no respondent data — safe to email, share, or store in cloud drives without data governance review.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-color)] px-5 py-4">
              <button
                onClick={handleClose}
                disabled={isExporting}
                className="rounded-md border border-[var(--border-color)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-active)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting || done}
                className="flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm text-[var(--text-inverse)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={14} />
                {done ? 'Downloaded' : isExporting ? 'Preparing…' : 'Download .velocity'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
