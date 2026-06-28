import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion, getMotionProps, DURATIONS } from '../../../lib/motion';
import { FileUp, Sparkles } from 'lucide-react';
import { Logo } from '../../../components/common/Logo';
import styles from './WorkspaceEmptyState.module.css';
import { PILOT_PRIVACY_DETAIL } from '../../../constants/pilotCopy';

export const WorkspaceEmptyState: React.FC<{
  onUpload: () => void;
  onLoadExample: () => void;
}> = ({ onUpload, onLoadExample }) => {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={styles.emptyState}
      {...getMotionProps({
        preset: 'fadeScale',
        duration: reducedMotion ? DURATIONS.instant : DURATIONS.complex,
        ease: 'snappy',
        reducedMotion,
      })}
    >
      <Logo size={48} className={styles.emptyLogo} />
      <h2>Welcome to Velocity</h2>
      <p>{PILOT_PRIVACY_DETAIL}</p>
      <div className={styles.emptyActions}>
        <motion.button className={styles.uploadCard} onClick={onUpload}>
          <div className={styles.cardIconWrapper}>
            <FileUp size={24} />
          </div>
          <span className={styles.cardTitle}>Upload Dataset</span>
          <span className={styles.cardDesc}>.SAV or .CSV</span>
        </motion.button>
        <motion.button className={styles.exampleCard} onClick={onLoadExample}>
          <div className={styles.cardIconWrapper}>
            <Sparkles size={24} />
          </div>
          <span className={styles.cardTitle}>Load Example</span>
          <span className={styles.cardDesc}>Explore features instantly</span>
        </motion.button>
      </div>
    </motion.div>
  );
};
