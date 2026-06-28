/**
 * CrossWavePanel - Cross-Wave Analysis Tools
 *
 * Modal/panel for comparing data across survey waves in longitudinal studies.
 * Provides:
 * - Wave-over-wave comparison
 * - Panel attrition analysis
 * - Trend visualization placeholder
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getBackdropProps, getMotionProps, DURATIONS } from '../../../lib/motion';
import {
  X,
  TrendingUp,
  TrendingDown,
  Users,
  UserMinus,
  UserPlus,
  BarChart3,
  ArrowLeftRight,
  Layers,
  ChevronDown,
  Database,
} from 'lucide-react';
import type { StoredDataset, Project } from '../types';
import styles from './CrossWavePanel.module.css';

interface CrossWavePanelProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  datasets: StoredDataset[];
  /** Pre-selected waves for comparison */
  selectedWaves?: [StoredDataset, StoredDataset];
  /** Callback to open a specific dataset */
  onOpenDataset?: (dataset: StoredDataset) => void;
  /** Callback to open Harmonization Workspace for two waves */
  onOpenHarmonization?: (wave1: StoredDataset, wave2: StoredDataset) => void;
}

interface WaveComparison {
  wave1: StoredDataset;
  wave2: StoredDataset;
  respondentDiff: number;
  respondentDiffPercent: number;
  variableDiff: number;
  direction: 'increase' | 'decrease' | 'stable';
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatPercent(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

export const CrossWavePanel: React.FC<CrossWavePanelProps> = ({
  isOpen,
  onClose,
  project,
  datasets,
  selectedWaves,
  onOpenDataset,
  onOpenHarmonization,
}) => {
  const [wave1Id, setWave1Id] = useState<string | null>(selectedWaves?.[0]?.id || null);
  const [wave2Id, setWave2Id] = useState<string | null>(selectedWaves?.[1]?.id || null);

  // Get sorted wave datasets
  const waveDatasets = useMemo(() => {
    return datasets.filter((d) => d.waveNumber !== undefined).sort((a, b) => (a.waveNumber || 0) - (b.waveNumber || 0));
  }, [datasets]);

  // Calculate comparison stats
  const comparison = useMemo((): WaveComparison | null => {
    const w1 = waveDatasets.find((d) => d.id === wave1Id);
    const w2 = waveDatasets.find((d) => d.id === wave2Id);

    if (!w1 || !w2) return null;

    const respondentDiff = w2.rowCount - w1.rowCount;
    const respondentDiffPercent = (respondentDiff / w1.rowCount) * 100;
    const variableDiff = w2.columnCount - w1.columnCount;

    return {
      wave1: w1,
      wave2: w2,
      respondentDiff,
      respondentDiffPercent,
      variableDiff,
      direction: Math.abs(respondentDiffPercent) < 1 ? 'stable' : respondentDiff > 0 ? 'increase' : 'decrease',
    };
  }, [waveDatasets, wave1Id, wave2Id]);

  // Calculate overall attrition funnel
  const attritionFunnel = useMemo(() => {
    if (waveDatasets.length < 2) return null;

    const baseCount = waveDatasets[0].rowCount;
    return waveDatasets.map((d, i) => ({
      wave: d.waveNumber || i + 1,
      count: d.rowCount,
      retention: (d.rowCount / baseCount) * 100,
      attrition: i > 0 ? ((waveDatasets[i - 1].rowCount - d.rowCount) / waveDatasets[i - 1].rowCount) * 100 : 0,
    }));
  }, [waveDatasets]);

  const reducedMotion = useReducedMotion();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div className={styles.overlay} {...getBackdropProps(reducedMotion)} onClick={onClose}>
        <motion.div
          className={styles.panel}
          {...getMotionProps({
            preset: 'slideLeft',
            duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
            reducedMotion,
          })}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerIcon} style={{ '--project-color': project.color } as React.CSSProperties}>
              <TrendingUp size={20} />
            </div>
            <div className={styles.headerText}>
              <h2>Cross-Wave Analysis</h2>
              <p>
                {project.name} · {waveDatasets.length} waves
              </p>
            </div>
            <button className={styles.closeButton} onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Wave selector */}
          <div className={styles.waveSelector}>
            <div className={styles.wavePicker}>
              <label>Compare</label>
              <div className={styles.selectWrapper}>
                <select value={wave1Id || ''} onChange={(e) => setWave1Id(e.target.value || null)}>
                  <option value="">Select wave...</option>
                  {waveDatasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      Wave {d.waveNumber} - {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>

            <ArrowLeftRight size={16} className={styles.compareArrow} />

            <div className={styles.wavePicker}>
              <label>To</label>
              <div className={styles.selectWrapper}>
                <select value={wave2Id || ''} onChange={(e) => setWave2Id(e.target.value || null)}>
                  <option value="">Select wave...</option>
                  {waveDatasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      Wave {d.waveNumber} - {d.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
          </div>

          {/* Comparison results */}
          {comparison && (
            <div className={styles.comparisonResults}>
              {/* Summary cards */}
              <div className={styles.summaryCards}>
                <div className={`${styles.summaryCard} ${styles[comparison.direction]}`}>
                  <div className={styles.summaryIcon}>
                    {comparison.direction === 'increase' ? (
                      <UserPlus size={20} />
                    ) : comparison.direction === 'decrease' ? (
                      <UserMinus size={20} />
                    ) : (
                      <Users size={20} />
                    )}
                  </div>
                  <div className={styles.summaryContent}>
                    <span className={styles.summaryLabel}>Respondent Change</span>
                    <span className={styles.summaryValue}>
                      {comparison.respondentDiff > 0 ? '+' : ''}
                      {formatNumber(comparison.respondentDiff)}
                    </span>
                    <span className={styles.summaryPercent}>{formatPercent(comparison.respondentDiffPercent)}</span>
                  </div>
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.summaryIcon}>
                    <BarChart3 size={20} />
                  </div>
                  <div className={styles.summaryContent}>
                    <span className={styles.summaryLabel}>Variable Change</span>
                    <span className={styles.summaryValue}>
                      {comparison.variableDiff > 0 ? '+' : ''}
                      {comparison.variableDiff}
                    </span>
                    <span className={styles.summaryPercent}>
                      {comparison.wave1.columnCount} → {comparison.wave2.columnCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Wave detail comparison */}
              <div className={styles.waveDetails}>
                <div className={styles.waveDetailCard}>
                  <div className={styles.waveDetailHeader}>
                    <Layers size={14} />
                    <span>Wave {comparison.wave1.waveNumber}</span>
                    <span className={styles.waveDate}>{formatDate(comparison.wave1.createdAt)}</span>
                  </div>
                  <div className={styles.waveDetailStats}>
                    <div>
                      <Users size={12} />
                      <span>{formatNumber(comparison.wave1.rowCount)} respondents</span>
                    </div>
                    <div>
                      <Database size={12} />
                      <span>{comparison.wave1.columnCount} variables</span>
                    </div>
                  </div>
                  {onOpenDataset && (
                    <button className={styles.openButton} onClick={() => onOpenDataset(comparison.wave1)}>
                      Open Dataset
                    </button>
                  )}
                </div>

                <div className={styles.waveDetailCard}>
                  <div className={styles.waveDetailHeader}>
                    <Layers size={14} />
                    <span>Wave {comparison.wave2.waveNumber}</span>
                    <span className={styles.waveDate}>{formatDate(comparison.wave2.createdAt)}</span>
                  </div>
                  <div className={styles.waveDetailStats}>
                    <div>
                      <Users size={12} />
                      <span>{formatNumber(comparison.wave2.rowCount)} respondents</span>
                    </div>
                    <div>
                      <Database size={12} />
                      <span>{comparison.wave2.columnCount} variables</span>
                    </div>
                  </div>
                  {onOpenDataset && (
                    <button className={styles.openButton} onClick={() => onOpenDataset(comparison.wave2)}>
                      Open Dataset
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Attrition funnel */}
          {attritionFunnel && attritionFunnel.length > 1 && (
            <div className={styles.attritionSection}>
              <h3>
                <UserMinus size={16} />
                Panel Attrition Funnel
              </h3>
              <div className={styles.funnelChart}>
                {attritionFunnel.map((wave, i) => (
                  <div key={wave.wave} className={styles.funnelStep}>
                    <div className={styles.funnelBar}>
                      <motion.div
                        className={styles.funnelFill}
                        style={{ '--project-color': project.color } as React.CSSProperties}
                        initial={{ width: 0 }}
                        animate={{ width: `${wave.retention}%` }}
                        transition={{ duration: reducedMotion ? 0.01 : 0.5, delay: reducedMotion ? 0 : i * 0.1 }}
                      />
                      <span className={styles.funnelCount}>{formatNumber(wave.count)}</span>
                    </div>
                    <div className={styles.funnelLabel}>
                      <span>W{wave.wave}</span>
                      <span className={styles.funnelRetention}>{wave.retention.toFixed(0)}%</span>
                    </div>
                    {wave.attrition > 0 && (
                      <div className={styles.funnelAttrition}>
                        <TrendingDown size={10} />-{wave.attrition.toFixed(1)}%
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variable Harmonization */}
          {comparison && (
            <div className={styles.harmonizeSection}>
              <h3>
                <ArrowLeftRight size={16} />
                Variable Harmonization
              </h3>
              <p className={styles.harmonizeDesc}>
                Map variables across waves to track how questions, scales, and coding have drifted over time.
              </p>
              <button
                className={styles.harmonizeButton}
                onClick={() => onOpenHarmonization?.(comparison.wave1, comparison.wave2)}
              >
                <ArrowLeftRight size={14} />
                Open Harmonization Workspace
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CrossWavePanel;
