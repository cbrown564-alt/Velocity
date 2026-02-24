import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings } from 'lucide-react';
import { SignificanceLegend } from './SignificanceLegend';
import { AnalysisSettingsPanel } from './AnalysisSettingsPanel';
import { Tooltip } from './Tooltip';
import type { Variable, TableStats } from '../../types';
import type { ComparisonMethod, CorrectionType } from '../../store/slices/analysisSlice';
import styles from './StatisticsStatusBar.module.css';

interface StatisticsStatusBarProps {
  /** Current analysis settings */
  analysisSettings: {
    comparisonMethod: ComparisonMethod;
    correctionType: CorrectionType;
    showConfidenceIntervals: boolean;
  };
  /** Table-level statistics (chi-square, etc.) */
  tableStats?: TableStats | null;
  /** Column variable (null if no crosstab) */
  colVariable: Variable | null;
  /** Whether overlap correction is active */
  overlapCorrected: boolean;
  /** Callback to open methodology drawer */
  onMethodologyClick: () => void;
  /** Whether any cells have significance markers */
  hasSignificance: boolean;
}

/**
 * StatisticsStatusBar
 *
 * Always-visible strip below the table that communicates the active
 * statistical methodology and provides access to settings.
 */
export const StatisticsStatusBar: React.FC<StatisticsStatusBarProps> = ({
  analysisSettings,
  tableStats,
  colVariable,
  overlapCorrected,
  onMethodologyClick,
  hasSignificance,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  // Determine if this is a cat x cat table (has significance testing)
  const isCatCrossTab = colVariable !== null && hasSignificance;
  // Cat x Numeric: colVariable exists but no significance markers (means display)
  const isCatNumeric = colVariable !== null && !hasSignificance;
  // No column variable at all
  const noCol = colVariable === null;

  // Build methodology pill text
  const getMethodologyText = () => {
    if (isCatNumeric || noCol) {
      return 'Descriptive Only · No significance test';
    }

    const parts: string[] = ["Welch's T"];

    if (analysisSettings.comparisonMethod === 'pairwise') {
      parts.push('Pairwise (A/B/C)');
    } else {
      parts.push('Cell vs Rest');
    }

    if (analysisSettings.correctionType !== 'none') {
      parts.push(
        analysisSettings.correctionType === 'bonferroni'
          ? 'Bonferroni'
          : 'BH (FDR)'
      );
    }

    return parts.join(' · ');
  };

  const chiSq = tableStats?.chiSquare;
  const isSignificantChi = chiSq ? chiSq.pValue < 0.05 : false;

  // Determine whether to show settings gear (only for cat x cat with significance)
  const showGear = isCatCrossTab;

  return (
    <>
      {/* Main status bar */}
      <div className={styles.statusBar}>
        {/* Methodology Pill */}
        {(isCatCrossTab || isCatNumeric) ? (
          <button
            className={`${styles.methodologyPill} ${isCatNumeric ? styles.descriptiveLabel : ''}`}
            onClick={onMethodologyClick}
            title="View statistical methodology"
          >
            {getMethodologyText()}
          </button>
        ) : noCol ? (
          <span className={styles.descriptiveLabel}>
            Frequency distribution
          </span>
        ) : null}

        {/* Significance Legend (only for cat x cat with arrows) */}
        {isCatCrossTab && (
          <SignificanceLegend
            compact
            comparisonMethod={analysisSettings.comparisonMethod}
            correctionType={analysisSettings.correctionType}
            overlapCorrected={overlapCorrected}
            showMethodologyLink={false}
          />
        )}

        <div className={styles.spacer} />

        {/* Chi-square badge */}
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
            <div className={`${styles.chiSquareBadge} ${isSignificantChi ? styles.chiSquareSignificant : styles.chiSquareInsignificant}`}>
              χ² = {chiSq.chiSquare.toFixed(1)}
              {' · '}
              p {chiSq.pValue < 0.001 ? '< .001' : `= ${chiSq.pValue.toFixed(3)}`}
              {' · '}
              {isSignificantChi ? 'Associated' : 'Independent'}
            </div>
          </Tooltip>
        )}

        {/* Settings Gear */}
        {showGear && (
          <button
            className={`${styles.gearButton} ${showSettings ? styles.gearButtonActive : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Statistical settings"
          >
            <Settings size={14} />
          </button>
        )}
      </div>

      {/* Collapsible Settings Tray */}
      <AnimatePresence>
        {showSettings && showGear && (
          <motion.div
            className={styles.settingsTray}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <AnalysisSettingsPanel variant="inline" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
