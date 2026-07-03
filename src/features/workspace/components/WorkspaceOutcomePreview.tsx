/**
 * Static preview of the export outcome for first-run landing (Workshop Door polish).
 * CSS-only so it stays theme-neutral without bundling screenshot assets.
 */

import React from 'react';
import styles from './WorkspaceOutcomePreview.module.css';

export const WorkspaceOutcomePreview: React.FC = () => {
  return (
    <figure className={styles.preview} data-testid="workspace-outcome-preview" aria-label="Example export preview">
      <div className={styles.previewHeader}>
        <span className={styles.previewBadge}>Editable PPTX</span>
        <span className={styles.previewTitle}>sex × marital status</span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Single</th>
              <th scope="col">Married</th>
              <th scope="col">Divorced</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Male</th>
              <td>18%</td>
              <td>
                52% <span className={styles.sigUp} aria-hidden>▲</span>
              </td>
              <td>12%</td>
            </tr>
            <tr>
              <th scope="row">Female</th>
              <td>22%</td>
              <td>44%</td>
              <td>
                28% <span className={styles.sigUp} aria-hidden>▲</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <figcaption className={styles.caption}>Column % · significance at α=0.05 · native PowerPoint tables</figcaption>
    </figure>
  );
};
