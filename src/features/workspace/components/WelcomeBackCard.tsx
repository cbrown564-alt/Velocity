/**
 * Returning-researcher welcome card (STAB-UI-E Phase 4).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { getMotionProps, useReducedMotion, DURATIONS } from '../../../lib/motion';
import type { ResumeCandidate } from '../lib/returningResearcher';
import styles from './WelcomeBackCard.module.css';

export interface WelcomeBackCardProps {
  candidate: ResumeCandidate;
  onResume: () => void;
  onDismiss: () => void;
}

export const WelcomeBackCard: React.FC<WelcomeBackCardProps> = ({ candidate, onResume, onDismiss }) => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={styles.card}
      data-testid="welcome-back-card"
      {...getMotionProps({ preset: 'fadeUp', duration: DURATIONS.enter, reducedMotion })}
    >
      <div className={styles.icon}>
        <Sparkles size={18} />
      </div>
      <div className={styles.body}>
        <p className={styles.eyebrow}>Welcome back</p>
        <p className={styles.summary}>{candidate.summaryLine}</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.resumeButton} onClick={onResume}>
          Resume
        </button>
        <button type="button" className={styles.dismissButton} onClick={onDismiss} aria-label="Dismiss welcome back">
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
};
