import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';

export interface ContextMenuOption {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export interface ChartContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  title?: string;
  subtitle?: string;
  options: ContextMenuOption[];
  onClose: () => void;
}

export const ChartContextMenu: React.FC<ChartContextMenuProps> = ({
  isOpen,
  position,
  title,
  subtitle,
  options,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [adjustedPos, setAdjustedPos] = useState(position);

  useEffect(() => {
    if (isOpen) {
      const handleClick = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          onClose();
        }
      };
      document.addEventListener('click', handleClick, true);
      return () => document.removeEventListener('click', handleClick, true);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    itemRefs.current.find((el) => el)?.focus();
  }, [isOpen, options]);

  useEffect(() => {
    setAdjustedPos(position);
  }, [position]);

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    const { innerWidth, innerHeight } = window;

    let newX = position.x;
    let newY = position.y;

    if (newY + rect.height > innerHeight) {
      newY = Math.max(0, position.y - rect.height);
    }

    if (newX + rect.width > innerWidth) {
      newX = Math.max(0, position.x - rect.width);
    }

    setAdjustedPos({ x: newX, y: newY });
  }, [isOpen, position]);

  const focusEnabledItem = useCallback((direction: 'next' | 'prev' | 'first' | 'last') => {
    const enabledButtons = itemRefs.current.filter((el) => el);
    if (enabledButtons.length === 0) return;

    const currentIndex = enabledButtons.findIndex((el) => el === document.activeElement);

    switch (direction) {
      case 'next':
        enabledButtons[(currentIndex + 1) % enabledButtons.length]?.focus();
        break;
      case 'prev':
        enabledButtons[(currentIndex - 1 + enabledButtons.length) % enabledButtons.length]?.focus();
        break;
      case 'first':
        enabledButtons[0]?.focus();
        break;
      case 'last':
        enabledButtons[enabledButtons.length - 1]?.focus();
        break;
    }
  }, []);

  const handleMenuKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusEnabledItem('next');
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusEnabledItem('prev');
        break;
      case 'Home':
        e.preventDefault();
        focusEnabledItem('first');
        break;
      case 'End':
        e.preventDefault();
        focusEnabledItem('last');
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={title ? `${title} menu` : 'Chart context menu'}
      onKeyDown={handleMenuKeyDown}
      className="fixed z-[var(--z-menu)] min-w-[180px] bg-[var(--bg-surface)] rounded-lg shadow-xl border border-[var(--border-subtle)] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
      style={{ top: adjustedPos.y, left: adjustedPos.x }}
      onClick={(e) => e.stopPropagation()}
    >
      {(title || subtitle) && (
        <div className="px-3 py-2 border-b border-[var(--border-color-muted)] bg-[var(--bg-active)]">
          {title && <div className="text-[13px] font-semibold color-[var(--text-primary)] truncate">{title}</div>}
          {subtitle && <div className="text-[11px] color-[var(--text-secondary)] mt-0.5 truncate">{subtitle}</div>}
        </div>
      )}
      <div className="p-1">
        {options.map((option, index) => (
          <button
            key={index}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            role="menuitem"
            className={`w-full text-left px-2.5 py-1.5 text-[13px] rounded transition-colors flex items-center
                            ${
                              option.danger
                                ? 'text-[var(--status-error-text)] hover:bg-[var(--status-error-bg)]'
                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-active)]'
                            }
                        `}
            onClick={() => {
              option.onClick();
              onClose();
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};
