import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getMotionProps, DURATIONS } from '../../../lib/motion';

export interface ContextMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, actions, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: y, left: x });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', onClose, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  // Enhanced positioning logic to keep menu within viewport
  useLayoutEffect(() => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;

    let newTop = y;
    let newLeft = x;

    // Check vertical overflow (bottom)
    if (y + rect.height > innerHeight) {
      newTop = Math.max(0, y - rect.height);
    }

    // Check horizontal overflow (right)
    if (x + rect.width > innerWidth) {
      newLeft = Math.max(0, x - rect.width);
    }

    setPosition({ top: newTop, left: newLeft });
  }, [x, y, actions]);

  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      <motion.div
        ref={ref}
        {...getMotionProps({
          preset: 'fadeScale',
          duration: reducedMotion ? DURATIONS.instant : DURATIONS.fast,
          reducedMotion,
        })}
        className="fixed z-[9999] min-w-[200px] bg-[var(--bg-surface)] rounded-lg shadow-xl border border-[var(--border-subtle)] py-1.5 overflow-hidden backdrop-blur-sm"
        style={{ top: position.top, left: position.left }}
      >
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              if (!action.disabled) {
                action.onClick();
                onClose();
              }
            }}
            disabled={action.disabled}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors
              ${
                action.disabled
                  ? 'opacity-50 cursor-not-allowed text-[var(--text-secondary)]'
                  : 'cursor-pointer hover:bg-[var(--bg-active)]'
              }
              ${
                action.danger
                  ? 'text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]'
                  : 'text-[var(--text-primary)]'
              }
            `}
          >
            {action.icon && <span className="text-[var(--text-secondary)] opacity-80">{action.icon}</span>}
            {action.label}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};
