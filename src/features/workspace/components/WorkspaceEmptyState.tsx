import React from 'react';
import { FileUp, Sparkles } from 'lucide-react';
import styles from './WorkspaceEmptyState.module.css';

export const WorkspaceEmptyState: React.FC<{
  onUpload: () => void;
  onLoadExample: () => void;
}> = ({ onUpload, onLoadExample }) => {
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
