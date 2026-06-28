import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion, getMotionProps, DURATIONS } from '../../../lib/motion';
import { Star, StarOff, Database, ChevronRight, Sparkles } from 'lucide-react';
import type { StoredDataset, Project } from '../types';
import { formatDeckSummaryTooltip } from '../lib/returningResearcher';
import { formatRelativeTime } from '../lib/workspaceFormatters';
import { ProjectBadge, WaveBadge } from './WorkspaceBadges';
import styles from './WorkspaceDatasetListItem.module.css';

export const WorkspaceDatasetListItem: React.FC<{
  dataset: StoredDataset;
  project?: Project;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onToggleStar: () => void;
}> = ({ dataset, project, isSelected, onSelect, onOpen, onToggleStar }) => {
  const reducedMotion = useReducedMotion();
  const hasSession = Boolean(dataset.sessionState);
  const deckSummary = formatDeckSummaryTooltip(dataset);

  return (
    <motion.div
      className={`${styles.datasetListItem} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      title={deckSummary ?? undefined}
      role="button"
      tabIndex={0}
      aria-label={`Open dataset ${dataset.name}`}
      {...getMotionProps({
        preset: 'slideRight',
        duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
        reducedMotion,
      })}
      whileHover={{ x: 2 }}
    >
      <button
        className={`${styles.starButton} ${dataset.starred ? styles.starred : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
      >
        {dataset.starred ? <Star size={14} /> : <StarOff size={14} />}
      </button>

      <div className={styles.listFileIcon}>
        <Database size={16} />
      </div>

      <div className={styles.listContent}>
        <span className={styles.listFileName}>{dataset.name}</span>
        <span className={styles.listMeta}>
          {dataset.rowCount.toLocaleString()} × {dataset.columnCount}
        </span>
      </div>

      {project && <ProjectBadge project={project} compact />}
      {dataset.waveNumber && <WaveBadge waveNumber={dataset.waveNumber} />}
      {hasSession && (
        <span className={styles.sessionDot} title="Session saved">
          <Sparkles size={10} />
        </span>
      )}

      <span className={styles.listTime}>{formatRelativeTime(dataset.lastOpenedAt)}</span>

      <ChevronRight size={14} className={styles.listArrow} />
    </motion.div>
  );
};
