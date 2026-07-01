import React, { useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getBackdropProps, getModalPresenceProps, getMotionProps } from '../../lib/motion';
import { useModalEscape } from '../../hooks/useModalEscape';
import { useFocusTrap } from '../../hooks/useFocusTrap';

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
  /** Accessible name hooks for dialog semantics */
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  /** Dialog label when no visible title element is wired */
  ariaLabel?: string;
}

const DEFAULT_BACKDROP = 'fixed inset-0 bg-[var(--text-primary)]/30 backdrop-blur-sm z-[var(--z-modal)]';

const DEFAULT_OVERLAY = 'fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 pointer-events-none';

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  children,
  layout = 'split',
  onBackdropClick,
  escapeToClose = true,
  onPanelKeyDown,
  backdropClassName = DEFAULT_BACKDROP,
  panelClassName = '',
  panelStyle,
  panelDataTestId,
  overlayClassName = DEFAULT_OVERLAY,
  overlayStyle,
  unmountWhenClosed = false,
  panelMotionProps,
  ariaLabelledBy,
  ariaDescribedBy,
  ariaLabel,
}) => {
  const reducedMotion = useReducedMotion();
  const backdropMotion = getBackdropProps(reducedMotion);
  const panelMotion = panelMotionProps ?? getModalPresenceProps(reducedMotion);
  const panelRef = useRef<HTMLDivElement>(null);
  const fallbackLabelId = useId();
  const labelledBy = ariaLabelledBy ?? (ariaLabel ? fallbackLabelId : undefined);

  useModalEscape(escapeToClose && isOpen, onClose);
  useFocusTrap(isOpen, panelRef);

  const handleBackdropClick = onBackdropClick === null ? undefined : (onBackdropClick ?? onClose);

  const dialogProps = {
    role: 'dialog' as const,
    'aria-modal': true,
    ...(labelledBy ? { 'aria-labelledby': labelledBy } : {}),
    ...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {}),
    ...(ariaLabel && !labelledBy ? { 'aria-label': ariaLabel } : {}),
    tabIndex: -1,
  };

  if (unmountWhenClosed && !isOpen) {
    return null;
  }

  if (layout === 'unified') {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div {...backdropMotion} className={backdropClassName} onClick={handleBackdropClick}>
            <motion.div
              {...panelMotion}
              ref={panelRef}
              {...dialogProps}
              className={panelClassName}
              style={panelStyle}
              data-testid={panelDataTestId}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={onPanelKeyDown}
            >
              {ariaLabel && !ariaLabelledBy ? (
                <span id={fallbackLabelId} className="sr-only">
                  {ariaLabel}
                </span>
              ) : null}
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
          <motion.div {...backdropMotion} onClick={handleBackdropClick} className={backdropClassName} />
          <motion.div {...panelMotion} className={overlayClassName} style={overlayStyle}>
            <div
              ref={panelRef}
              {...dialogProps}
              className={panelClassName}
              style={panelStyle}
              data-testid={panelDataTestId}
              onKeyDown={onPanelKeyDown}
            >
              {ariaLabel && !ariaLabelledBy ? (
                <span id={fallbackLabelId} className="sr-only">
                  {ariaLabel}
                </span>
              ) : null}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
