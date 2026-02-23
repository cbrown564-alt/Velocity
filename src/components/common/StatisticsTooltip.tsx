import React from 'react';

interface CellStats {
  tScore: number;
  pValue: number;
  adjustedPValue?: number;
  correctionMethod?: 'none' | 'bonferroni' | 'fdr';
  effN: number;
}

interface ConfidenceInterval {
  lower: number;
  upper: number;
}

type SignificanceLevel = 'high_95' | 'high_80' | 'low_95' | 'low_80' | undefined;

interface StatisticsTooltipProps {
  stats: CellStats;
  sig: SignificanceLevel;
  /** The displayed value (percent or mean) */
  value: number;
  /** Whether this is a mean (metric) or percent (frequency) */
  isMetric?: boolean;
  /** 95% Confidence interval */
  ci95?: ConfidenceInterval;
  /** 80% Confidence interval */
  ci80?: ConfidenceInterval;
}

/**
 * StatisticsTooltip
 *
 * Rich tooltip content explaining the statistical test methodology
 * for a crosstab cell. Shows t-score, p-value, ESS, and plain English
 * interpretation.
 */
export const StatisticsTooltip: React.FC<StatisticsTooltipProps> = ({
  stats,
  sig,
  value,
  isMetric = false,
  ci95,
  ci80,
}) => {
  const { tScore, pValue, adjustedPValue, correctionMethod, effN } = stats;
  const hasCorrection = correctionMethod && correctionMethod !== 'none' && adjustedPValue !== undefined;

  const correctionLabel =
    correctionMethod === 'bonferroni'
      ? 'Bonferroni'
      : correctionMethod === 'fdr'
        ? 'Benjamini-Hochberg (FDR)'
        : null;

  // Determine significance interpretation
  const getInterpretation = () => {
    if (!sig) {
      return {
        summary: 'Not statistically significant',
        detail: 'This value is within the expected range compared to other groups.',
        color: 'var(--text-secondary)',
      };
    }

    const isHigh = sig.includes('high');
    const is95 = sig.includes('95');

    if (isHigh && is95) {
      return {
        summary: 'Significantly higher (95% confidence)',
        detail: `This ${isMetric ? 'mean' : 'percentage'} is statistically higher than the rest of the sample. There is less than a 5% chance this difference occurred by random variation.`,
        color: 'var(--color-success)',
      };
    }
    if (isHigh && !is95) {
      return {
        summary: 'Moderately higher (80% confidence)',
        detail: `This ${isMetric ? 'mean' : 'percentage'} appears higher than the rest, but with lower confidence. There is about a 20% chance this is due to random variation.`,
        color: 'var(--text-secondary)',
      };
    }
    if (!isHigh && is95) {
      return {
        summary: 'Significantly lower (95% confidence)',
        detail: `This ${isMetric ? 'mean' : 'percentage'} is statistically lower than the rest of the sample. There is less than a 5% chance this difference occurred by random variation.`,
        color: 'var(--color-error)',
      };
    }
    // low_80
    return {
      summary: 'Moderately lower (80% confidence)',
      detail: `This ${isMetric ? 'mean' : 'percentage'} appears lower than the rest, but with lower confidence. There is about a 20% chance this is due to random variation.`,
      color: 'var(--text-secondary)',
    };
  };

  const interpretation = getInterpretation();

  return (
    <div className="space-y-3 min-w-[240px]">
      {/* Header: Test Name */}
      <div className="border-b border-[var(--border-color)] pb-2">
        <div className="font-semibold text-[var(--text-primary)]">
          Welch's T-Test
        </div>
        <div className="text-[10px] text-[var(--text-secondary)]">
          Cell vs Rest Comparison
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">
            t-score
          </div>
          <div className="font-mono font-semibold text-sm">
            {tScore.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">
            p-value
          </div>
          <div className="font-mono font-semibold text-sm">
            {pValue < 0.001 ? '<0.001' : pValue.toFixed(3)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">
            Eff. N
          </div>
          <div className="font-mono font-semibold text-sm">
            {effN.toFixed(1)}
          </div>
        </div>
      </div>

      {hasCorrection && correctionLabel && (
        <div className="pt-2 border-t border-[var(--border-color)]">
          <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">
            Multiple Testing Correction
          </div>
          <div className="text-xs">
            <span className="text-[var(--text-secondary)]">Method: </span>
            <span className="font-medium">{correctionLabel}</span>
          </div>
          <div className="text-xs">
            <span className="text-[var(--text-secondary)]">Adjusted p-value: </span>
            <span className="font-mono">
              {adjustedPValue < 0.001 ? '<0.001' : adjustedPValue.toFixed(3)}
            </span>
          </div>
        </div>
      )}

      {/* Confidence Intervals */}
      {ci95 && (
        <div className="pt-2 border-t border-[var(--border-color)]">
          <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide mb-1">
            Confidence Intervals
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[var(--text-secondary)]">95% CI: </span>
              <span className="font-mono">
                {isMetric
                  ? `${ci95.lower.toFixed(2)} – ${ci95.upper.toFixed(2)}`
                  : `${(ci95.lower * 100).toFixed(1)}% – ${(ci95.upper * 100).toFixed(1)}%`}
              </span>
            </div>
            {ci80 && (
              <div>
                <span className="text-[var(--text-secondary)]">80% CI: </span>
                <span className="font-mono">
                  {isMetric
                    ? `${ci80.lower.toFixed(2)} – ${ci80.upper.toFixed(2)}`
                    : `${(ci80.lower * 100).toFixed(1)}% – ${(ci80.upper * 100).toFixed(1)}%`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interpretation */}
      <div className="pt-2 border-t border-[var(--border-color)]">
        <div
          className="font-semibold text-sm mb-1"
          style={{ color: interpretation.color }}
        >
          {interpretation.summary}
        </div>
        <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          {interpretation.detail}
        </div>
      </div>

      {/* Methodology Note */}
      <div className="text-[10px] text-[var(--text-secondary)] italic pt-1 border-t border-[var(--border-color)]">
        ESS = Effective Sample Size (Kish's Approximation)
      </div>
    </div>
  );
};
