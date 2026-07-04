import React from 'react';
import { BarChart3, LayoutGrid } from 'lucide-react';
import type { ExportPreviewSlideSummary, SignificanceAuditSummary } from '../../core/export/exportPreviewSummary';
import styles from './ExportModal.module.css';

export interface ExportPreviewLaneProps {
  slides: ExportPreviewSlideSummary[];
  selectedSlideId: string | null;
  onSelectSlide: (slideId: string) => void;
  showPercents: boolean;
  showCounts: boolean;
  significanceAudit: SignificanceAuditSummary;
  issueCount: number;
}

function SlideThumbnailArt({
  visualizationType,
}: {
  visualizationType: ExportPreviewSlideSummary['visualizationType'];
}) {
  if (visualizationType === 'chart') {
    return (
      <div className={styles.previewMiniBars} aria-hidden>
        <span style={{ height: '60%' }} />
        <span style={{ height: '85%' }} />
        <span style={{ height: '45%' }} />
        <span style={{ height: '70%' }} />
      </div>
    );
  }

  return (
    <div className={styles.previewMiniCrosstab} aria-hidden>
      <div className={styles.previewCrosstabRow}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.previewCrosstabRow}>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export const ExportPreviewLane: React.FC<ExportPreviewLaneProps> = ({
  slides,
  selectedSlideId,
  onSelectSlide,
  showPercents,
  showCounts,
  significanceAudit,
  issueCount,
}) => {
  const selectedSlide = slides.find((slide) => slide.slideId === selectedSlideId) ?? slides[0] ?? null;

  return (
    <div className={styles.previewLane} data-testid="export-preview-lane">
      <div className={styles.previewIntro}>
        <p className={styles.previewIntroText}>
          Review export-bound slides, recipes, and significance settings before downloading.
        </p>
      </div>

      <div className={styles.previewSection}>
        <div className={styles.previewSectionLabel}>Export slides</div>
        <div className={styles.previewFilmstrip} role="list" aria-label="Export slide previews">
          {slides.map((slide) => {
            const isSelected = slide.slideId === (selectedSlide?.slideId ?? null);
            return (
              <button
                key={slide.slideId}
                type="button"
                role="listitem"
                className={`${styles.previewThumb} ${isSelected ? styles.previewThumbSelected : ''}`}
                data-testid={`export-preview-thumb-${slide.index}`}
                aria-current={isSelected ? 'true' : undefined}
                aria-label={`Slide ${slide.index}: ${slide.title}`}
                onClick={() => onSelectSlide(slide.slideId)}
              >
                <div className={styles.previewThumbFrame}>
                  <SlideThumbnailArt visualizationType={slide.visualizationType} />
                  <span className={styles.previewThumbType} aria-hidden>
                    {slide.visualizationType === 'chart' ? <BarChart3 size={10} /> : <LayoutGrid size={10} />}
                  </span>
                </div>
                <span className={styles.previewThumbIndex}>{slide.index}</span>
                <span className={styles.previewThumbTitle}>{slide.title}</span>
                {slide.recipeSummary && <span className={styles.previewThumbRecipe}>{slide.recipeSummary}</span>}
                <span
                  className={`${styles.previewThumbStatus} ${styles[`previewThumbStatus_${slide.status}`]}`}
                  data-testid={`export-preview-status-${slide.index}`}
                >
                  {slide.status === 'ready' ? 'Ready' : slide.status === 'warning' ? 'Review' : 'Blocked'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedSlide && (
        <div className={styles.previewDetail}>
          <div className={styles.previewSectionLabel}>Recipe summary</div>
          <div className={styles.previewRecipeCard} data-testid="export-preview-recipe-summary">
            <div className={styles.previewRecipeTitle}>{selectedSlide.title}</div>
            <div className={styles.previewRecipeLine}>
              {selectedSlide.recipeSummary ?? 'No row variables configured'}
            </div>
            <div className={styles.previewRecipeMeta}>
              {selectedSlide.visualizationType === 'chart' ? 'Chart view' : 'Table view'}
              {showPercents ? ' · Percentages' : ''}
              {showCounts ? ' · Counts' : ''}
            </div>
            {selectedSlide.issues.length > 0 && (
              <ul className={styles.previewIssueList}>
                {selectedSlide.issues.map((issue, index) => (
                  <li
                    key={`${issue.code}-${index}`}
                    className={issue.severity === 'block' ? styles.reviewIssueBlock : styles.reviewIssueWarn}
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className={styles.previewSection}>
        <div className={styles.previewSectionLabel}>Significance audit</div>
        <dl className={styles.previewAuditList} data-testid="export-preview-significance-audit">
          <div className={styles.previewAuditRow}>
            <dt>Export markers</dt>
            <dd>{significanceAudit.exportMarkers}</dd>
          </div>
          <div className={styles.previewAuditRow}>
            <dt>Methodology</dt>
            <dd>{significanceAudit.methodology}</dd>
          </div>
          <div className={styles.previewAuditRow}>
            <dt>Thresholds</dt>
            <dd>{significanceAudit.significanceLevel}</dd>
          </div>
          <div className={styles.previewAuditRow}>
            <dt>Weighting</dt>
            <dd>{significanceAudit.weight}</dd>
          </div>
        </dl>
        {issueCount > 0 && (
          <p className={styles.previewAuditNote}>
            {issueCount} export {issueCount === 1 ? 'issue' : 'issues'} flagged across selected slides.
          </p>
        )}
      </div>
    </div>
  );
};

export default ExportPreviewLane;
