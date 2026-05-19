/**
 * WaveTimeline - Enhanced Wave Visualization for Longitudinal Studies
 *
 * Displays a rich timeline of survey waves with:
 * - Visual connections between waves
 * - Respondent count tracking
 * - Attrition indicators
 * - Date information
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion, DURATIONS } from '../../../lib/motion';
import {
  Layers,
  Users,
  TrendingDown,
  TrendingUp,
  Calendar,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Database,
} from 'lucide-react';
import type { StoredDataset, Project } from './WorkspaceView';
import styles from './WaveTimeline.module.css';

interface WaveTimelineProps {
  project: Project;
  datasets: StoredDataset[];
  /** Show detailed view with attrition stats */
  detailed?: boolean;
  /** Callback when a wave is clicked */
  onWaveClick?: (dataset: StoredDataset) => void;
  /** Callback for cross-wave comparison */
  onCompareWaves?: (wave1: StoredDataset, wave2: StoredDataset) => void;
}

interface WaveStats {
  dataset: StoredDataset;
  waveNumber: number;
  respondentCount: number;
  attritionRate?: number; // Percentage lost from previous wave
  retentionRate?: number; // Percentage retained from Wave 1
  date: Date;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export const WaveTimeline: React.FC<WaveTimelineProps> = ({
  project,
  datasets,
  detailed = false,
  onWaveClick,
  onCompareWaves,
}) => {
  const reducedMotion = useReducedMotion();

  // Calculate wave statistics
  const waveStats = useMemo((): WaveStats[] => {
    const waveDatasetsRaw = datasets
      .filter(d => d.waveNumber !== undefined)
      .sort((a, b) => (a.waveNumber || 0) - (b.waveNumber || 0));

    if (waveDatasetsRaw.length === 0) return [];

    const baseCount = waveDatasetsRaw[0].rowCount;

    return waveDatasetsRaw.map((dataset, index) => {
      const prevDataset = index > 0 ? waveDatasetsRaw[index - 1] : null;
      const attritionRate = prevDataset
        ? Math.round(((prevDataset.rowCount - dataset.rowCount) / prevDataset.rowCount) * 100)
        : undefined;
      const retentionRate = Math.round((dataset.rowCount / baseCount) * 100);

      return {
        dataset,
        waveNumber: dataset.waveNumber || index + 1,
        respondentCount: dataset.rowCount,
        attritionRate: attritionRate !== undefined && attritionRate > 0 ? attritionRate : undefined,
        retentionRate,
        date: new Date(dataset.createdAt),
      };
    });
  }, [datasets]);

  // Calculate overall study health
  const studyHealth = useMemo(() => {
    if (waveStats.length < 2) return null;

    const lastWave = waveStats[waveStats.length - 1];
    const avgAttrition = waveStats
      .slice(1)
      .reduce((sum, w) => sum + (w.attritionRate || 0), 0) / (waveStats.length - 1);

    return {
      totalWaves: waveStats.length,
      overallRetention: lastWave.retentionRate,
      avgAttritionPerWave: Math.round(avgAttrition),
      status: lastWave.retentionRate >= 70 ? 'healthy' : lastWave.retentionRate >= 50 ? 'warning' : 'critical',
    };
  }, [waveStats]);

  if (waveStats.length === 0) {
    return (
      <div className={styles.emptyTimeline}>
        <Layers size={20} />
        <span>No waves configured yet</span>
      </div>
    );
  }

  // Compact view for project cards
  if (!detailed) {
    return (
      <div className={styles.compactTimeline}>
        <div className={styles.compactWaves}>
          {waveStats.map((wave, index) => (
            <React.Fragment key={wave.dataset.id}>
              <motion.button
                className={styles.compactWaveNode}
                onClick={() => onWaveClick?.(wave.dataset)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                style={{ '--project-color': project.color } as React.CSSProperties}
              >
                <span className={styles.compactWaveNumber}>W{wave.waveNumber}</span>
                {wave.attritionRate && wave.attritionRate > 10 && (
                  <span className={styles.compactAttrition}>
                    <TrendingDown size={8} />
                  </span>
                )}
              </motion.button>
              {index < waveStats.length - 1 && (
                <div className={styles.compactConnector}>
                  <ArrowRight size={12} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
        {studyHealth && (
          <div className={`${styles.compactHealth} ${styles[studyHealth.status]}`}>
            {studyHealth.overallRetention}% retained
          </div>
        )}
      </div>
    );
  }

  // Detailed view
  return (
    <div className={styles.timeline}>
      {/* Study health summary */}
      {studyHealth && (
        <div className={`${styles.healthSummary} ${styles[studyHealth.status]}`}>
          <div className={styles.healthIcon}>
            {studyHealth.status === 'healthy' ? (
              <CheckCircle2 size={18} />
            ) : studyHealth.status === 'warning' ? (
              <AlertTriangle size={18} />
            ) : (
              <TrendingDown size={18} />
            )}
          </div>
          <div className={styles.healthText}>
            <span className={styles.healthTitle}>Panel Health</span>
            <span className={styles.healthStats}>
              {studyHealth.overallRetention}% overall retention · {studyHealth.avgAttritionPerWave}% avg attrition/wave
            </span>
          </div>
        </div>
      )}

      {/* Timeline visualization */}
      <div className={styles.timelineTrack}>
        {waveStats.map((wave, index) => (
          <React.Fragment key={wave.dataset.id}>
            <motion.div
              className={styles.waveNode}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : index * 0.1, duration: reducedMotion ? 0.01 : DURATIONS.normal }}
              style={{ '--project-color': project.color } as React.CSSProperties}
            >
              {/* Wave header */}
              <div className={styles.waveHeader}>
                <div className={styles.waveNumber}>
                  <Layers size={14} />
                  Wave {wave.waveNumber}
                </div>
                <div className={styles.waveDate}>
                  <Calendar size={12} />
                  {formatDate(wave.dataset.createdAt)}
                </div>
              </div>

              {/* Wave content */}
              <motion.button
                className={styles.waveCard}
                onClick={() => onWaveClick?.(wave.dataset)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className={styles.waveDataset}>
                  <Database size={14} />
                  <span>{wave.dataset.name}</span>
                </div>
                <div className={styles.waveRespondents}>
                  <Users size={14} />
                  <span>{wave.respondentCount.toLocaleString()} respondents</span>
                </div>

                {/* Retention indicator */}
                <div className={styles.waveRetention}>
                  <div
                    className={styles.retentionBar}
                    style={{ '--retention': `${wave.retentionRate}%` } as React.CSSProperties}
                  >
                    <motion.div
                      className={styles.retentionFill}
                      initial={{ width: 0 }}
                      animate={{ width: `${wave.retentionRate}%` }}
                      transition={{ duration: reducedMotion ? 0.01 : 0.6, delay: reducedMotion ? 0 : index * 0.1 }}
                    />
                  </div>
                  <span className={styles.retentionLabel}>{wave.retentionRate}%</span>
                </div>
              </motion.button>

              {/* Attrition indicator between waves */}
              {wave.attritionRate !== undefined && wave.attritionRate > 0 && (
                <div className={styles.attritionBadge}>
                  <TrendingDown size={10} />
                  <span>-{wave.attritionRate}%</span>
                </div>
              )}
            </motion.div>

            {/* Connector to next wave */}
            {index < waveStats.length - 1 && (
              <div className={styles.connector}>
                <div className={styles.connectorLine} />
                {onCompareWaves && (
                  <motion.button
                    className={styles.compareButton}
                    onClick={() => onCompareWaves(wave.dataset, waveStats[index + 1].dataset)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    title={`Compare Wave ${wave.waveNumber} to Wave ${waveStats[index + 1].waveNumber}`}
                  >
                    <TrendingUp size={12} />
                  </motion.button>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Respondent key info */}
      {project.respondentKeyVariable && (
        <div className={styles.keyInfo}>
          <span className={styles.keyLabel}>Respondent Key:</span>
          <code className={styles.keyVariable}>{project.respondentKeyVariable}</code>
        </div>
      )}
    </div>
  );
};

export default WaveTimeline;
