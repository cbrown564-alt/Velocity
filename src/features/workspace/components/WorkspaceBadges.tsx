import React from 'react';
import { Link2, Layers } from 'lucide-react';
import type { Project } from '../types';
import styles from './WorkspaceBadges.module.css';

export const ProjectBadge: React.FC<{
  project: Project;
  compact?: boolean;
}> = ({ project, compact }) => (
  <div
    className={`${styles.projectBadge} ${compact ? styles.compact : ''}`}
    style={{ '--project-color': project.color } as React.CSSProperties}
  >
    {project.isLongitudinal && <Link2 size={10} />}
    <span>{project.name}</span>
  </div>
);

export const WaveBadge: React.FC<{ waveNumber: number }> = ({ waveNumber }) => (
  <div className={styles.waveBadge}>
    <Layers size={10} />
    <span>Wave {waveNumber}</span>
  </div>
);
