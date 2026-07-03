import React, { useState, useRef } from 'react';
import { MethodologyDrawer } from './MethodologyPanel';
import { SignificanceLegend } from './SignificanceLegend';
import { Tooltip } from './Tooltip';
import type { Variable, TableStats } from '../../types';
import { allowsNumericStats } from '../../types';
import type { ComparisonMethod, CorrectionType } from '../../store/slices/analysisSlice';
import styles from './StatisticsStatusBar.module.css';

interface StatisticsStatusBarProps {
  /** Current analysis settings */
  analysisSettings: {
    comparisonMethod: ComparisonMethod;
    correctionType: CorrectionType;
    showConfidenceIntervals: boolean;
    showCellN: boolean;
    showColumnBases: boolean;
  };
  /** Table-level statistics (chi-square, etc.) */
  tableStats?: TableStats | null;
  /** Column variable (null if no crosstab) */
  colVariable: Variable | null;
  /** Whether overlap correction is active */
  overlapCorrected: boolean;
}

/**
 * StatisticsStatusBar — the margin note under the slide artifact.
 *
 * One muted line stating the active methodology; clicking it opens the
 * methodology drawer. Display and significance settings live in the
 * recipe inspector, not here.
 */
export const StatisticsStatusBar: React.FC<StatisticsStatusBarProps> = ({
  analysisSettings,
  tableStats,
  colVariable,
  overlapCorrected,
}) => {
  const [showMethodology, setShowMethodology] = useState(false);
  const methodologyPillRef = useRef<HTMLButtonElement>(null);

  // Determine table type based on column variable's measurement level, not on
  // whether any cells happen to be significant (which gives false negatives when
  // no cells cross the threshold).
  const isCatNumeric = colVariable !== null && allowsNumericStats(colVariable.type, colVariable.orderedScoring);
  const isCatCrossTab = colVariable !== null && !isCatNumeric;
  const noCol = colVariable === null;

  const getMethodologyText = () => {
    if (isCatNumeric || noCol) {
      return 'Descriptive only · no significance test';
    }

    const parts: string[] = ["Welch's t"];
    parts.push(analysisSettings.comparisonMethod === 'pairwise' ? 'pairwise (A/B/C)' : 'cell vs rest');
    if (analysisSettings.correctionType !== 'none') {
      parts.push(analysisSettings.correctionType === 'bonferroni' ? 'Bonferroni' : 'BH (FDR)');
    }
    return parts.join(' · ');
  };

  const chiSq = tableStats?.chiSquare;
  const isSignificantChi = chiSq ? chiSq.pValue < 0.05 : false;

  return (
    <>
      <div className={`${styles.statusBar} statistics-status-bar`}>
        <div className={styles.statusRow}>
          {noCol ? (
            <span className={styles.descriptiveLabel}>Frequency distribution</span>
          ) : (
            <button
              ref={methodologyPillRef}
              type="button"
              className={styles.methodologyPill}
              onClick={() => setShowMethodology((open) => !open)}
              aria-expanded={showMethodology}
              title="View statistical methodology"
            >
              {getMethodologyText()}
            </button>
          )}

          {isCatCrossTab && (
            <SignificanceLegend
              compact
              comparisonMethod={analysisSettings.comparisonMethod}
              correctionType={analysisSettings.correctionType}
              overlapCorrected={overlapCorrected}
              showMethodologyLink={false}
            />
          )}

          {chiSq && (
            <Tooltip
              content={
                <div className="text-xs space-y-1">
                  <div className="font-semibold">Chi-Square Test of Independence</div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    <span className="text-[var(--text-secondary)]">Chi-Square (χ²):</span>
                    <span className="font-mono">{chiSq.chiSquare.toFixed(2)}</span>
                    <span className="text-[var(--text-secondary)]">Degrees of Freedom:</span>
                    <span className="font-mono">{chiSq.df}</span>
                    <span className="text-[var(--text-secondary)]">p-value:</span>
                    <span className="font-mono">{chiSq.pValue < 0.001 ? '<0.001' : chiSq.pValue.toFixed(3)}</span>
                    <span className="text-[var(--text-secondary)]">Cramér's V:</span>
                    <span className="font-mono">{chiSq.cramersV.toFixed(3)}</span>
                  </div>
                  <div className="pt-1 text-[var(--text-secondary)] text-[10px]">
                    {isSignificantChi
                      ? 'Variables are significantly associated (p < 0.05)'
                      : 'No significant association found (p ≥ 0.05)'}
                  </div>
                </div>
              }
              position="top"
              delay={200}
              maxWidth={280}
            >
              <span className={styles.chiSquareNote}>
                χ² {chiSq.chiSquare.toFixed(1)}, p {chiSq.pValue < 0.001 ? '< .001' : `= ${chiSq.pValue.toFixed(3)}`}
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      <MethodologyDrawer
        isOpen={showMethodology}
        onClose={() => setShowMethodology(false)}
        anchorRef={methodologyPillRef}
      />
    </>
  );
};
