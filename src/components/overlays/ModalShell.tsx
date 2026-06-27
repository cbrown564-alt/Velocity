import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useReducedMotion,
  getBackdropProps,
  getModalPresenceProps,
  getMotionProps,
} from '../../lib/motion';
import { useModalEscape } from '../../hooks/useModalEscape';

export type ModalShellLayout = 'split' | 'unified';

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  layout?: ModalShellLayout;
  /** Backdrop click handler. Pass `null` to disable. Defaults to `onClose`. */
  onBackdropClick?: (() => void) | null;
  /** Register document-level Escape handler via `useModalEscape`. */
  escapeToClose?: boolean;
  onPanelKeyDown?: (event: React.KeyboardEvent) => void;
  backdropClassName?: string;
  panelClassName?: string;
  panelStyle?: React.CSSProperties;
  panelDataTestId?: string;
  /** Split layout: class on the centering overlay between backdrop and panel. */
  overlayClassName?: string;
  overlayStyle?: React.CSSProperties;
  /** When true, returns null before AnimatePresence when closed (FilterModal pattern). */
  unmountWhenClosed?: boolean;
  /** Override default panel enter/exit motion (Session modals use custom duration). */
  panelMotionProps?: ReturnType<typeof getMotionProps>;
}

const DEFAULT_BACKDROP =
  'fixed inset-0 bg-[var(--text-primary)]/30 backdrop-blur-sm z-50';

const DEFAULT_OVERLAY =
  'fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none';

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  children,
  layout = 'split',
  onBackdropClick,
  escapeToClose = false,
  onPanelKeyDown,
  backdropClassName = DEFAULT_BACKDROP,
  panelClassName = '',
  panelStyle,
  panelDataTestId,
  overlayClassName = DEFAULT_OVERLAY,
  overlayStyle,
  unmountWhenClosed = false,
  panelMotionProps,
}) => {
  const reducedMotion = useReducedMotion();
  const backdropMotion = getBackdropProps(reducedMotion);
  const panelMotion = panelMotionProps ?? getModalPresenceProps(reducedMotion);

  useModalEscape(escapeToClose && isOpen, onClose);

  const handleBackdropClick =
    onBackdropClick === null ? undefined : (onBackdropClick ?? onClose);

  if (unmountWhenClosed && !isOpen) {
    return null;
  }

  if (layout === 'unified') {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            {...backdropMotion}
            className={backdropClassName}
            onClick={handleBackdropClick}
          >
            <motion.div
              {...panelMotion}
              className={panelClassName}
              style={panelStyle}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={onPanelKeyDown}
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            {...backdropMotion}
            onClick={handleBackdropClick}
            className={backdropClassName}
          />
          <motion.div
            {...panelMotion}
            className={overlayClassName}
            style={overlayStyle}
          >
            <div
              className={panelClassName}
              style={panelStyle}
              data-testid={panelDataTestId}
              onKeyDown={onPanelKeyDown}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
