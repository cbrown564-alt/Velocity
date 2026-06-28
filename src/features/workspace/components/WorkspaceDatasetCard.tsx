import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion, getMotionProps, getModalPresenceProps, DURATIONS } from '../../../lib/motion';
import { Clock, Star, StarOff, MoreHorizontal, Database, ArrowUpRight, Check, Sparkles } from 'lucide-react';
import type { StoredDataset, Project } from '../types';
import { formatDeckSummaryTooltip } from '../lib/returningResearcher';
import { formatFileSize, formatRelativeTime } from '../lib/workspaceFormatters';
import { DatasetPortrait } from './DatasetPortrait';
import { ProjectBadge, WaveBadge } from './WorkspaceBadges';
import styles from './WorkspaceDatasetCard.module.css';

export const WorkspaceDatasetCard: React.FC<{
  dataset: StoredDataset;
  project?: Project;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({ dataset, project, isSelected, onSelect, onOpen, onToggleStar, onContextMenu }) => {
  const reducedMotion = useReducedMotion();
  const hasSession = Boolean(dataset.sessionState);
  const isRecentlyOpened = Date.now() - dataset.lastOpenedAt < 24 * 60 * 60 * 1000;
  const deckSummary = formatDeckSummaryTooltip(dataset);

  return (
    <motion.div
      className={`${styles.datasetCard} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      title={deckSummary ?? undefined}
      {...getModalPresenceProps(reducedMotion)}
      whileHover={{ y: -2 }}
      layout
    >
      <div className={styles.selectionRing}>
        {isSelected && (
          <motion.div
            className={styles.checkmark}
            {...getMotionProps({ preset: 'scale', duration: DURATIONS.fast, reducedMotion })}
          >
            <Check size={12} />
          </motion.div>
        )}
      </div>

      {isRecentlyOpened && <span className={styles.activityDot} title="Opened recently" />}

      <button
        className={`${styles.starButton} ${dataset.starred ? styles.starred : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar();
        }}
      >
        {dataset.starred ? <Star size={14} /> : <StarOff size={14} />}
      </button>

      <div className={styles.cardContent}>
        <div className={styles.fileIcon}>
          <Database size={20} />
          <span className={styles.fileType}>.{dataset.source}</span>
        </div>

        <h3 className={styles.fileName}>{dataset.name}</h3>

        <div className={styles.metaRow}>
          <span>{dataset.rowCount.toLocaleString()} rows</span>
          <span className={styles.metaDot}>·</span>
          <span>{dataset.columnCount} cols</span>
          <span className={styles.metaDot}>·</span>
          <span>{formatFileSize(dataset.fileSize)}</span>
        </div>

        <DatasetPortrait dataset={dataset} />

        <div className={styles.badges}>
          {project && <ProjectBadge project={project} compact />}
          {dataset.waveNumber && <WaveBadge waveNumber={dataset.waveNumber} />}
        </div>

        <div className={styles.lastOpened}>
          <Clock size={12} />
          <span>{formatRelativeTime(dataset.lastOpenedAt)}</span>
          {hasSession && (
            <span className={styles.sessionIndicator}>
              <Sparkles size={10} />
              Session saved
            </span>
          )}
        </div>
      </div>

      <div className={styles.cardActions}>
        <button
          className={styles.actionButton}
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          <ArrowUpRight size={14} />
          Open
        </button>
        <button
          className={styles.iconButton}
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e);
          }}
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
    </motion.div>
  );
};
