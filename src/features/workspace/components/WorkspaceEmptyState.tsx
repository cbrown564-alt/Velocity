import React from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import styles from './WorkspaceEmptyState.module.css';

export const WorkspaceEmptyState: React.FC<{
  onUpload: () => void;
  onLoadExample: () => void;
  isFirstRun?: boolean;
  onImportSession?: () => void;
}> = ({ onUpload, onLoadExample, isFirstRun = false, onImportSession }) => {
  if (isFirstRun) {
    return (
      <div className={styles.firstRun} data-testid="workspace-empty-state">
        <div className={styles.firstRunContent}>
          <h1 className={styles.firstRunHeadline}>From client SAV to editable deck — in your browser</h1>
          <p className={styles.firstRunSubhead}>
            Weighted crosstabs with significance. Export native PowerPoint your client can edit. Data never leaves this
            device.
          </p>

          <ol className={styles.workflowSteps} aria-label="Workflow">
            <li>Load .sav</li>
            <li>Crosstab</li>
            <li>Export PPTX</li>
          </ol>

          <div className={styles.emptyActions}>
            <button type="button" className={`${styles.actionRow} ${styles.actionRowPrimary}`} onClick={onUpload}>
              <FileUp size={16} aria-hidden />
              <span>Upload client .SAV</span>
            </button>
            <button type="button" className={styles.actionRow} onClick={onLoadExample}>
              <Sparkles size={16} aria-hidden />
              <span>Walk through example (~2 min)</span>
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

          <p className={styles.firstRunMicro}>Typical file: ≤50 MB · .sav or .csv · Chrome, Edge, or Safari desktop</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.emptyList} data-testid="workspace-empty-state">
      <p className={styles.emptyHeading}>No datasets yet</p>
      <p className={styles.emptyHint}>Upload a survey file or try the example dataset to start analyzing.</p>
      <div className={styles.emptyActions}>
        <button type="button" className={styles.actionRow} onClick={onUpload}>
          <FileUp size={16} aria-hidden />
          <span>Upload .SAV or .CSV</span>
        </button>
        <button type="button" className={styles.actionRow} onClick={onLoadExample}>
          <Sparkles size={16} aria-hidden />
          <span>Load example dataset</span>
        </button>
      </div>
    </div>
  );
};
