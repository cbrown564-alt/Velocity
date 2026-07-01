import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../context/ThemeContext';
import { themes } from '../../theme/themes';
import { Check, Palette } from 'lucide-react';

const PANEL_WIDTH = 256;
const GAP = 8;
const VIEWPORT_MARGIN = 8;

interface ThemePanelCoords {
  top: number;
  left: number;
  placement: 'below' | 'above';
}

function computeThemePanelCoords(anchor: HTMLElement): ThemePanelCoords {
  const rect = anchor.getBoundingClientRect();
  let left = rect.right - PANEL_WIDTH;
  if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
  if (left + PANEL_WIDTH > window.innerWidth - VIEWPORT_MARGIN) {
    left = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
  }

  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const placement = spaceBelow < 280 && spaceAbove > spaceBelow ? 'above' : 'below';
  const top = placement === 'below' ? rect.bottom + GAP : rect.top - GAP;

  return { top, left, placement };
}

interface ThemePreviewCardProps {
  themeId: string;
  isActive: boolean;
  onSelect: () => void;
}

const ThemePreviewCard: React.FC<ThemePreviewCardProps> = ({ themeId, isActive, onSelect }) => {
  const theme = themes.find((t) => t.id === themeId);
  if (!theme) return null;

  return (
    <button
      onClick={onSelect}
      className={`
                relative w-full text-left rounded-lg border transition-all duration-200 overflow-hidden
                ${
                  isActive
                    ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)] bg-[var(--bg-active)]'
                    : 'border-[var(--border-color)] hover:border-[var(--color-accent-hover)] hover:bg-[var(--bg-surface)]'
                }
            `}
      aria-pressed={isActive}
    >
      {/* Mini preview canvas */}
      <div className="h-16 w-full relative" style={{ background: theme.colors.background }}>
        {/* Decorative preview elements */}
        <div className="absolute inset-2 flex flex-col gap-1.5">
          {/* Fake header bar */}
          <div className="h-2 w-1/2 rounded-sm" style={{ background: theme.colors.primary }} />
          {/* Fake content bars */}
          <div className="flex gap-1 mt-1">
            <div className="h-6 flex-1 rounded-sm" style={{ background: theme.colors.card }} />
            <div className="h-6 w-1/3 rounded-sm" style={{ background: theme.colors.secondary }} />
          </div>
          {/* Palette swatches */}
          <div className="flex gap-1 mt-auto">
            {[theme.colors.vizPalette1, theme.colors.vizPalette2, theme.colors.vizPalette3].map((c, i) => (
              <div key={i} className="h-1.5 flex-1 rounded-full" style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>

      {/* Label row */}
      <div className="px-3 py-2 flex items-center justify-between bg-[var(--bg-panel)]">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-[var(--text-primary)]">{theme.name}</span>
          <span className="text-[10px] text-[var(--text-tertiary)]">{theme.description}</span>
        </div>
        {isActive && <Check size={14} className="text-[var(--color-accent)] shrink-0" />}
      </div>
    </button>
  );
};

export const ThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<ThemePanelCoords | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const anchor = triggerRef.current;
    if (!anchor) return;
    setCoords(computeThemePanelCoords(anchor));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const panel =
    open && coords ? (
      <div
        ref={panelRef}
        className="fixed z-[var(--z-popover)] w-64 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-xl p-3 flex flex-col gap-2"
        role="listbox"
        aria-label="Theme selection"
        style={{
          top: coords.top,
          left: coords.left,
          transform: coords.placement === 'above' ? 'translateY(-100%)' : undefined,
        }}
      >
        <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider px-1">
          Choose Theme
        </span>
        {themes.map((t) => (
          <ThemePreviewCard
            key={t.id}
            themeId={t.id}
            isActive={theme.id === t.id}
            onSelect={() => {
              setTheme(t.id);
              setOpen(false);
            }}
          />
        ))}
      </div>
    ) : null;

  const currentThemeIndex = themes.findIndex((t) => t.id === theme.id);
  const nextTheme = currentThemeIndex >= 0 ? themes[(currentThemeIndex + 1) % themes.length] : themes[0];
  const triggerTitle = `Theme: ${theme.name}. Next: ${nextTheme.name}`;
  const triggerAriaLabel = `Theme: ${theme.name}. Activate to switch to ${nextTheme.name}`;

  return (
    <div ref={triggerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-lg hover:bg-[var(--bg-active)] text-[var(--text-secondary)] hover:text-[var(--color-accent)] transition-colors"
        title={triggerTitle}
        aria-label={triggerAriaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Palette size={18} />
      </button>

      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  );
};
