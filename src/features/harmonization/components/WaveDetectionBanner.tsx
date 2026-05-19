/**
 * WaveDetectionBanner
 *
 * Inline banner shown after SAV load when the newly imported dataset
 * looks like a follow-up wave of an existing project.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, DURATIONS, EASINGS } from '../../../lib/motion';
import { Waves, X, ArrowRight } from 'lucide-react';
import styles from './WaveDetectionBanner.module.css';

interface WaveDetectionBannerProps {
  isVisible: boolean;
  matchedDatasetName: string;
  confidence: number;
  reason: string;
  onHarmonize: () => void;
  onDismiss: () => void;
}

export const WaveDetectionBanner: React.FC<WaveDetectionBannerProps> = ({
  isVisible,
  matchedDatasetName,
  confidence,
  reason,
  onHarmonize,
  onDismiss,
}) => {
  const confidencePct = Math.round(confidence * 100);
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={styles.banner}
          initial={{ opacity: 0, y: reducedMotion ? 0 : -8, height: reducedMotion ? 'auto' : 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : -8, height: reducedMotion ? 'auto' : 0 }}
          transition={{ duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal, ease: EASINGS.standard }}
        >
          <div className={styles.iconWrap}>
            <Waves size={16} />
          </div>

          <div className={styles.content}>
            <p className={styles.headline}>
              This looks like a new wave of <strong>{matchedDatasetName}</strong>
            </p>
            <p className={styles.sub}>{reason} · {confidencePct}% confidence</p>
          </div>

          <div className={styles.actions}>
            <button className={styles.harmonizeBtn} onClick={onHarmonize}>
              Harmonize now
              <ArrowRight size={13} />
            </button>
            <button className={styles.dismissBtn} onClick={onDismiss} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WaveDetectionBanner;
