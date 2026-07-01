/**
 * WorkspaceView - The Research Library
 *
 * Multi-file workspace and file management hub for Velocity.
 * Replaces the simple splash screen with a proper file browser.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getMotionProps, getModalPresenceProps, DURATIONS } from '../../../lib/motion';
import {
  FileUp,
  Upload,
  FolderOpen,
  Clock,
  Star,
  StarOff,
  Link2,
  Unlink,
  Trash2,
  Database,
  Search,
  Grid3X3,
  List,
  Plus,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import { Logo } from '../../../components/common/Logo';
import { ThemeSwitcher } from '../../../components/common/ThemeSwitcher';
import styles from './WorkspaceView.module.css';
import {
  applyWorkspaceCategoryFilter,
  computeAmbientSearchHints,
  computeHarmonizationStatus,
  computeWorkspaceCategoryChips,
  matchesVariableKeyword,
  type WorkspaceCategoryChip,
} from '../lib/workspaceLibrary';
import { useWelcomeBack } from '../hooks/useWelcomeBack';
import { WorkspaceStatusStrip } from './WorkspaceStatusStrip';
import { WorkspaceStorageIndicator } from './WorkspaceStorageIndicator';
import { WorkspaceDatasetCard } from './WorkspaceDatasetCard';
import { WorkspaceDatasetListItem } from './WorkspaceDatasetListItem';
import { WorkspaceProjectCard } from './WorkspaceProjectCard';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';
import { downloadPilotEventLog } from '../../../services/pilotOnboarding';
import type { StoredDataset, Project, WorkspaceViewProps } from '../types';

export type { StoredDataset, Project, WorkspaceState } from '../types';

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
  const [categoryFilter, setCategoryFilter] = useState<WorkspaceCategoryChip['filter'] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    dataset: StoredDataset;
    x: number;
    y: number;
  } | null>(null);

  const reducedMotion = useReducedMotion();

  const { datasets, projects, storageUsed, storageQuota } = workspaceState;

  const isEmpty = datasets.length === 0;

  const { showWelcomeBack, resumeCandidate, onResume, onDismiss } = useWelcomeBack({
    datasets,
    onOpenDataset,
  });

  const projectMap = useMemo(() => {
    const map = new Map<string, Project>();
    projects.forEach((p) => map.set(p.id, p));
    return map;
  }, [projects]);

  const categoryChips = useMemo(() => computeWorkspaceCategoryChips(datasets, projects), [datasets, projects]);

  const ambientHints = useMemo(
    () => computeAmbientSearchHints(searchQuery, datasets, projects),
    [searchQuery, datasets, projects],
  );

  const filteredDatasets = useMemo(() => {
    let result = [...datasets];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          d.fileName.toLowerCase().includes(query) ||
          matchesVariableKeyword(d, searchQuery),
      );
    }

    if (categoryFilter) {
      result = applyWorkspaceCategoryFilter(result, projects, categoryFilter);
    }

    switch (filterMode) {
      case 'starred':
        result = result.filter((d) => d.starred);
        break;
      case 'projects':
        result = result.filter((d) => d.projectId);
        break;
      case 'recent':
      default:
        result.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
        break;
    }

    return result;
  }, [datasets, searchQuery, filterMode, categoryFilter, projects]);

  const projectsWithDatasets = useMemo(() => {
    return projects.map((project) => ({
      project,
      datasets: datasets.filter((d) => d.projectId === project.id),
    }));
  }, [projects, datasets]);

  const showFilteredEmptyState = !isEmpty && filterMode !== 'projects' && filteredDatasets.length === 0;

  const filteredEmptyMessage = searchQuery
    ? 'No datasets match your search. Try a different keyword or clear filters.'
    : filterMode === 'starred'
      ? 'No starred datasets yet. Star a dataset to pin it here.'
      : filterMode === 'recent'
        ? 'No recent datasets yet. Open a dataset to populate this view.'
        : 'No datasets available for this view.';

  const handleSelectDataset = (id: string, shiftKey: boolean = false) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (shiftKey && lastSelectedId) {
        const currentIndex = filteredDatasets.findIndex((d) => d.id === id);
        const lastIndex = filteredDatasets.findIndex((d) => d.id === lastSelectedId);

        if (currentIndex !== -1 && lastIndex !== -1) {
          const start = Math.min(currentIndex, lastIndex);
          const end = Math.max(currentIndex, lastIndex);
          for (let i = start; i <= end; i++) {
            next.add(filteredDatasets[i].id);
          }
        } else {
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

  return (
    <div className={styles.workspace}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.title}>
            <Logo size={32} />
            Velocity Workspace
          </div>
          <WorkspaceStorageIndicator used={storageUsed} quota={storageQuota} />
        </div>

        <div className={styles.headerRight}>
          <div className={styles.searchArea}>
            <div className={styles.searchBox}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search datasets..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value) setCategoryFilter(null);
                }}
                data-testid="workspace-search-input"
              />
            </div>
            {ambientHints.length > 0 && (
              <ul className={styles.searchHints} data-testid="workspace-search-hints">
                {ambientHints.map((hint) => (
                  <li key={hint.id}>{hint.message}</li>
                ))}
              </ul>
            )}
            {categoryChips.length > 0 && !searchQuery && (
              <div className={styles.categoryChips} data-testid="workspace-category-chips">
                {categoryChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={categoryFilter === chip.filter ? styles.chipActive : ''}
                    onClick={() => setCategoryFilter((prev) => (prev === chip.filter ? null : chip.filter))}
                  >
                    {chip.count} {chip.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.headerActions}>
            <ThemeSwitcher />
            <div className={styles.viewToggle}>
              <button
                className={viewMode === 'grid' ? styles.active : ''}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
              >
                <Grid3X3 size={16} />
              </button>
              <button
                className={viewMode === 'list' ? styles.active : ''}
                onClick={() => setViewMode('list')}
                aria-label="List view"
              >
                <List size={16} />
              </button>
            </div>

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
              className={styles.importButton}
              onClick={downloadPilotEventLog}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title="Download local pilot workflow event log (JSON)"
              data-testid="pilot-event-log-download"
            >
              <Download size={16} />
              Pilot Log
            </motion.button>
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

      <WorkspaceStatusStrip
        showWelcomeBack={showWelcomeBack}
        resumeCandidate={resumeCandidate}
        onResume={onResume}
        onDismissWelcomeBack={onDismiss}
      />

      <nav className={styles.filterTabs}>
        <button className={filterMode === 'recent' ? styles.active : ''} onClick={() => setFilterMode('recent')}>
          <Clock size={14} />
          Recent
        </button>
        <button className={filterMode === 'starred' ? styles.active : ''} onClick={() => setFilterMode('starred')}>
          <Star size={14} />
          Starred
        </button>
        <button className={filterMode === 'projects' ? styles.active : ''} onClick={() => setFilterMode('projects')}>
          <FolderOpen size={14} />
          Projects
        </button>
        <button className={filterMode === 'all' ? styles.active : ''} onClick={() => setFilterMode('all')}>
          <Database size={14} />
          All Datasets
        </button>

        <div className={styles.tabSpacer} />

        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              className={styles.selectionActions}
              {...getMotionProps({
                preset: 'slideLeft',
                duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
                reducedMotion,
              })}
            >
              <span>{selectedIds.size} selected</span>

              <button
                onClick={() => {
                  const allStarred = Array.from(selectedIds).every((id) => {
                    const dataset = datasets.find((d) => d.id === id);
                    return dataset?.starred;
                  });
                  if (onBatchStar) {
                    onBatchStar(Array.from(selectedIds), !allStarred);
                  } else {
                    selectedIds.forEach((id) => onToggleStar(id));
                  }
                }}
                title="Toggle Star"
              >
                {Array.from(selectedIds).every((id) => datasets.find((d) => d.id === id)?.starred) ? (
                  <StarOff size={14} />
                ) : (
                  <Star size={14} />
                )}
                Star
              </button>

              <button onClick={() => onCreateProject(Array.from(selectedIds))}>
                <Link2 size={14} />
                Add to Project
              </button>

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

              <button
                className={styles.destructiveButton}
                onClick={() => {
                  if (onBatchDelete) {
                    onBatchDelete(Array.from(selectedIds));
                  } else {
                    selectedIds.forEach((id) => onDeleteDataset(id));
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

      <main className={styles.content}>
        {isEmpty ? (
          <WorkspaceEmptyState onUpload={onUploadFile} onLoadExample={onLoadExample} />
        ) : (
          <>
            {filterMode === 'projects' && projectsWithDatasets.length === 0 && (
              <section className={styles.projectsSection}>
                <div className={styles.sectionHeader}>
                  <h2>Projects</h2>
                </div>
                <motion.div
                  className={styles.projectsEmptyState}
                  {...getMotionProps({
                    preset: 'fadeUp',
                    duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
                    reducedMotion,
                  })}
                >
                  <FolderOpen size={40} className={styles.projectsEmptyIcon} />
                  <h3>No projects yet</h3>
                  <p>
                    Group datasets into projects for multi-wave studies. Create a project from selected datasets or
                    start fresh.
                  </p>
                  <button type="button" onClick={() => onCreateProject([])}>
                    <Plus size={14} />
                    New Project
                  </button>
                </motion.div>
              </section>
            )}
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
                    <WorkspaceProjectCard
                      key={project.id}
                      project={project}
                      datasets={pDatasets}
                      harmonizationStatus={computeHarmonizationStatus(project, pDatasets)}
                      onOpenProject={() => {
                        if (pDatasets.length > 0) {
                          onOpenDataset(pDatasets[0]);
                        }
                      }}
                      onOpenDataset={onOpenDataset}
                      onCompareWaves={onCompareWaves ? (w1, w2) => onCompareWaves(project, w1, w2) : undefined}
                    />
                  ))}
                </div>
              </section>
            )}

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
                          setSelectedIds(new Set(filteredDatasets.map((d) => d.id)));
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
                    {filteredDatasets.map((dataset) => (
                      <WorkspaceDatasetCard
                        key={dataset.id}
                        dataset={dataset}
                        project={dataset.projectId ? projectMap.get(dataset.projectId) : undefined}
                        isSelected={selectedIds.has(dataset.id)}
                        onSelect={(e) => handleSelectDataset(dataset.id, e.shiftKey)}
                        onOpen={() => onOpenDataset(dataset)}
                        onToggleStar={() => onToggleStar(dataset.id)}
                        onDelete={() => onDeleteDataset(dataset.id)}
                        onContextMenu={(e) => handleContextMenu(dataset, e)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className={styles.datasetsList}>
                  <AnimatePresence>
                    {filteredDatasets.map((dataset) => (
                      <WorkspaceDatasetListItem
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

              {showFilteredEmptyState && (
                <motion.div
                  className={styles.projectsEmptyState}
                  {...getMotionProps({
                    preset: 'fadeUp',
                    duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
                    reducedMotion,
                  })}
                  data-testid="workspace-filter-empty-state"
                >
                  <Search size={24} className={styles.projectsEmptyIcon} />
                  <h3>No datasets found</h3>
                  <p>{filteredEmptyMessage}</p>
                </motion.div>
              )}
            </section>
          </>
        )}
      </main>

      <AnimatePresence>
        {contextMenuTarget && (
          <>
            <motion.div
              className={styles.contextBackdrop}
              {...getMotionProps({ preset: 'fade', duration: DURATIONS.fast, reducedMotion })}
              onClick={closeContextMenu}
            />
            <motion.div
              className={styles.contextMenu}
              style={{ left: contextMenuTarget.x, top: contextMenuTarget.y }}
              {...getModalPresenceProps(reducedMotion)}
            >
              <button
                onClick={() => {
                  onOpenDataset(contextMenuTarget.dataset);
                  closeContextMenu();
                }}
              >
                <ArrowUpRight size={14} />
                Open
              </button>
              <button
                onClick={() => {
                  onToggleStar(contextMenuTarget.dataset.id);
                  closeContextMenu();
                }}
              >
                {contextMenuTarget.dataset.starred ? <StarOff size={14} /> : <Star size={14} />}
                {contextMenuTarget.dataset.starred ? 'Unstar' : 'Star'}
              </button>
              <div className={styles.contextDivider} />
              {contextMenuTarget.dataset.projectId ? (
                <button
                  onClick={() => {
                    onUnlinkDataset(contextMenuTarget.dataset.id);
                    closeContextMenu();
                  }}
                >
                  <Unlink size={14} />
                  Remove from Project
                </button>
              ) : (
                <button
                  onClick={() => {
                    onCreateProject([contextMenuTarget.dataset.id]);
                    closeContextMenu();
                  }}
                >
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
