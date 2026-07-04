import React from 'react';
import styles from './AnalysisOutputFrame.module.css';

export interface AnalysisOutputFrameProps {
  children: React.ReactNode;
  bleed?: boolean;
  bodyPadding?: 'none' | 'chart';
  density?: 'compact' | 'generous';
  reducedMotion?: boolean;
  className?: string;
  frameClassName?: string;
}

export const AnalysisOutputFrame: React.FC<AnalysisOutputFrameProps> = ({
  children,
  bleed = false,
  bodyPadding = 'none',
  density = 'compact',
  className = '',
  frameClassName = '',
}) => {
  const bodyClass = bodyPadding === 'chart' ? styles.bodyChart : '';

  return (
    <div
      data-density={density}
      data-bleed={bleed ? 'true' : undefined}
      className={`analysis-frame ${styles.frame} ${frameClassName === 'shrink-wrap' ? styles.shrinkWrap : ''} ${bleed ? styles.bleed : ''} ${className}`.trim()}
    >
      <div className={`${styles.body} ${bodyClass}`}>{children}</div>
    </div>
  );
};
