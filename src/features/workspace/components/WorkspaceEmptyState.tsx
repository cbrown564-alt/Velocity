import React, { useCallback, useState } from 'react';
import { ArrowRight, BarChart3, FileInput, FileUp, LayoutTemplate, Presentation, Table2, Upload } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  PILOT_LANDING_DROP_HINT,
  PILOT_LANDING_DROP_LABEL,
  PILOT_LANDING_EXAMPLE_DESC,
  PILOT_LANDING_EXAMPLE_SHORT,
  PILOT_LANDING_EXAMPLE_TITLE,
  PILOT_LANDING_EYEBROW,
  PILOT_LANDING_HEADLINE,
  PILOT_LANDING_IMPORT_HINT,
  PILOT_LANDING_IMPORT_LABEL,
  PILOT_LANDING_LIBRARY_HINT,
  PILOT_LANDING_LIBRARY_UPLOAD,
  PILOT_LANDING_PREVIEW_LABEL,
  PILOT_LANDING_SUBHEAD,
  PILOT_LANDING_TEMPLATE_DESC,
  PILOT_LANDING_TEMPLATE_SHORT,
  PILOT_LANDING_TEMPLATE_TITLE,
  PILOT_LANDING_UPLOAD_CTA,
  PILOT_LANDING_WORKFLOW_STEPS,
} from '../../../constants/pilotCopy';
import { getUploadFormatError } from '../../../lib/uploadFeedback';
import { WorkspaceOutcomePreview } from './WorkspaceOutcomePreview';
import styles from './WorkspaceEmptyState.module.css';

const WORKFLOW_ICONS: LucideIcon[] = [FileInput, Table2, Presentation];

export const WorkspaceEmptyState: React.FC<{
  onUpload: () => void;
  onLoadExample: () => void;
  onStartFromTemplate?: () => void;
  isFirstRun?: boolean;
  onImportSession?: () => void;
  onFileDrop?: (file: File) => void;
}> = ({ onUpload, onLoadExample, onStartFromTemplate, isFirstRun = false, onImportSession, onFileDrop }) => {
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
            <p className={styles.eyebrow}>{PILOT_LANDING_EYEBROW}</p>
            <h1 className={styles.firstRunHeadline}>{PILOT_LANDING_HEADLINE}</h1>
            <p className={styles.firstRunSubhead}>{PILOT_LANDING_SUBHEAD}</p>

            <div className={styles.workflowStrip} data-testid="workflow-strip" role="list" aria-label="Workflow">
              {PILOT_LANDING_WORKFLOW_STEPS.map((step, index) => {
                const StepIcon = WORKFLOW_ICONS[index];
                return (
                  <React.Fragment key={step.label}>
                    <div className={styles.workflowStep} role="listitem">
                      <div className={styles.workflowIconRing} aria-hidden>
                        <StepIcon size={18} strokeWidth={1.75} />
                        <span className={styles.workflowIndex}>{index + 1}</span>
                      </div>
                      <p className={styles.workflowLabel}>{step.label}</p>
                      <p className={styles.workflowDetail}>{step.detail}</p>
                    </div>
                    {index < PILOT_LANDING_WORKFLOW_STEPS.length - 1 ? (
                      <div className={styles.workflowConnector} aria-hidden>
                        <span className={styles.workflowConnectorLine} />
                        <ArrowRight size={14} className={styles.workflowConnectorArrow} />
                      </div>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>

            <div className={styles.actionPanel}>
              <div
                className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                data-testid="workspace-upload-dropzone"
              >
                <div className={styles.dropIconWrap} aria-hidden>
                  <Upload size={22} strokeWidth={1.75} />
                </div>
                <p className={styles.dropZoneLabel}>{PILOT_LANDING_DROP_LABEL}</p>
                <p className={styles.dropZoneHint}>{PILOT_LANDING_DROP_HINT}</p>
                {dropError ? (
                  <p className={styles.dropZoneError} role="alert">
                    {dropError}
                  </p>
                ) : null}
              </div>

              <div className={styles.actionPanelFooter}>
                <button type="button" className={styles.primaryCta} onClick={onUpload}>
                  <FileUp size={18} aria-hidden />
                  <span>{PILOT_LANDING_UPLOAD_CTA}</span>
                </button>

                <button
                  type="button"
                  className={styles.exampleRow}
                  onClick={onLoadExample}
                  aria-label={`${PILOT_LANDING_EXAMPLE_TITLE} — ${PILOT_LANDING_EXAMPLE_DESC}`}
                >
                  <span className={styles.exampleIcon} aria-hidden>
                    <BarChart3 size={20} strokeWidth={1.75} />
                  </span>
                  <span className={styles.exampleCopy}>
                    <span className={styles.exampleTitle}>{PILOT_LANDING_EXAMPLE_TITLE}</span>
                    <span className={styles.exampleDesc}>{PILOT_LANDING_EXAMPLE_DESC}</span>
                  </span>
                  <ArrowRight size={18} className={styles.exampleArrow} aria-hidden />
                </button>
                {onStartFromTemplate ? (
                  <button
                    type="button"
                    className={styles.exampleRow}
                    onClick={onStartFromTemplate}
                    data-testid="workspace-start-template"
                    aria-label={`${PILOT_LANDING_TEMPLATE_TITLE} — ${PILOT_LANDING_TEMPLATE_DESC}`}
                  >
                    <span className={styles.exampleIcon} aria-hidden>
                      <LayoutTemplate size={20} strokeWidth={1.75} />
                    </span>
                    <span className={styles.exampleCopy}>
                      <span className={styles.exampleTitle}>{PILOT_LANDING_TEMPLATE_TITLE}</span>
                      <span className={styles.exampleDesc}>{PILOT_LANDING_TEMPLATE_DESC}</span>
                    </span>
                    <ArrowRight size={18} className={styles.exampleArrow} aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>

            {onImportSession ? (
              <button type="button" className={styles.importLink} onClick={onImportSession}>
                <span>{PILOT_LANDING_IMPORT_LABEL}</span>
                <span className={styles.importHint}>{PILOT_LANDING_IMPORT_HINT}</span>
              </button>
            ) : null}

            <p className={styles.firstRunMicro}>
              Typical file ≤50 MB · Chrome, Edge, or Safari desktop · Press <kbd className={styles.kbd}>?</kbd> for
              shortcuts
            </p>
          </div>

          <aside className={styles.previewAside}>
            <p className={styles.previewLabel}>{PILOT_LANDING_PREVIEW_LABEL}</p>
            <WorkspaceOutcomePreview />
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.emptyList} data-testid="workspace-empty-state">
      <p className={styles.emptyHeading}>No datasets yet</p>
      <p className={styles.emptyHint}>{PILOT_LANDING_LIBRARY_HINT}</p>
      <div className={styles.emptyActions}>
        <button type="button" className={styles.actionRow} onClick={onUpload}>
          <FileUp size={16} aria-hidden />
          <span>{PILOT_LANDING_LIBRARY_UPLOAD}</span>
        </button>
        <button type="button" className={styles.actionRow} onClick={onLoadExample}>
          <BarChart3 size={16} aria-hidden />
          <span>{PILOT_LANDING_EXAMPLE_SHORT}</span>
        </button>
        {onStartFromTemplate ? (
          <button
            type="button"
            className={styles.actionRow}
            onClick={onStartFromTemplate}
            data-testid="workspace-start-template"
          >
            <LayoutTemplate size={16} aria-hidden />
            <span>{PILOT_LANDING_TEMPLATE_SHORT}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
};
