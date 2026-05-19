/**
 * DatasetSidebar - Quick Dataset Switcher
 *
 * A collapsible sidebar that shows available datasets while working,
 * allowing quick switching without returning to the workspace view.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, DURATIONS } from '../../../lib/motion';
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Star,
  Link2,
  Layers,
  Plus,
  Home,
  Sparkles,
} from 'lucide-react';
import type { StoredDataset, Project } from './WorkspaceView';
import styles from './DatasetSidebar.module.css';

interface DatasetSidebarProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  datasets: StoredDataset[];
  projects: Project[];
  activeDatasetId: string | null;
  onSelectDataset: (dataset: StoredDataset) => void;
  onOpenWorkspace: () => void;
  onUpload: () => void;
}

const formatRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const DatasetSidebar: React.FC<DatasetSidebarProps> = ({
  isExpanded,
  onToggleExpand,
  datasets,
  projects,
  activeDatasetId,
  onSelectDataset,
  onOpenWorkspace,
  onUpload,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Build project lookup
  const projectMap = new Map(projects.map(p => [p.id, p]));

  // Sort datasets: active first, then starred, then by last opened
  const sortedDatasets = [...datasets].sort((a, b) => {
    if (a.id === activeDatasetId) return -1;
    if (b.id === activeDatasetId) return 1;
    if (a.starred && !b.starred) return -1;
    if (!a.starred && b.starred) return 1;
    return b.lastOpenedAt - a.lastOpenedAt;
  });

  // Limit to recent datasets in collapsed mode
  const displayedDatasets = isExpanded ? sortedDatasets : sortedDatasets.slice(0, 6);

  const reducedMotion = useReducedMotion();

  return (
    <motion.aside
      className={`${styles.sidebar} ${isExpanded ? styles.expanded : styles.collapsed}`}
      animate={{ width: isExpanded ? 280 : 56 }}
      transition={{ duration: reducedMotion ? 0.01 : DURATIONS.normal, ease: 'easeInOut' }}
    >
      {/* Toggle button */}
      <button className={styles.toggleButton} onClick={onToggleExpand}>
        {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Header */}
      <div className={styles.header}>
        <AnimatePresence mode="wait">
          {isExpanded ? (
            <motion.span
              key="title"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0.01 : DURATIONS.fast }}
              className={styles.title}
            >
              Datasets
            </motion.span>
          ) : (
            <motion.span
              key="icon"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0.01 : DURATIONS.fast }}
            >
              <Database size={18} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Dataset list */}
      <div className={styles.datasetList}>
        {displayedDatasets.map((dataset) => {
          const project = dataset.projectId ? projectMap.get(dataset.projectId) : undefined;
          const isActive = dataset.id === activeDatasetId;
          const isHovered = dataset.id === hoveredId;
          const hasSession = Boolean(dataset.sessionState);

          return (
            <motion.button
              key={dataset.id}
              className={`${styles.datasetItem} ${isActive ? styles.active : ''}`}
              onClick={() => onSelectDataset(dataset)}
              onMouseEnter={() => setHoveredId(dataset.id)}
              onMouseLeave={() => setHoveredId(null)}
              whileHover={{ x: 2 }}
              layout
            >
              {/* Icon or avatar */}
              <div
                className={styles.datasetIcon}
                style={project ? { '--project-color': project.color } as React.CSSProperties : undefined}
              >
                {isActive ? (
                  <div className={styles.activeDot} />
                ) : project ? (
                  <div className={styles.projectDot} />
                ) : (
                  <Database size={14} />
                )}
              </div>

              {/* Content (only in expanded mode) */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    className={styles.datasetContent}
                    initial={{ opacity: 0, width: reducedMotion ? 'auto' : 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: reducedMotion ? 'auto' : 0 }}
                    transition={{ duration: reducedMotion ? 0.01 : DURATIONS.fast }}
                  >
                    <div className={styles.datasetName}>
                      <span>{dataset.name}</span>
                      {dataset.starred && <Star size={10} className={styles.starIcon} />}
                      {hasSession && <Sparkles size={10} className={styles.sessionIcon} />}
                    </div>
                    <div className={styles.datasetMeta}>
                      {dataset.waveNumber && (
                        <span className={styles.waveBadge}>
                          <Layers size={9} />
                          W{dataset.waveNumber}
                        </span>
                      )}
                      <span>{dataset.rowCount.toLocaleString()}</span>
                      <span className={styles.dot}>·</span>
                      <span>{formatRelativeTime(dataset.lastOpenedAt)}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tooltip for collapsed mode */}
              {!isExpanded && isHovered && (
                <motion.div
                  className={styles.tooltip}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  <span className={styles.tooltipName}>{dataset.name}</span>
                  <span className={styles.tooltipMeta}>
                    {dataset.rowCount.toLocaleString()} rows
                  </span>
                </motion.div>
              )}
            </motion.button>
          );
        })}

        {/* Show more indicator */}
        {!isExpanded && datasets.length > 6 && (
          <div className={styles.moreIndicator}>
            <span>+{datasets.length - 6}</span>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className={styles.footer}>
        <button
          className={styles.footerButton}
          onClick={onUpload}
          title="Upload new dataset"
        >
          <Plus size={16} />
          {isExpanded && <span>Upload</span>}
        </button>
        <button
          className={styles.footerButton}
          onClick={onOpenWorkspace}
          title="Open workspace"
        >
          <Home size={16} />
          {isExpanded && <span>Workspace</span>}
        </button>
      </div>
    </motion.aside>
  );
};

export default DatasetSidebar;
