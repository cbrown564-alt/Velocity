import React from 'react';
import { X } from 'lucide-react';
import type { SessionImportRailSummary } from '../../../core/session/sessionImportRailSummary';

export interface SessionImportSummaryProps {
  summary: SessionImportRailSummary;
  onDismiss: () => void;
}

const REDUNDANT_ADJUSTMENT_IDS = new Set([
  'missing-variable-ids',
  'dropped-variable-set-ids',
  'dropped-row-var-ids',
  'dropped-col-var-ids',
]);

function formatSlideList(numbers: number[]): string {
  if (numbers.length === 0) return '';
  if (numbers.length <= 4) return numbers.join(', ');
  return `${numbers.slice(0, 3).join(', ')} +${numbers.length - 3}`;
}

function formatVariableList(labels: string[]): string {
  if (labels.length === 0) return '';
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

export const SessionImportSummary: React.FC<SessionImportSummaryProps> = ({ summary, onDismiss }) => {
  const slideLabel = summary.slideCount === 1 ? '1 slide' : `${summary.slideCount} slides`;
  const unresolvedLabel =
    summary.unresolvedVariableLabels.length === 1
      ? '1 variable unresolved'
      : `${summary.unresolvedVariableLabels.length} variables unresolved`;
  const secondaryAdjustments = summary.adjustmentMessages.filter((item) => !REDUNDANT_ADJUSTMENT_IDS.has(item.id));

  return (
    <div
      className="mb-2 rounded-md border border-[var(--border-color-muted)] bg-[var(--bg-rail)]/60 px-2 py-1.5"
      data-testid="session-import-summary"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[11px] leading-snug text-[var(--text-secondary)]">Session imported · {slideLabel}</p>
          {summary.unresolvedVariableLabels.length > 0 && (
            <p className="text-[11px] leading-snug text-[var(--text-tertiary)]" data-testid="session-import-unresolved">
              {unresolvedLabel}
              <span> ({formatVariableList(summary.unresolvedVariableLabels)})</span>
            </p>
          )}
          {summary.affectedSlideNumbers.length > 0 && (
            <p className="text-[11px] leading-snug text-[var(--text-tertiary)]" data-testid="session-import-affected">
              Affects slides {formatSlideList(summary.affectedSlideNumbers)}
            </p>
          )}
          {secondaryAdjustments.map((item) => (
            <p key={item.id} className="text-[11px] leading-snug text-[var(--text-tertiary)]">
              {item.message}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss import summary"
          data-testid="session-import-summary-dismiss"
          className="shrink-0 rounded p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-panel)] transition-colors"
        >
          <X size={12} aria-hidden />
        </button>
      </div>
    </div>
  );
};
