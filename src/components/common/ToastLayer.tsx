/**
 * ToastLayer — single muted status slot (bottom center).
 *
 * One transient message at a time; newer messages replace older ones.
 * Callers keep using addToast; the layer renders only the latest entry and
 * clears the rest, so nothing ever stacks over the artifact.
 */

import React, { useEffect, useCallback } from 'react';
import { useVelocityStore } from '../../store';
import type { Toast } from '../../store/slices/uiSlice';
import styles from './ToastLayer.module.css';

export const ToastLayer: React.FC = () => {
  const toasts = useVelocityStore((state) => state.toasts);
  const dismissToast = useVelocityStore((state) => state.dismissToast);

  // One message at a time: silently clear anything older than the latest.
  useEffect(() => {
    if (toasts.length > 1) {
      for (const stale of toasts.slice(0, -1)) {
        dismissToast(stale.id);
      }
    }
  }, [toasts, dismissToast]);

  const current = toasts[toasts.length - 1];

  if (!current) {
    return null;
  }

  return (
    <div className={styles.region} role="status" aria-live="polite">
      <StatusMessage key={current.id} toast={current} onDismiss={dismissToast} />
    </div>
  );
};

interface StatusMessageProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const StatusMessage: React.FC<StatusMessageProps> = ({ toast, onDismiss }) => {
  const handleDismiss = useCallback(() => {
    onDismiss(toast.id);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(handleDismiss, duration);
    return () => clearTimeout(timer);
  }, [toast.duration, handleDismiss, toast.id]);

  const isError = toast.type === 'error';

  return (
    <button
      type="button"
      onClick={handleDismiss}
      className={`${styles.slot} ${isError ? styles.slotError : ''}`}
      aria-label="Dismiss notification"
    >
      <span className={styles.message}>
        {toast.title ? <span className={styles.title}>{toast.title} · </span> : null}
        {toast.message}
      </span>
      {toast.action ? (
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            toast.action?.onClick();
            handleDismiss();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.stopPropagation();
              toast.action?.onClick();
              handleDismiss();
            }
          }}
          className={styles.action}
        >
          {toast.action.label}
        </span>
      ) : null}
    </button>
  );
};
