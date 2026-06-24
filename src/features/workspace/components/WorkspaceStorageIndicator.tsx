import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../../../lib/motion';
import { HardDrive, AlertCircle } from 'lucide-react';
import { formatFileSize, getStorageHealthStatus } from '../lib/workspaceFormatters';
import styles from './WorkspaceStorageIndicator.module.css';

export const WorkspaceStorageIndicator: React.FC<{
  used: number;
  quota: number;
}> = ({ used, quota }) => {
  const reducedMotion = useReducedMotion();
  const percentage = Math.min((used / quota) * 100, 100);
  const status = getStorageHealthStatus(used, quota);

  return (
    <div className={styles.storageIndicator}>
      <div className={styles.storageHeader}>
        <HardDrive size={14} />
        <span>Local Storage</span>
        <span className={styles.storageValues}>
          {formatFileSize(used)} / {formatFileSize(quota)}
        </span>
      </div>
      <div className={styles.storageBar}>
        <motion.div
          className={`${styles.storageFill} ${styles[status]}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: reducedMotion ? 0.01 : 0.6, ease: 'easeOut' }}
        />
      </div>
      {status !== 'healthy' && (
        <p className={`${styles.storageWarning} ${styles[status]}`}>
          <AlertCircle size={12} />
          {status === 'warning' ? 'Storage getting full' : 'Storage nearly full'}
        </p>
      )}
    </div>
  );
};
