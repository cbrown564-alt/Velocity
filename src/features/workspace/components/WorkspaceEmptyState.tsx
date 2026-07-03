import React, { useCallback, useState } from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import { getUploadFormatError } from '../../../lib/uploadFeedback';
import { WorkspaceOutcomePreview } from './WorkspaceOutcomePreview';
import styles from './WorkspaceEmptyState.module.css';

export const WorkspaceEmptyState: React.FC<{
  onUpload: () => void;
  onLoadExample: () => void;
  isFirstRun?: boolean;
  onImportSession?: () => void;
  onFileDrop?: (file: File) => void;
}> = ({ onUpload, onLoadExample, isFirstRun = false, onImportSession, onFileDrop }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const file = event.dataTransfer.files?.[0];
      if (!file) return;

      const formatError = getUploadFormatError(file.name);
      if (formatError) {
        setDropError(formatError.title);
        return;
      }

      setDropError(null);
      if (onFileDrop) {
        onFileDrop(file);
      } else {
        onUpload();
      }
    },
    [onFileDrop, onUpload],
  );

  if (isFirstRun) {
    return (
      <div className={styles.firstRun} data-testid="workspace-empty-state">
        <div className={styles.firstRunGrid}>
          <div className={styles.firstRunContent}>
            <h1 className={styles.firstRunHeadline}>From client SAV to editable deck — in your browser</h1>
            <p className={styles.firstRunSubhead}>
              Weighted crosstabs with significance. Export native PowerPoint your client can edit. Data never leaves
              this device.
            </p>

            <ol className={styles.workflowSteps} aria-label="Workflow">
              <li>Load .sav</li>
              <li>Crosstab</li>
              <li>Export PPTX</li>
            </ol>

            <div
              className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              data-testid="workspace-upload-dropzone"
            >
              <p className={styles.dropZoneLabel}>Drop client .SAV here</p>
              <p className={styles.dropZoneHint}>Analysis-ready SPSS files · weights preserved · stays on device</p>
              {dropError && (
                <p className={styles.dropZoneError} role="alert">
                  {dropError}
                </p>
              )}
            </div>

            <div className={styles.emptyActions}>
              <button type="button" className={`${styles.actionRow} ${styles.actionRowPrimary}`} onClick={onUpload}>
                <FileUp size={16} aria-hidden />
                <span>Upload client .SAV</span>
              </button>
              <button type="button" className={styles.actionRow} onClick={onLoadExample}>
                <Sparkles size={16} aria-hidden />
                <span>Walk through Sleep study example (~2 min)</span>
              </button>
            </div>

            {onImportSession && (
              <p className={styles.tertiaryLink}>
                <button type="button" className={styles.textLink} onClick={onImportSession}>
                  Import a .velocity session
                </button>
                <span className={styles.tertiaryHint}> — deck metadata only, no respondent rows</span>
              </p>
            )}

            <p className={styles.firstRunMicro}>
              Typical file: ≤50 MB · .sav or .csv · Chrome, Edge, or Safari desktop · Press{' '}
              <kbd className={styles.kbd}>?</kbd> for shortcuts
            </p>
          </div>

          <WorkspaceOutcomePreview />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.emptyList} data-testid="workspace-empty-state">
      <p className={styles.emptyHeading}>No datasets yet</p>
      <p className={styles.emptyHint}>Upload a survey file or try the Sleep study example to start analyzing.</p>
      <div className={styles.emptyActions}>
        <button type="button" className={styles.actionRow} onClick={onUpload}>
          <FileUp size={16} aria-hidden />
          <span>Upload .SAV or .CSV</span>
        </button>
        <button type="button" className={styles.actionRow} onClick={onLoadExample}>
          <Sparkles size={16} aria-hidden />
          <span>Try Sleep study example</span>
        </button>
      </div>
    </div>
  );
};
