import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  /** The element that triggers the tooltip on hover */
  children: React.ReactNode;
  /** Content to display in the tooltip */
  content: React.ReactNode;
  /** Delay before showing tooltip in ms */
  delay?: number;
  /** Position preference */
  position?: 'top' | 'bottom' | 'left' | 'right';
  /** Maximum width of tooltip */
  maxWidth?: number;
  /** Disable the tooltip */
  disabled?: boolean;
}

/**
 * Tooltip Component
 *
 * A hover-activated tooltip that displays rich content.
 * Uses portal to render above all content.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  delay = 200,
  position = 'top',
  maxWidth = 280,
  disabled = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = useCallback(() => {
    if (disabled || !triggerRef.current) return;

    timeoutRef.current = setTimeout(() => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      let x = 0;
      let y = 0;

      switch (position) {
        case 'top':
          x = rect.left + rect.width / 2;
          y = rect.top - 8;
          break;
        case 'bottom':
          x = rect.left + rect.width / 2;
          y = rect.bottom + 8;
          break;
        case 'left':
          x = rect.left - 8;
          y = rect.top + rect.height / 2;
          break;
        case 'right':
          x = rect.right + 8;
          y = rect.top + rect.height / 2;
          break;
      }

      setCoords({ x, y });
      setIsVisible(true);
    }, delay);
  }, [delay, disabled, position]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getTransform = () => {
    switch (position) {
      case 'top':
        return 'translate(-50%, -100%)';
      case 'bottom':
        return 'translate(-50%, 0)';
      case 'left':
        return 'translate(-100%, -50%)';
      case 'right':
        return 'translate(0, -50%)';
    }
  };

  const tooltipElement =
    isVisible && content
      ? createPortal(
          <div
            role="tooltip"
            className="fixed z-[100] pointer-events-none animate-[fadeInUp_0.15s_ease-out]"
            style={{
              left: coords.x,
              top: coords.y,
              transform: getTransform(),
            }}
          >
            <div
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs px-3 py-2 rounded-md shadow-lg"
              style={{ maxWidth }}
            >
              {content}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>
      {tooltipElement}
    </>
  );
};
