/**
 * ToastLayer — Single bottom-right notification stack
 *
 * All transient feedback (backup reminder, session import, operations) routes here
 * so messages do not overlap separate fixed overlays in App.tsx.
 */

import React, { useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, Info, AlertCircle, AlertTriangle } from 'lucide-react';
import { useVelocityStore } from '../../store';
import type { Toast } from '../../store/slices/uiSlice';
import { getMotionProps, useReducedMotion, DURATIONS } from '../../lib/motion';
import styles from './ToastLayer.module.css';

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

const TOAST_CLASS: Record<Toast['type'], string> = {
  success: styles.toastSuccess,
  info: styles.toastInfo,
  warning: styles.toastWarning,
  error: styles.toastError,
};

const ICON_CLASS: Record<Toast['type'], string> = {
  success: styles.iconSuccess,
  info: styles.iconInfo,
  warning: styles.iconWarning,
  error: styles.iconError,
};

export const ToastLayer: React.FC = () => {
  const toasts = useVelocityStore((state) => state.toasts);
  const dismissToast = useVelocityStore((state) => state.dismissToast);
  const reducedMotion = useReducedMotion();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.region}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-relevant="additions removals"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} reducedMotion={reducedMotion} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  reducedMotion: boolean;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, reducedMotion, onDismiss }) => {
  const Icon = ICONS[toast.type];
  const iconClass = ICON_CLASS[toast.type];

  const handleDismiss = useCallback(() => {
    onDismiss(toast.id);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(handleDismiss, duration);
    return () => clearTimeout(timer);
  }, [toast.duration, handleDismiss, toast.id]);

  return (
    <motion.div
      {...getMotionProps({
        preset: 'slideUp',
        duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
        reducedMotion,
      })}
      layout
      className={`${styles.toast} ${TOAST_CLASS[toast.type]}`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${iconClass}`} aria-hidden />
      <div className={styles.body}>
        {toast.title ? <p className={styles.title}>{toast.title}</p> : null}
        <p className={styles.message}>{toast.message}</p>
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            className={styles.action}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button type="button" onClick={handleDismiss} className={styles.dismiss} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </motion.div>
  );
};
