/**
 * DatasetPortrait — color signature, activity heatmap, session thumbnail.
 */

import React, { useMemo } from 'react';
import { LayoutGrid, BarChart3 } from 'lucide-react';
import type { StoredDataset } from '../types';
import {
  buildActivityHeatmap,
  computeColorSignature,
  summarizeSessionPortrait,
} from '../lib/workspaceLibrary';
import styles from './DatasetPortrait.module.css';

interface DatasetPortraitProps {
  dataset: StoredDataset;
}

export const DatasetPortrait: React.FC<DatasetPortraitProps> = ({ dataset }) => {
  const signature = useMemo(
    () => computeColorSignature(dataset.variables),
    [dataset.variables]
  );
  const heatmap = useMemo(
    () => buildActivityHeatmap(dataset.lastOpenedAt, dataset.lastModifiedAt, dataset.createdAt),
    [dataset.lastOpenedAt, dataset.lastModifiedAt, dataset.createdAt]
  );
  const session = useMemo(() => summarizeSessionPortrait(dataset), [dataset]);

  const rowVars = dataset.sessionState?.tableConfig?.rowVars ?? [];
  const colVar = dataset.sessionState?.tableConfig?.colVar;

  return (
    <div className={styles.portrait} data-testid="dataset-portrait">
      <div
        className={styles.colorSignature}
        style={
          {
            '--portrait-hue': signature.hue,
            '--portrait-warmth': signature.warmth,
          } as React.CSSProperties
        }
        title={`Data profile: ${signature.label}`}
        aria-hidden
      />

      <div className={styles.portraitBody}>
        <div className={styles.activityHeatmap} aria-label="Recent activity">
          {heatmap.map((day, dayIndex) => (
            <div key={dayIndex} className={styles.heatmapDay}>
              {day.map((cell, slotIndex) => (
                <span
                  key={slotIndex}
                  className={styles.heatmapCell}
                  style={{ opacity: 0.12 + cell.intensity * 0.88 }}
                />
              ))}
            </div>
          ))}
        </div>

        <div className={styles.slideThumbnail} data-testid="dataset-slide-thumbnail">
          {session.hasAnalysis && colVar ? (
            <div className={styles.miniCrosstab}>
              {rowVars.slice(0, 3).map((_, ri) => (
                <div key={ri} className={styles.crosstabRow}>
                  {Array.from({ length: 3 }).map((_, ci) => (
                    <span
                      key={ci}
                      className={styles.crosstabCell}
                      style={{
                        opacity: 0.35 + ((ri + ci) % 3) * 0.2,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : session.hasAnalysis ? (
            <div className={styles.miniBars}>
              {rowVars.slice(0, 4).map((_, i) => (
                <span
                  key={i}
                  className={styles.miniBar}
                  style={{ height: `${40 + (i % 3) * 18}%` }}
                />
              ))}
            </div>
          ) : (
            <div className={styles.shelfSilhouette}>
              <LayoutGrid size={14} />
            </div>
          )}
        </div>
      </div>

      {session.hasAnalysis && (
        <div className={styles.sessionBadge} data-testid="dataset-session-badge">
          <BarChart3 size={10} />
          <span>
            {session.slideCount} slide{session.slideCount === 1 ? '' : 's'}, edited{' '}
            {session.editedAgo}
          </span>
        </div>
      )}
    </div>
  );
};

export default DatasetPortrait;
