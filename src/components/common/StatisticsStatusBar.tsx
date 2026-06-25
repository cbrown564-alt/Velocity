import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MethodologyDrawer } from './MethodologyPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, DURATIONS } from '../../lib/motion';
import { Settings, X } from 'lucide-react';
import { SignificanceLegend } from './SignificanceLegend';
import { AnalysisSettingsPanel } from './AnalysisSettingsPanel';
import { Tooltip } from './Tooltip';
import type { Variable, TableStats } from '../../types';
import { allowsNumericStats } from '../../types';
import type { ComparisonMethod, CorrectionType } from '../../store/slices/analysisSlice';
import styles from './StatisticsStatusBar.module.css';

const SETTINGS_POPOVER_WIDTH = 360;
const SETTINGS_POPOVER_MAX_HEIGHT = 320;
const SETTINGS_GAP = 8;
const SETTINGS_VIEWPORT_MARGIN = 8;

interface SettingsPopoverCoords {
  top: number;
  left: number;
  placement: 'below' | 'above';
}

function computeSettingsPopoverCoords(anchor: HTMLElement): SettingsPopoverCoords {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - SETTINGS_VIEWPORT_MARGIN;
  const spaceAbove = rect.top - SETTINGS_VIEWPORT_MARGIN;
  const placement =
    spaceBelow < SETTINGS_POPOVER_MAX_HEIGHT * 0.6 && spaceAbove > spaceBelow ? 'above' : 'below';

  let left = rect.left;
  if (left + SETTINGS_POPOVER_WIDTH > window.innerWidth - SETTINGS_VIEWPORT_MARGIN) {
    left = window.innerWidth - SETTINGS_POPOVER_WIDTH - SETTINGS_VIEWPORT_MARGIN;
  }
  if (left < SETTINGS_VIEWPORT_MARGIN) left = SETTINGS_VIEWPORT_MARGIN;

  const top = placement === 'below' ? rect.bottom + SETTINGS_GAP : rect.top - SETTINGS_GAP;
  return { top, left, placement };
}

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
}) => {
  const reducedMotion = useReducedMotion();
  const [showSettings, setShowSettings] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const methodologyPillRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const [settingsCoords, setSettingsCoords] = useState<SettingsPopoverCoords | null>(null);

  // Determine table type based on column variable's measurement level, not on
  // whether any cells happen to be significant (which gives false negatives when
  // no cells cross the threshold).
  const isCatNumeric = colVariable !== null && allowsNumericStats(colVariable.type, colVariable.orderedScoring);
  const isCatCrossTab = colVariable !== null && !isCatNumeric;
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

  const updateSettingsPosition = useCallback(() => {
    const anchor = settingsButtonRef.current;
    if (!anchor) return;
    setSettingsCoords(computeSettingsPopoverCoords(anchor));
  }, []);

  useLayoutEffect(() => {
    if (!showSettings || !showGear) {
      setSettingsCoords(null);
      return;
    }
    updateSettingsPosition();
    window.addEventListener('resize', updateSettingsPosition);
    window.addEventListener('scroll', updateSettingsPosition, true);
    return () => {
      window.removeEventListener('resize', updateSettingsPosition);
      window.removeEventListener('scroll', updateSettingsPosition, true);
    };
  }, [showSettings, showGear, updateSettingsPosition]);

  useEffect(() => {
    if (!showSettings) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowSettings(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showSettings]);

  return (
    <>
      <div className={`${styles.statusBar} statistics-status-bar`}>
        <div className={styles.statusRow}>
          {(isCatCrossTab || isCatNumeric) ? (
            <div className={styles.methodologyGroup}>
              {showGear && (
                <button
                  ref={settingsButtonRef}
                  className={`${styles.gearButton} ${showSettings ? styles.gearButtonActive : ''}`}
                  onClick={() => setShowSettings(!showSettings)}
                  title="Statistical settings"
                  aria-label="Statistical settings"
                  aria-expanded={showSettings}
                >
                  <Settings size={14} />
                </button>
              )}
              <button
                ref={methodologyPillRef}
                type="button"
                className={`${styles.methodologyPill} ${isCatNumeric ? styles.descriptiveLabel : ''}`}
                onClick={() => setShowMethodology((open) => !open)}
                aria-expanded={showMethodology}
                title="View statistical methodology"
              >
                {getMethodologyText()}
              </button>
            </div>
          ) : noCol ? (
            <span className={styles.descriptiveLabel}>
              Frequency distribution
            </span>
          ) : null}

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
        </div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showSettings && showGear && settingsCoords && (
              <>
                <motion.button
                  type="button"
                  aria-label="Close statistical settings"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? DURATIONS.instant : DURATIONS.fast }}
                  onClick={() => setShowSettings(false)}
                  className="fixed inset-0 z-40 bg-transparent cursor-default"
                />
                <motion.div
                  role="dialog"
                  aria-label="Statistical settings"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reducedMotion ? DURATIONS.instant : DURATIONS.fast }}
                  className={styles.settingsPopover}
                  style={{
                    top: settingsCoords.top,
                    left: settingsCoords.left,
                    transform: settingsCoords.placement === 'above' ? 'translateY(-100%)' : undefined,
                  }}
                >
                  <div className={styles.settingsPopoverHeader}>
                    <span>Statistical settings</span>
                    <button
                      type="button"
                      onClick={() => setShowSettings(false)}
                      className={styles.settingsCloseButton}
                      aria-label="Close statistical settings"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <AnalysisSettingsPanel variant="inline" className={styles.settingsPanelInline} />
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}

      <MethodologyDrawer
        isOpen={showMethodology}
        onClose={() => setShowMethodology(false)}
        anchorRef={methodologyPillRef}
      />
    </>
  );
};
