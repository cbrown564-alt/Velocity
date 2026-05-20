import React from 'react';
import { motion } from 'framer-motion';
import { getMotionProps, DURATIONS } from '../../../lib/motion';
import styles from './AnalysisOutputFrame.module.css';

export interface AnalysisOutputFrameProps {
  children: React.ReactNode;
  /** Footer band — e.g. StatisticsStatusBar */
  footer?: React.ReactNode;
  /** Edge-to-edge within slide content area (Focus mode) */
  bleed?: boolean;
  /** Chart bodies need inner padding; tables manage their own scroll region */
  bodyPadding?: 'none' | 'chart';
  density?: 'compact' | 'generous';
  reducedMotion?: boolean;
  className?: string;
}

/**
 * Shared output chrome for crosstab tables and analysis charts (UXP-023).
 * One bordered artifact: body + optional footer band.
 */
export const AnalysisOutputFrame: React.FC<AnalysisOutputFrameProps> = ({
  children,
  footer,
  bleed = false,
  bodyPadding = 'none',
  density = 'compact',
  reducedMotion = false,
  className = '',
}) => {
  const bodyClass = bodyPadding === 'chart' ? styles.bodyChart : '';

  return (
    <motion.div
      {...getMotionProps({ preset: 'fadeUp', duration: DURATIONS.enter, reducedMotion })}
      data-density={density}
      data-bleed={bleed ? 'true' : undefined}
      className={`analysis-frame ${styles.frame} ${bleed ? styles.bleed : ''} ${className}`.trim()}
    >
      <div className={`${styles.body} ${bodyClass}`}>{children}</div>
      {footer ? <div className={styles.footerBand}>{footer}</div> : null}
    </motion.div>
  );
};
