/**
 * BatchOperationsBar - Bulk Actions for Selected Datasets
 *
 * Floating action bar that appears when multiple datasets are selected.
 * Provides batch operations like:
 * - Star/unstar all
 * - Add to project
 * - Delete all
 * - Export selected
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Star,
  StarOff,
  Link2,
  Trash2,
  Download,
  FolderPlus,
  CheckSquare,
  Square,
} from 'lucide-react';
import type { StoredDataset, Project } from './WorkspaceView';
import styles from './BatchOperationsBar.module.css';

interface BatchOperationsBarProps {
  selectedDatasets: StoredDataset[];
  allDatasets: StoredDataset[];
  projects: Project[];
  onClearSelection: () => void;
  onSelectAll: () => void;
  onStarAll: () => void;
  onUnstarAll: () => void;
  onDeleteAll: () => void;
  onCreateProject: () => void;
  onAddToProject: (projectId: string) => void;
  onExportSelected: () => void;
}

export const BatchOperationsBar: React.FC<BatchOperationsBarProps> = ({
  selectedDatasets,
  allDatasets,
  projects,
  onClearSelection,
  onSelectAll,
  onStarAll,
  onUnstarAll,
  onDeleteAll,
  onCreateProject,
  onAddToProject,
  onExportSelected,
}) => {
  const count = selectedDatasets.length;
  const allSelected = count === allDatasets.length && allDatasets.length > 0;

  // Check if all selected are starred or unstarred
  const allStarred = useMemo(() =>
    selectedDatasets.every(d => d.starred),
    [selectedDatasets]
  );

  const allUnstarred = useMemo(() =>
    selectedDatasets.every(d => !d.starred),
    [selectedDatasets]
  );

  // Calculate total size
  const totalSize = useMemo(() => {
    const bytes = selectedDatasets.reduce((sum, d) => sum + d.fileSize, 0);
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, [selectedDatasets]);

  // Calculate total rows
  const totalRows = useMemo(() =>
    selectedDatasets.reduce((sum, d) => sum + d.rowCount, 0),
    [selectedDatasets]
  );

  if (count === 0) return null;

  return (
    <motion.div
      className={styles.bar}
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      {/* Selection info */}
      <div className={styles.selectionInfo}>
        <button
          className={styles.selectAllButton}
          onClick={allSelected ? onClearSelection : onSelectAll}
          title={allSelected ? 'Deselect all' : 'Select all'}
        >
          {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
        <div className={styles.selectionText}>
          <span className={styles.count}>{count} selected</span>
          <span className={styles.meta}>
            {totalRows.toLocaleString()} rows · {totalSize}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Actions */}
      <div className={styles.actions}>
        {/* Star/Unstar */}
        {allStarred ? (
          <motion.button
            className={styles.actionButton}
            onClick={onUnstarAll}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Unstar all"
          >
            <StarOff size={16} />
            <span>Unstar</span>
          </motion.button>
        ) : (
          <motion.button
            className={styles.actionButton}
            onClick={onStarAll}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Star all"
          >
            <Star size={16} />
            <span>Star</span>
          </motion.button>
        )}

        {/* Add to Project */}
        <div className={styles.projectDropdown}>
          <motion.button
            className={styles.actionButton}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link2 size={16} />
            <span>Add to Project</span>
          </motion.button>
          <div className={styles.dropdownMenu}>
            <button onClick={onCreateProject}>
              <FolderPlus size={14} />
              New Project...
            </button>
            {projects.length > 0 && <div className={styles.dropdownDivider} />}
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => onAddToProject(project.id)}
                style={{ '--project-color': project.color } as React.CSSProperties}
              >
                <span className={styles.projectDot} />
                {project.name}
              </button>
            ))}
          </div>
        </div>

        {/* Export */}
        <motion.button
          className={styles.actionButton}
          onClick={onExportSelected}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Export metadata"
        >
          <Download size={16} />
          <span>Export</span>
        </motion.button>

        {/* Delete */}
        <motion.button
          className={`${styles.actionButton} ${styles.destructive}`}
          onClick={onDeleteAll}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Delete all selected"
        >
          <Trash2 size={16} />
          <span>Delete</span>
        </motion.button>
      </div>

      {/* Close button */}
      <button
        className={styles.closeButton}
        onClick={onClearSelection}
        title="Clear selection"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};

export default BatchOperationsBar;
