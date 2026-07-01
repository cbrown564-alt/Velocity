/**
 * ProjectLinkModal - Create and Manage Projects
 *
 * Modal for creating projects that link multiple datasets together,
 * particularly for longitudinal studies with multiple survey waves.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getBackdropProps, getModalPresenceProps } from '../../../lib/motion';
import { X, Link2, FolderPlus, Layers, Database, Check, AlertCircle, ArrowRight } from 'lucide-react';
import type { StoredDataset, Project } from '../types';
import { pluralize } from '../../../lib/pluralize';
import styles from './ProjectLinkModal.module.css';

interface ProjectLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasets: StoredDataset[];
  projects: Project[];
  selectedDatasetIds: string[];
  onCreateProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  onAddToProject: (datasetIds: string[], projectId: string) => void;
  onUpdateWaveNumber: (datasetId: string, waveNumber: number) => void;
  onSetRespondentKey: (datasetId: string, variableName: string) => void;
}

const PROJECT_COLORS = [
  { name: 'Coral', value: '#E07860' },
  { name: 'Forest', value: '#2D4A3E' },
  { name: 'Cyan', value: '#00D4FF' },
  { name: 'Amber', value: '#FFB800' },
  { name: 'Purple', value: '#9B59B6' },
  { name: 'Mint', value: '#00E5A0' },
  { name: 'Red', value: '#E74C3C' },
  { name: 'Blue', value: '#3498DB' },
];

export const ProjectLinkModal: React.FC<ProjectLinkModalProps> = ({
  isOpen,
  onClose,
  datasets,
  projects,
  selectedDatasetIds,
  onCreateProject,
  onAddToProject,
  onUpdateWaveNumber,
  onSetRespondentKey,
}) => {
  const [mode, setMode] = useState<'create' | 'existing'>('create');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(PROJECT_COLORS[0].value);
  const [isLongitudinal, setIsLongitudinal] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [waveAssignments, setWaveAssignments] = useState<Record<string, number>>({});
  const [respondentKeyVar, setRespondentKeyVar] = useState('');

  // Get selected datasets
  const selectedDatasets = useMemo(() => {
    return datasets.filter((d) => selectedDatasetIds.includes(d.id));
  }, [datasets, selectedDatasetIds]);

  // Initialize wave assignments based on file dates
  React.useEffect(() => {
    if (selectedDatasets.length > 0) {
      const sorted = [...selectedDatasets].sort((a, b) => a.createdAt - b.createdAt);
      const assignments: Record<string, number> = {};
      sorted.forEach((d, i) => {
        assignments[d.id] = i + 1;
      });
      setWaveAssignments(assignments);
    }
  }, [selectedDatasets]);

  // Find common variables across all selected datasets
  // (In real implementation, this would check actual variable names)
  const potentialKeyVariables = useMemo(() => {
    // Placeholder - in real implementation, would analyze actual variable metadata
    return ['respondent_id', 'uid', 'panel_id', 'email_hash'];
  }, []);

  const handleCreate = () => {
    if (!projectName.trim()) return;

    onCreateProject({
      name: projectName.trim(),
      description: projectDescription.trim() || undefined,
      color: selectedColor,
      datasetIds: selectedDatasetIds,
      isLongitudinal,
      respondentKeyVariable: isLongitudinal ? respondentKeyVar || undefined : undefined,
    });

    // Apply wave numbers if longitudinal
    if (isLongitudinal) {
      Object.entries(waveAssignments).forEach(([datasetId, waveNumber]) => {
        onUpdateWaveNumber(datasetId, waveNumber);
      });
      if (respondentKeyVar) {
        selectedDatasetIds.forEach((id) => {
          onSetRespondentKey(id, respondentKeyVar);
        });
      }
    }

    onClose();
  };

  const handleAddToExisting = () => {
    if (!selectedProjectId) return;
    onAddToProject(selectedDatasetIds, selectedProjectId);
    onClose();
  };

  const reducedMotion = useReducedMotion();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div className={styles.overlay} {...getBackdropProps(reducedMotion)} onClick={onClose}>
        <motion.div
          className={styles.modal}
          {...getModalPresenceProps(reducedMotion)}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerIcon}>
              <Link2 size={20} />
            </div>
            <div className={styles.headerText}>
              <h2>Link Datasets</h2>
              <p>Create a project to group related datasets together</p>
            </div>
            <button className={styles.closeButton} onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {/* Selected datasets preview */}
          <div className={styles.selectedPreview}>
            <span className={styles.previewLabel}>
              {selectedDatasets.length} dataset{selectedDatasets.length !== 1 ? 's' : ''} selected
            </span>
            <div className={styles.previewList}>
              {selectedDatasets.map((d, i) => (
                <React.Fragment key={d.id}>
                  <span className={styles.previewItem}>
                    <Database size={12} />
                    {d.name}
                  </span>
                  {i < selectedDatasets.length - 1 && <ArrowRight size={12} className={styles.arrow} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Mode tabs */}
          <div className={styles.modeTabs}>
            <button className={mode === 'create' ? styles.active : ''} onClick={() => setMode('create')}>
              <FolderPlus size={14} />
              New Project
            </button>
            {projects.length > 0 && (
              <button className={mode === 'existing' ? styles.active : ''} onClick={() => setMode('existing')}>
                <Link2 size={14} />
                Add to Existing
              </button>
            )}
          </div>

          {/* Content */}
          <div className={styles.content}>
            {mode === 'create' ? (
              <>
                {/* Project name */}
                <div className={styles.field}>
                  <label>Project Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Brand Tracking 2024"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className={styles.field}>
                  <label>Description (optional)</label>
                  <textarea
                    placeholder="Brief description of this project..."
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Color picker */}
                <div className={styles.field}>
                  <label>Color</label>
                  <div className={styles.colorPicker}>
                    {PROJECT_COLORS.map((color) => (
                      <button
                        key={color.value}
                        className={`${styles.colorOption} ${selectedColor === color.value ? styles.selected : ''}`}
                        style={{ background: color.value }}
                        onClick={() => setSelectedColor(color.value)}
                        title={color.name}
                      >
                        {selectedColor === color.value && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Longitudinal toggle */}
                <div className={styles.field}>
                  <div className={styles.toggleRow}>
                    <div className={styles.toggleInfo}>
                      <Layers size={16} />
                      <div>
                        <span className={styles.toggleLabel}>Longitudinal Study</span>
                        <span className={styles.toggleDescription}>
                          Link datasets as survey waves with respondent tracking
                        </span>
                      </div>
                    </div>
                    <button
                      className={`${styles.toggle} ${isLongitudinal ? styles.active : ''}`}
                      onClick={() => setIsLongitudinal(!isLongitudinal)}
                    >
                      <span className={styles.toggleKnob} />
                    </button>
                  </div>
                </div>

                {/* Wave configuration (if longitudinal) */}
                {isLongitudinal && selectedDatasets.length > 1 && (
                  <div className={styles.waveConfig}>
                    <h4>Wave Assignment</h4>
                    <p className={styles.waveHint}>Assign wave numbers to track data across time periods</p>
                    <div className={styles.waveList}>
                      {selectedDatasets.map((d) => (
                        <div key={d.id} className={styles.waveItem}>
                          <span className={styles.waveDataset}>
                            <Database size={14} />
                            {d.name}
                          </span>
                          <div className={styles.waveSelector}>
                            <label>Wave</label>
                            <select
                              value={waveAssignments[d.id] || 1}
                              onChange={(e) =>
                                setWaveAssignments((prev) => ({
                                  ...prev,
                                  [d.id]: parseInt(e.target.value),
                                }))
                              }
                            >
                              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Respondent key */}
                    <div className={styles.keyConfig}>
                      <h4>Respondent Linking Key</h4>
                      <p className={styles.waveHint}>
                        Select a variable that uniquely identifies respondents across waves
                      </p>
                      <select value={respondentKeyVar} onChange={(e) => setRespondentKeyVar(e.target.value)}>
                        <option value="">Select a variable...</option>
                        {potentialKeyVariables.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                      {!respondentKeyVar && (
                        <div className={styles.keyWarning}>
                          <AlertCircle size={12} />
                          <span>Without a key, respondent matching won't be available</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Existing project selection */}
                <div className={styles.field}>
                  <label>Select Project</label>
                  <div className={styles.projectList}>
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        className={`${styles.projectOption} ${selectedProjectId === project.id ? styles.selected : ''}`}
                        onClick={() => setSelectedProjectId(project.id)}
                        style={{ '--project-color': project.color } as React.CSSProperties}
                      >
                        <div className={styles.projectDot} />
                        <div className={styles.projectInfo}>
                          <span className={styles.projectName}>{project.name}</span>
                          <span className={styles.projectMeta}>
                            {pluralize(project.datasetIds.length, 'dataset')}
                            {project.isLongitudinal && ' · Longitudinal'}
                          </span>
                        </div>
                        {selectedProjectId === project.id && <Check size={16} className={styles.checkIcon} />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <motion.button
              className={styles.confirmButton}
              onClick={mode === 'create' ? handleCreate : handleAddToExisting}
              disabled={mode === 'create' ? !projectName.trim() : !selectedProjectId}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link2 size={16} />
              {mode === 'create' ? 'Create Project' : 'Add to Project'}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProjectLinkModal;
