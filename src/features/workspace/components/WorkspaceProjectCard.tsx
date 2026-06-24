import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Link2, TrendingUp } from 'lucide-react';
import type { StoredDataset, Project } from '../types';
import { formatRelativeTime } from '../lib/workspaceFormatters';
import { WaveTimeline } from './WaveTimeline';
import styles from './WorkspaceProjectCard.module.css';

export const WorkspaceProjectCard: React.FC<{
  project: Project;
  datasets: StoredDataset[];
  harmonizationStatus: 'complete' | 'partial' | 'none';
  onOpenProject: () => void;
  onOpenDataset?: (dataset: StoredDataset) => void;
  onCompareWaves?: (wave1: StoredDataset, wave2: StoredDataset) => void;
}> = ({ project, datasets, harmonizationStatus, onOpenProject, onOpenDataset, onCompareWaves }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <motion.div
      className={`${styles.projectCard} ${showDetails ? styles.expanded : ''}`}
      style={{ '--project-color': project.color } as React.CSSProperties}
      layout
      data-testid="project-card"
    >
      {project.isLongitudinal && harmonizationStatus !== 'none' && (
        <span
          className={`${styles.harmonyRing} ${styles[`harmony_${harmonizationStatus}`]}`}
          title={
            harmonizationStatus === 'complete'
              ? 'Variables aligned across waves'
              : 'Partial variable overlap — harmonization recommended'
          }
          data-testid="harmonization-ring"
        />
      )}
      <div className={styles.projectHeader} onClick={onOpenProject}>
        <div className={styles.projectIcon}>
          {project.isLongitudinal ? <Link2 size={18} /> : <FolderOpen size={18} />}
        </div>
        <div className={styles.projectInfo}>
          <h3>{project.name}</h3>
          <p>{project.description || `${datasets.length} datasets`}</p>
        </div>
        {project.isLongitudinal && datasets.length > 1 && (
          <motion.button
            className={styles.expandButton}
            onClick={(e) => {
              e.stopPropagation();
              setShowDetails(!showDetails);
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Show wave details"
          >
            <TrendingUp size={14} />
          </motion.button>
        )}
      </div>

      {project.isLongitudinal && (
        <div className={styles.waveTimelineWrapper}>
          <WaveTimeline
            project={project}
            datasets={datasets}
            detailed={showDetails}
            onWaveClick={onOpenDataset}
            onCompareWaves={onCompareWaves}
          />
        </div>
      )}

      <div className={styles.projectMeta}>
        <span>{datasets.reduce((sum, d) => sum + d.rowCount, 0).toLocaleString()} total rows</span>
        <span>{formatRelativeTime(Math.max(...datasets.map(d => d.lastOpenedAt), 0))}</span>
      </div>
    </motion.div>
  );
};
