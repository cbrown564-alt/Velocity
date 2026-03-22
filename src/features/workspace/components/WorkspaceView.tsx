/**
 * WorkspaceView - The Research Library
 *
 * Multi-file workspace and file management hub for Velocity.
 * Replaces the simple splash screen with a proper file browser.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileUp,
  Upload,
  FolderOpen,
  Clock,
  Star,
  StarOff,
  MoreHorizontal,
  Plus,
  Link2,
  Unlink,
  Trash2,
  Database,
  HardDrive,
  ChevronRight,
  Search,
  Grid3X3,
  List,
  Calendar,
  Layers,
  ArrowUpRight,
  Check,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Download,
} from 'lucide-react';
import { Logo } from '../../../components/common/Logo';
import type { Variable } from '../../../types';
import styles from './WorkspaceView.module.css';
import { WaveTimeline } from './WaveTimeline';

// ============================================================================
// Types
// ============================================================================

export interface StoredDataset {
  id: string;
  name: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  fileSize: number; // bytes
  source: 'sav' | 'csv' | 'arrow';
  createdAt: number;
  lastOpenedAt: number;
  lastModifiedAt: number;
  projectId?: string;
  starred: boolean;
  /** Wave number for linked longitudinal studies */
  waveNumber?: number;
  /** Key variable for linking respondents across waves */
  respondentKey?: string;
  /** Thumbnail data for preview (sparkline of first variable) */
  thumbnail?: number[];
  /** Session state to restore */
  sessionState?: {
    tableConfig: { rowVars: string[]; colVar: string | null };
    activeFilters: unknown[];
    transformLog: unknown[];
  };
  /** Optional variable metadata for cross-wave harmonization */
  variables?: Variable[];
  /** OPFS key for restoring this dataset's source file */
  opfsFileKey?: string;
  /** DuckDB table containing this dataset's rows */
  tableName?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt: number;
  datasetIds: string[];
  /** For wave-linked projects */
  isLongitudinal: boolean;
  respondentKeyVariable?: string;
}

export interface WorkspaceState {
  datasets: StoredDataset[];
  projects: Project[];
  storageUsed: number;
  storageQuota: number;
}

