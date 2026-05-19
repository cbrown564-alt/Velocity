/**
 * ExportImportModal - Workspace Export & Import
 *
 * Modal for exporting and importing workspace configuration:
 * - Export: Projects, dataset metadata, settings as JSON
 * - Import: Restore workspace configuration from JSON
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getBackdropProps, getModalPresenceProps } from '../../../lib/motion';
import {
  X,
  Download,
  Upload,
  FileJson,
  FolderOpen,
  Database,
  Settings,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import type { StoredDataset, Project, WorkspaceState } from './WorkspaceView';
import styles from './ExportImportModal.module.css';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceState: WorkspaceState;
  /** Selected dataset IDs for partial export */
  selectedDatasetIds?: string[];
  /** Import callback */
  onImport: (data: WorkspaceExport) => void;
}

export interface WorkspaceExport {
  version: string;
  exportedAt: number;
  exportType: 'full' | 'partial';
  workspace: {
    datasets: Omit<StoredDataset, 'sessionState'>[];
    projects: Project[];
  };
  metadata: {
    totalDatasets: number;
    totalProjects: number;
    totalRows: number;
    exportedBy: string;
  };
}

type ExportMode = 'full' | 'selected';
type Tab = 'export' | 'import';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  workspaceState,
  selectedDatasetIds = [],
  onImport,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('export');
  const [exportMode, setExportMode] = useState<ExportMode>(
    selectedDatasetIds.length > 0 ? 'selected' : 'full'
  );
  const [copied, setCopied] = useState(false);
  const [importData, setImportData] = useState<WorkspaceExport | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { datasets, projects } = workspaceState;

  // Generate export data
  const generateExport = (): WorkspaceExport => {
    const exportDatasets =
      exportMode === 'full'
        ? datasets
        : datasets.filter(d => selectedDatasetIds.includes(d.id));

    // Get projects that contain any of the exported datasets
    const relevantProjectIds = new Set(
      exportDatasets.map(d => d.projectId).filter(Boolean)
    );
    const exportProjects =
      exportMode === 'full'
        ? projects
        : projects.filter(p => relevantProjectIds.has(p.id));

    // Strip session state from datasets (large, not portable)
    const cleanDatasets = exportDatasets.map(({ sessionState, ...rest }) => rest);

    return {
      version: '1.0.0',
      exportedAt: Date.now(),
      exportType: exportMode === 'full' ? 'full' : 'partial',
      workspace: {
        datasets: cleanDatasets,
        projects: exportProjects,
      },
      metadata: {
        totalDatasets: cleanDatasets.length,
        totalProjects: exportProjects.length,
        totalRows: cleanDatasets.reduce((sum, d) => sum + d.rowCount, 0),
        exportedBy: 'Velocity',
      },
    };
  };

  const handleExport = () => {
    const exportData = generateExport();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velocity-workspace-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    const exportData = generateExport();
    await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string) as WorkspaceExport;

        // Validate structure
        if (!data.version || !data.workspace || !data.workspace.datasets) {
          throw new Error('Invalid workspace export file format');
        }

        setImportData(data);
        setImportError(null);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to parse file');
        setImportData(null);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!importData) return;

    try {
      onImport(importData);
      setImportSuccess(true);
      setTimeout(() => {
        setImportSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  if (!isOpen) return null;

  const exportPreview = generateExport();

  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      <motion.div
        className={styles.overlay}
        {...getBackdropProps(reducedMotion)}
        onClick={onClose}
      >
        <motion.div
          className={styles.modal}
          {...getModalPresenceProps(reducedMotion)}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerIcon}>
              <FileJson size={20} />
            </div>
            <div className={styles.headerText}>
              <h2>Export & Import</h2>
              <p>Backup or restore your workspace configuration</p>
            </div>
            <button className={styles.closeButton} onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={activeTab === 'export' ? styles.active : ''}
              onClick={() => setActiveTab('export')}
            >
              <Download size={14} />
              Export
            </button>
            <button
              className={activeTab === 'import' ? styles.active : ''}
              onClick={() => setActiveTab('import')}
            >
              <Upload size={14} />
              Import
            </button>
          </div>

          {/* Content */}
          <div className={styles.content}>
            {activeTab === 'export' ? (
              <>
                {/* Export mode selection */}
                {selectedDatasetIds.length > 0 && (
                  <div className={styles.modeSelector}>
                    <button
                      className={exportMode === 'full' ? styles.active : ''}
                      onClick={() => setExportMode('full')}
                    >
                      <Database size={14} />
                      Full Workspace
                      <span className={styles.modeMeta}>
                        {datasets.length} datasets
                      </span>
                    </button>
                    <button
                      className={exportMode === 'selected' ? styles.active : ''}
                      onClick={() => setExportMode('selected')}
                    >
                      <CheckCircle2 size={14} />
                      Selected Only
                      <span className={styles.modeMeta}>
                        {selectedDatasetIds.length} datasets
                      </span>
                    </button>
                  </div>
                )}

                {/* Export preview */}
                <div className={styles.preview}>
                  <h4>Export Preview</h4>
                  <div className={styles.previewStats}>
                    <div className={styles.previewStat}>
                      <Database size={16} />
                      <span>{exportPreview.metadata.totalDatasets} datasets</span>
                    </div>
                    <div className={styles.previewStat}>
                      <FolderOpen size={16} />
                      <span>{exportPreview.metadata.totalProjects} projects</span>
                    </div>
                    <div className={styles.previewStat}>
                      <Settings size={16} />
                      <span>{exportPreview.metadata.totalRows.toLocaleString()} rows</span>
                    </div>
                  </div>

                  <div className={styles.previewNote}>
                    <AlertCircle size={14} />
                    <span>
                      Export includes metadata only. Original data files must be re-uploaded
                      when importing on a new device.
                    </span>
                  </div>
                </div>

                {/* Export actions */}
                <div className={styles.exportActions}>
                  <motion.button
                    className={styles.primaryButton}
                    onClick={handleExport}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Download size={16} />
                    Download JSON
                  </motion.button>
                  <motion.button
                    className={styles.secondaryButton}
                    onClick={handleCopyToClipboard}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy to Clipboard'}
                  </motion.button>
                </div>
              </>
            ) : (
              <>
                {/* Import dropzone */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".json"
                  className={styles.hiddenInput}
                />

                {!importData && !importSuccess && (
                  <motion.div
                    className={styles.dropzone}
                    onClick={() => fileInputRef.current?.click()}
                    whileHover={{ scale: 1.01 }}
                  >
                    <Upload size={32} />
                    <h4>Select a workspace file</h4>
                    <p>Click to browse or drag & drop a .json export file</p>
                  </motion.div>
                )}

                {importError && (
                  <div className={styles.error}>
                    <AlertCircle size={16} />
                    <span>{importError}</span>
                  </div>
                )}

                {importSuccess && (
                  <div className={styles.success}>
                    <CheckCircle2 size={32} />
                    <h4>Import Successful</h4>
                    <p>Your workspace has been updated</p>
                  </div>
                )}

                {/* Import preview */}
                {importData && !importSuccess && (
                  <div className={styles.importPreview}>
                    <h4>Ready to Import</h4>
                    <div className={styles.previewStats}>
                      <div className={styles.previewStat}>
                        <Database size={16} />
                        <span>{importData.metadata.totalDatasets} datasets</span>
                      </div>
                      <div className={styles.previewStat}>
                        <FolderOpen size={16} />
                        <span>{importData.metadata.totalProjects} projects</span>
                      </div>
                    </div>

                    <div className={styles.importMeta}>
                      <span>Exported: {formatDate(importData.exportedAt)}</span>
                      <span>Type: {importData.exportType === 'full' ? 'Full workspace' : 'Partial'}</span>
                    </div>

                    <div className={styles.importWarning}>
                      <AlertCircle size={14} />
                      <span>
                        Importing will add these datasets and projects to your workspace.
                        Existing items with the same ID will be updated.
                      </span>
                    </div>

                    <div className={styles.importActions}>
                      <motion.button
                        className={styles.primaryButton}
                        onClick={handleImport}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Upload size={16} />
                        Import Workspace
                      </motion.button>
                      <motion.button
                        className={styles.secondaryButton}
                        onClick={() => {
                          setImportData(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Cancel
                      </motion.button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ExportImportModal;
