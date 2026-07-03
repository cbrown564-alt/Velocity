/**
 * Static preview of the export outcome for first-run landing (Workshop Door polish).
 * Brand tracker archetype: brand preference × segment with planted-story numbers.
 */

import React from 'react';
import { PILOT_LANDING_PREVIEW_BADGE } from '../../../constants/pilotCopy';
import styles from './WorkspaceOutcomePreview.module.css';

type PreviewCell = {
  value: string;
  significant?: boolean;
};

const SEGMENTS = ['Core', 'Growth', 'Value'] as const;

const ROWS: { label: string; cells: PreviewCell[] }[] = [
  {
    label: 'Atlas',
    cells: [{ value: '19%' }, { value: '28%', significant: true }, { value: '17%' }],
  },
  {
    label: 'Beacon',
    cells: [{ value: '24%' }, { value: '22%' }, { value: '21%' }],
  },
  {
    label: 'Meridian',
    cells: [{ value: '25%' }, { value: '20%' }, { value: '23%' }],
  },
];

export const WorkspaceOutcomePreview: React.FC = () => {
  return (
    <figure className={styles.preview} data-testid="workspace-outcome-preview" aria-label="Example export preview">
      <div className={styles.slideFrame}>
        <header className={styles.slideHeader}>
          <span className={styles.previewBadge}>{PILOT_LANDING_PREVIEW_BADGE}</span>
          <span className={styles.slideContext}>Atlas chilled-coffee · Wave 4</span>
        </header>

        <p className={styles.actionTitle}>Beacon overtook Meridian on consideration for the first time in four waves</p>

        <div className={styles.tableFrame}>
          <p className={styles.tableTitle}>Brand preference × segment</p>
          <table className={styles.previewTable}>
            <thead>
              <tr>
                <th scope="col" className={styles.cornerCell} />
                {SEGMENTS.map((segment) => (
                  <th key={segment} scope="col">
                    {segment}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.cells.map((cell, index) => (
                    <td key={SEGMENTS[index]} className={cell.significant ? styles.sigCell : undefined}>
                      <span className={styles.cellValue}>
                        {cell.value}
                        {cell.significant ? (
                          <span className={styles.sigMarker} aria-hidden>
                            ▲
                          </span>
                        ) : null}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className={styles.slideFooter}>Column % · α=0.05 · n=1,200 weighted</footer>
      </div>
    </figure>
  );
};
