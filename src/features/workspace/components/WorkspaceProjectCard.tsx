import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Link2, TrendingUp } from 'lucide-react';
import type { StoredDataset, Project } from '../types';
import { formatRelativeTime } from '../lib/workspaceFormatters';
import { pluralize } from '../../../lib/pluralize';
import { WaveTimeline } from './WaveTimeline';
import styles from './WorkspaceProjectCard.module.css';

export const WorkspaceProjectCard: React.FC<{
  project: Project;
  datasets: StoredDataset[];
  onOpenProject: () => void;
  onOpenDataset?: (dataset: StoredDataset) => void;
  onCompareWaves?: (wave1: StoredDataset, wave2: StoredDataset) => void;
}> = ({ project, datasets, onOpenProject, onOpenDataset, onCompareWaves }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <motion.div
      className={`${styles.projectCard} ${showDetails ? styles.expanded : ''}`}
      style={{ '--project-color': project.color } as React.CSSProperties}
      layout
      data-testid="project-card"
    >
      {' '}
      <div
        className={styles.projectHeader}
        onClick={onOpenProject}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenProject();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open project ${project.name}`}
      >
        <div className={styles.projectIcon}>
          {project.isLongitudinal ? <Link2 size={18} /> : <FolderOpen size={18} />}
        </div>
        <div className={styles.projectInfo}>
          <h3>{project.name}</h3>
          <p>{project.description || pluralize(datasets.length, 'dataset')}</p>
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
        <span>{formatRelativeTime(Math.max(...datasets.map((d) => d.lastOpenedAt), 0))}</span>
      </div>
    </motion.div>
  );
};
