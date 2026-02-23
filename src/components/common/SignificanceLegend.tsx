import React from 'react';
import { ArrowUp, ArrowDown, Info } from 'lucide-react';

interface SignificanceLegendProps {
  /** Show compact inline version */
  compact?: boolean;
  /** Active comparison method */
  comparisonMethod?: 'cell_vs_rest' | 'pairwise';
  /** Active multiple-testing correction */
  correctionType?: 'none' | 'bonferroni' | 'fdr';
  /** Show methodology link */
  showMethodologyLink?: boolean;
  /** Callback when methodology link is clicked */
  onMethodologyClick?: () => void;
}

/**
 * SignificanceLegend
 *
 * Displays a legend explaining the significance arrow markers
 * used in crosstab tables. Shows 95% and 80% confidence levels.
 */
export const SignificanceLegend: React.FC<SignificanceLegendProps> = ({
  compact = false,
  comparisonMethod = 'cell_vs_rest',
  correctionType = 'none',
  showMethodologyLink = true,
  onMethodologyClick,
}) => {
  const correctionLabel =
    correctionType === 'bonferroni'
      ? 'Bonferroni'
      : correctionType === 'fdr'
        ? 'Benjamini-Hochberg (FDR)'
        : 'None';

  const methodText =
    comparisonMethod === 'pairwise'
      ? 'Pairwise Welch\'s T-Test with column letter coding.'
      : 'Welch\'s T-Test (Cell vs Rest) with Effective Sample Size adjustment for weighted data.';

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)]">
        <span className="flex items-center gap-1">
          <ArrowUp size={10} className="text-[var(--color-success)]" />
          <ArrowDown size={10} className="text-[var(--color-error)]" />
          <span>95% CI</span>
        </span>
        <span className="flex items-center gap-1">
          <ArrowUp size={10} className="text-[var(--text-secondary)]" />
          <ArrowDown size={10} className="text-[var(--text-secondary)]" />
          <span>80% CI</span>
        </span>
        {showMethodologyLink && (
          <button
            onClick={onMethodologyClick}
            className="flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors"
          >
            <Info size={10} />
            <span>How we calculate</span>
          </button>
        )}
        {correctionType !== 'none' && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-[var(--bg-panel)] text-[var(--text-secondary)]">
            {correctionLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-md p-3 text-xs">
      <div className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
        Statistical Significance
        {showMethodologyLink && (
          <button
            onClick={onMethodologyClick}
            className="text-[var(--color-accent)] hover:underline font-normal flex items-center gap-1"
          >
            <Info size={12} />
            How we calculate
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {/* 95% Confidence */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
            95% Confidence
          </div>
          <div className="flex items-center gap-2">
            <ArrowUp size={14} className="text-[var(--color-success)]" />
            <span className="text-[var(--text-primary)]">
              Significantly higher than rest
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowDown size={14} className="text-[var(--color-error)]" />
            <span className="text-[var(--text-primary)]">
              Significantly lower than rest
            </span>
          </div>
        </div>

        {/* 80% Confidence */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-[var(--text-secondary)] font-semibold">
            80% Confidence
          </div>
          <div className="flex items-center gap-2">
            <ArrowUp size={14} className="text-[var(--text-secondary)]" />
            <span className="text-[var(--text-primary)]">
              Moderately higher than rest
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowDown size={14} className="text-[var(--text-secondary)]" />
            <span className="text-[var(--text-primary)]">
              Moderately lower than rest
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-[var(--border-color)] text-[10px] text-[var(--text-secondary)]">
        {methodText} Multiple-testing correction: {correctionLabel}.
      </div>
    </div>
  );
};
