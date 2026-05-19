/**
 * ToastLayer — Floating toast notification stack
 *
 * Bottom-right toast system for operation feedback.
 * Auto-dismisses after configurable duration.
 */

import React, { useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, Info, AlertCircle, AlertTriangle } from 'lucide-react';
import { useVelocityStore } from '../../store';
import { getMotionProps, useReducedMotion, DURATIONS } from '../../lib/motion';

const ICONS = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

const ICON_COLORS = {
  success: 'text-[var(--color-success)]',
  info: 'text-[var(--color-accent)]',
  warning: 'text-[var(--status-warning-text)]',
  error: 'text-[var(--color-error)]',
} as const;

const BORDER_COLORS = {
  success: 'border-[var(--color-success)]/20',
  info: 'border-[var(--color-accent)]/20',
  warning: 'border-[var(--status-warning-border)]',
  error: 'border-[var(--color-error)]/20',
} as const;

export const ToastLayer: React.FC = () => {
  const toasts = useVelocityStore((state) => state.toasts);
  const dismissToast = useVelocityStore((state) => state.dismissToast);
  const reducedMotion = useReducedMotion();

  return (
    <div className="fixed bottom-6 right-6 z-[130] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            reducedMotion={reducedMotion}
            onDismiss={dismissToast}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

interface ToastItemProps {
  toast: {
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    duration?: number;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  reducedMotion: boolean;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, reducedMotion, onDismiss }) => {
  const Icon = ICONS[toast.type];
  const iconColor = ICON_COLORS[toast.type];
  const borderColor = BORDER_COLORS[toast.type];

  const handleDismiss = useCallback(() => {
    onDismiss(toast.id);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    const duration = toast.duration ?? 4000;
    const timer = setTimeout(handleDismiss, duration);
    return () => clearTimeout(timer);
  }, [toast.duration, handleDismiss]);

  return (
    <motion.div
      {...getMotionProps({
        preset: 'slideUp',
        duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
        reducedMotion,
      })}
      layout
      className={`pointer-events-auto rounded-lg border ${borderColor} bg-[var(--bg-surface)] shadow-xl p-4 flex items-start gap-3`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            className="mt-2 text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)] transition-colors shrink-0"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};