interface WorkspaceViewProps {
  workspaceState: WorkspaceState;
  onOpenDataset: (dataset: StoredDataset) => void;
  onUploadFile: () => void;
  onLoadExample: () => void;
  onCreateProject: (selectedDatasetIds: string[]) => void;
  onDeleteDataset: (id: string) => void;
  onToggleStar: (id: string) => void;
  onLinkDatasets: (datasetIds: string[], projectId: string) => void;
  onUnlinkDataset: (datasetId: string) => void;
  /** Callback when user wants to compare waves */
  onCompareWaves?: (project: Project, wave1: StoredDataset, wave2: StoredDataset) => void;
  /** Callback for batch star operation */
  onBatchStar?: (ids: string[], starred: boolean) => void;
  /** Callback for batch delete operation */
  onBatchDelete?: (ids: string[]) => void;
  /** Callback to open export modal */
  onExport?: (selectedIds: string[]) => void;
  /** Callback to open the portable session import flow */
  onImportSession?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getStorageHealthStatus(used: number, quota: number): 'healthy' | 'warning' | 'critical' {
  const ratio = used / quota;
  if (ratio < 0.7) return 'healthy';
  if (ratio < 0.9) return 'warning';
  return 'critical';
}

const PROJECT_COLORS = [
  '#E07860', // Coral
  '#2D4A3E', // Forest
  '#00D4FF', // Cyan
  '#FFB800', // Amber
  '#9B59B6', // Purple
  '#00E5A0', // Mint
  '#E74C3C', // Red
  '#3498DB', // Blue
];

// ============================================================================
// Sub-Components
// ============================================================================

const StorageIndicator: React.FC<{
  used: number;
  quota: number;
}> = ({ used, quota }) => {
  const percentage = Math.min((used / quota) * 100, 100);
  const status = getStorageHealthStatus(used, quota);

  return (
    <div className={styles.storageIndicator}>
      <div className={styles.storageHeader}>
        <HardDrive size={14} />
        <span>Local Storage</span>
        <span className={styles.storageValues}>
          {formatFileSize(used)} / {formatFileSize(quota)}
        </span>
      </div>
      <div className={styles.storageBar}>
        <motion.div
          className={`${styles.storageFill} ${styles[status]}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      {status !== 'healthy' && (
        <p className={`${styles.storageWarning} ${styles[status]}`}>
          <AlertCircle size={12} />
          {status === 'warning' ? 'Storage getting full' : 'Storage nearly full'}
        </p>
      )}
    </div>
  );
};

const MiniSparkline: React.FC<{ data?: number[] }> = ({ data }) => {
  if (!data || data.length === 0) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 60;
  const height = 24;
  const padding = 2;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className={styles.sparkline} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const ProjectBadge: React.FC<{
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

const WaveBadge: React.FC<{ waveNumber: number }> = ({ waveNumber }) => (
  <div className={styles.waveBadge}>
    <Layers size={10} />
    <span>Wave {waveNumber}</span>
  </div>
);

const DatasetCard: React.FC<{
  dataset: StoredDataset;
  project?: Project;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}> = ({
  dataset,
  project,
  isSelected,
  onSelect,
  onOpen,
  onToggleStar,
  onDelete,
  onContextMenu,
}) => {
    const hasSession = Boolean(dataset.sessionState);

    return (
      <motion.div
        className={`${styles.datasetCard} ${isSelected ? styles.selected : ''}`}
        onClick={onSelect}
        onDoubleClick={onOpen}
        onContextMenu={onContextMenu}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ y: -2 }}
        layout
      >
        {/* Selection indicator */}
        <div className={styles.selectionRing}>
          {isSelected && (
            <motion.div
              className={styles.checkmark}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <Check size={12} />
            </motion.div>
          )}
        </div>

        {/* Star button */}
        <button
          className={`${styles.starButton} ${dataset.starred ? styles.starred : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleStar();
          }}
        >
          {dataset.starred ? <Star size={14} /> : <StarOff size={14} />}
        </button>

        {/* Card content */}
        <div className={styles.cardContent}>
          {/* File icon and type */}
          <div className={styles.fileIcon}>
            <Database size={20} />
            <span className={styles.fileType}>.{dataset.source}</span>
          </div>

          {/* File name */}
          <h3 className={styles.fileName}>{dataset.name}</h3>

          {/* Metadata row */}
          <div className={styles.metaRow}>
            <span>{dataset.rowCount.toLocaleString()} rows</span>
            <span className={styles.metaDot}>·</span>
            <span>{dataset.columnCount} cols</span>
            <span className={styles.metaDot}>·</span>
            <span>{formatFileSize(dataset.fileSize)}</span>
          </div>

          {/* Sparkline preview */}
          <MiniSparkline data={dataset.thumbnail} />

          {/* Project and wave badges */}
          <div className={styles.badges}>
            {project && <ProjectBadge project={project} compact />}
            {dataset.waveNumber && <WaveBadge waveNumber={dataset.waveNumber} />}
          </div>

          {/* Last opened */}
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

        {/* Quick actions */}
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

const DatasetListItem: React.FC<{
  dataset: StoredDataset;
  project?: Project;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onToggleStar: () => void;
}> = ({ dataset, project, isSelected, onSelect, onOpen, onToggleStar }) => {
  const hasSession = Boolean(dataset.sessionState);

  return (
    <motion.div
      className={`${styles.datasetListItem} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
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

const ProjectCard: React.FC<{
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
    >
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

const EmptyState: React.FC<{
  onUpload: () => void;
  onLoadExample: () => void;
}> = ({ onUpload, onLoadExample }) => (
  <motion.div
    className={styles.emptyState}
    initial={{ opacity: 0, scale: 0.98, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
  >
    <Logo size={48} className={styles.emptyLogo} />
    <h2>Welcome to Velocity</h2>
    <p>
      Upload your first dataset to begin analysis. Your data stays securely on your device—nothing is ever uploaded to a server.
    </p>
    <div className={styles.emptyActions}>
      <motion.button
        className={styles.uploadCard}
        onClick={onUpload}
      >
        <div className={styles.cardIconWrapper}>
          <FileUp size={24} />
        </div>
        <span className={styles.cardTitle}>Upload Dataset</span>
        <span className={styles.cardDesc}>.SAV, .CSV, or .Arrow</span>
      </motion.button>
      <motion.button
        className={styles.exampleCard}
        onClick={onLoadExample}
      >
        <div className={styles.cardIconWrapper}>
          <Sparkles size={24} />
        </div>
        <span className={styles.cardTitle}>Load Example</span>
        <span className={styles.cardDesc}>Explore features instantly</span>
      </motion.button>
    </div>
  </motion.div>
);

// ============================================================================
// Main Component
// ============================================================================

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'recent' | 'starred' | 'projects';

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  workspaceState,
  onOpenDataset,
  onUploadFile,
  onLoadExample,
  onCreateProject,
  onDeleteDataset,
  onToggleStar,
  onLinkDatasets,
  onUnlinkDataset,
  onCompareWaves,
  onBatchStar,
  onBatchDelete,
  onExport,
  onImportSession,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    dataset: StoredDataset;
    x: number;
    y: number;
  } | null>(null);

  const { datasets, projects, storageUsed, storageQuota } = workspaceState;

  // Build project lookup
  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

  // Filter and sort datasets
  const filteredDatasets = useMemo(() => {
    let result = [...datasets];

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        d =>
          d.name.toLowerCase().includes(query) ||
          d.fileName.toLowerCase().includes(query)
      );
    }

    // Apply filter mode
    switch (filterMode) {
      case 'starred':
        result = result.filter(d => d.starred);
        break;
      case 'projects':
        result = result.filter(d => d.projectId);
        break;
      case 'recent':
      default:
        // Sort by last opened
        result.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
        break;
    }

    return result;
  }, [datasets, searchQuery, filterMode]);

  // Group by project for project view
  const projectsWithDatasets = useMemo(() => {
    return projects.map(project => ({
      project,
      datasets: datasets.filter(d => d.projectId === project.id),
    }));
  }, [projects, datasets]);

  const handleSelectDataset = (id: string, shiftKey: boolean = false) => {
    setSelectedIds(prev => {
      const next = new Set(prev);

      if (shiftKey && lastSelectedId) {
        const currentIndex = filteredDatasets.findIndex(d => d.id === id);
        const lastIndex = filteredDatasets.findIndex(d => d.id === lastSelectedId);

        if (currentIndex !== -1 && lastIndex !== -1) {
          const start = Math.min(currentIndex, lastIndex);
          const end = Math.max(currentIndex, lastIndex);
          for (let i = start; i <= end; i++) {
            next.add(filteredDatasets[i].id);
          }
        } else {
          // Fallback if index not found
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }
      } else {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
    setLastSelectedId(id);
  };

  const handleContextMenu = (dataset: StoredDataset, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuTarget({
      dataset,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const closeContextMenu = () => setContextMenuTarget(null);

  const isEmpty = datasets.length === 0;

  return (
    <div className={styles.workspace}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.title}>
            <Logo size={32} />
            Velocity Workspace
          </div>
          <StorageIndicator used={storageUsed} quota={storageQuota} />
        </div>

        <div className={styles.headerRight}>
          {/* Search */}
          <div className={styles.searchBox}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className={styles.headerActions}>
            {/* View toggle */}
            <div className={styles.viewToggle}>
              <button
                className={viewMode === 'grid' ? styles.active : ''}
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                className={viewMode === 'list' ? styles.active : ''}
                onClick={() => setViewMode('list')}
              >
                <List size={16} />
              </button>
            </div>

            {/* Actions */}
            {onExport && datasets.length > 0 && (
              <motion.button
                className={styles.exportButton}
                onClick={() => onExport([])}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                title="Export workspace"
              >
                <Download size={16} />
              </motion.button>
            )}
            {onImportSession && (
              <motion.button
                className={styles.importButton}
                onClick={onImportSession}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                title="Import portable session"
              >
                <Upload size={16} />
                Import Session
              </motion.button>
            )}
            <motion.button
              className={styles.uploadButton}
              onClick={onUploadFile}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <FileUp size={16} />
              Upload
            </motion.button>
          </div>
        </div>
      </header>

      {/* Filter tabs */}
      <nav className={styles.filterTabs}>
        <button
          className={filterMode === 'recent' ? styles.active : ''}
          onClick={() => setFilterMode('recent')}
        >
          <Clock size={14} />
          Recent
        </button>
        <button
          className={filterMode === 'starred' ? styles.active : ''}
          onClick={() => setFilterMode('starred')}
        >
          <Star size={14} />
          Starred
        </button>
        <button
          className={filterMode === 'projects' ? styles.active : ''}
          onClick={() => setFilterMode('projects')}
        >
          <FolderOpen size={14} />
          Projects
        </button>
        <button
          className={filterMode === 'all' ? styles.active : ''}
          onClick={() => setFilterMode('all')}
        >
          <Database size={14} />
          All Datasets
        </button>

        <div className={styles.tabSpacer} />

        {/* Selection actions */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              className={styles.selectionActions}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <span>{selectedIds.size} selected</span>

              {/* Star All */}
              <button
                onClick={() => {
                  const allStarred = Array.from(selectedIds).every(id => {
                    const dataset = datasets.find(d => d.id === id);
                    return dataset?.starred;
                  });
                  if (onBatchStar) {
                    onBatchStar(Array.from(selectedIds), !allStarred);
                  } else {
                    selectedIds.forEach(id => onToggleStar(id));
                  }
                }}
                title="Toggle Star"
              >
                {Array.from(selectedIds).every(
                  id => datasets.find(d => d.id === id)?.starred
                ) ? (
                  <StarOff size={14} />
                ) : (
                  <Star size={14} />
                )}
                Star
              </button>

              {/* Add to Project */}
              <button onClick={() => onCreateProject(Array.from(selectedIds))}>
                <Link2 size={14} />
                Add to Project
              </button>

              {/* Export */}
              {onExport && (
                <button
                  onClick={() => {
                    if (onExport) {
                      onExport(Array.from(selectedIds));
                    }
                  }}
                  title="Export selected"
                >
                  <Download size={14} />
                  Export
                </button>
              )}

              <div className={styles.actionDivider} />

              {/* Delete */}
              <button
                className={styles.destructiveButton}
                onClick={() => {
                  if (onBatchDelete) {
                    onBatchDelete(Array.from(selectedIds));
                  } else {
                    selectedIds.forEach(id => onDeleteDataset(id));
                  }
                  setSelectedIds(new Set());
                }}
                title="Delete selected"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Main content */}
      <main className={styles.content}>
        {isEmpty ? (
          <EmptyState onUpload={onUploadFile} onLoadExample={onLoadExample} />
        ) : (
          <>
            {/* Projects section (when in projects view) */}
            {filterMode === 'projects' && projectsWithDatasets.length > 0 && (
              <section className={styles.projectsSection}>
                <div className={styles.sectionHeader}>
                  <h2>Projects</h2>
                  <button onClick={() => onCreateProject([])}>
                    <Plus size={14} />
                    New Project
                  </button>
                </div>
                <div className={styles.projectsGrid}>
                  {projectsWithDatasets.map(({ project, datasets: pDatasets }) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      datasets={pDatasets}
                      onOpenProject={() => {
                        // Open first dataset in project
                        if (pDatasets.length > 0) {
                          onOpenDataset(pDatasets[0]);
                        }
                      }}
                      onOpenDataset={onOpenDataset}
                      onCompareWaves={
                        onCompareWaves
                          ? (w1, w2) => onCompareWaves(project, w1, w2)
                          : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Datasets section */}
            <section className={styles.datasetsSection}>
              {filterMode !== 'projects' && (
                <div className={styles.sectionHeader}>
                  <div className={styles.headerLeftGroups}>
                    <input
                      type="checkbox"
                      className={styles.selectAllCheckbox}
                      checked={filteredDatasets.length > 0 && selectedIds.size === filteredDatasets.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(filteredDatasets.map(d => d.id)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      title="Select All"
                    />
                    <h2>
                      {filterMode === 'recent' && 'Recent Datasets'}
                      {filterMode === 'starred' && 'Starred Datasets'}
                      {filterMode === 'all' && 'All Datasets'}
                    </h2>
                  </div>
                  <span className={styles.count}>{filteredDatasets.length} datasets</span>
                </div>
              )}

              {viewMode === 'grid' ? (
                <div className={styles.datasetsGrid}>
                  <AnimatePresence mode="popLayout">
                    {filteredDatasets.map(dataset => (
                      <DatasetCard
                        key={dataset.id}
                        dataset={dataset}
                        project={dataset.projectId ? projectMap.get(dataset.projectId) : undefined}
                        isSelected={selectedIds.has(dataset.id)}
                        onSelect={(e) => handleSelectDataset(dataset.id, e.shiftKey)}
                        onOpen={() => onOpenDataset(dataset)}
                        onToggleStar={() => onToggleStar(dataset.id)}
                        onDelete={() => onDeleteDataset(dataset.id)}
                        onContextMenu={e => handleContextMenu(dataset, e)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className={styles.datasetsList}>
                  <AnimatePresence>
                    {filteredDatasets.map(dataset => (
                      <DatasetListItem
                        key={dataset.id}
                        dataset={dataset}
                        project={dataset.projectId ? projectMap.get(dataset.projectId) : undefined}
                        isSelected={selectedIds.has(dataset.id)}
                        onSelect={(e) => handleSelectDataset(dataset.id, e.shiftKey)}
                        onOpen={() => onOpenDataset(dataset)}
                        onToggleStar={() => onToggleStar(dataset.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenuTarget && (
          <>
            <motion.div
              className={styles.contextBackdrop}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeContextMenu}
            />
            <motion.div
              className={styles.contextMenu}
              style={{ left: contextMenuTarget.x, top: contextMenuTarget.y }}
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
            >
              <button onClick={() => {
                onOpenDataset(contextMenuTarget.dataset);
                closeContextMenu();
              }}>
                <ArrowUpRight size={14} />
                Open
              </button>
              <button onClick={() => {
                onToggleStar(contextMenuTarget.dataset.id);
                closeContextMenu();
              }}>
                {contextMenuTarget.dataset.starred ? <StarOff size={14} /> : <Star size={14} />}
                {contextMenuTarget.dataset.starred ? 'Unstar' : 'Star'}
              </button>
              <div className={styles.contextDivider} />
              {contextMenuTarget.dataset.projectId ? (
                <button onClick={() => {
                  onUnlinkDataset(contextMenuTarget.dataset.id);
                  closeContextMenu();
                }}>
                  <Unlink size={14} />
                  Remove from Project
                </button>
              ) : (
                <button onClick={() => {
                  onCreateProject([contextMenuTarget.dataset.id]);
                  closeContextMenu();
                }}>
                  <Link2 size={14} />
                  Add to Project...
                </button>
              )}
              <div className={styles.contextDivider} />
              <button
                className={styles.destructive}
                onClick={() => {
                  onDeleteDataset(contextMenuTarget.dataset.id);
                  closeContextMenu();
                }}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkspaceView;
