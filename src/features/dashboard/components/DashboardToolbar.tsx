import React, { useEffect, useRef, useState } from 'react';
import {
  Home,
  Table,
  BarChart3,
  Upload,
  Download,
  FileDown,
  RotateCcw,
  Maximize2,
  Minimize2,
  Database,
  MoreHorizontal,
} from 'lucide-react';

import type { Dataset } from '../../../types/dataset';
import type { Slide } from '../../../types/slides';
import { useVelocityStore } from '../../../store';

export interface DashboardToolbarProps {
  dataset: Dataset | null;
  activeSlideId: string | null;
  activeSlide: Slide | null;
  focusMode: boolean;
  canOpenExport: boolean;
  recipeOpen: boolean;
  onToggleRecipe: () => void;
  onReturnToWorkspace: () => void;
  onOpenSessionImport: () => void;
  onExportSession: () => void;
  onExport: () => void;
  onToggleFocusMode: () => void;
  onReset: () => void;
}

/** Ghost button per north-star topbar: transparent default, --bg-rail hover, no borders */
const GHOST_BUTTON =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12.5px] text-[var(--text-secondary)] hover:bg-[var(--bg-rail)] hover:text-[var(--text-primary)] transition-colors';

const KBD_HINT = 'font-mono text-[10.5px] text-[var(--text-tertiary)] ml-1';

const OverflowMenu: React.FC<{
  dataset: Dataset | null;
  focusMode: boolean;
  onOpenSessionImport: () => void;
  onExportSession: () => void;
  onToggleFocusMode: () => void;
  onReset: () => void;
}> = ({ dataset, focusMode, onOpenSessionImport, onExportSession, onToggleFocusMode, onReset }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const itemClass =
    'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-rail)] transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={GHOST_BUTTON}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="More actions"
          className="absolute right-0 top-full mt-1 w-56 z-[var(--z-dropdown)] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-lg shadow-lg py-1.5 overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenSessionImport();
            }}
            className={itemClass}
            aria-label="Import Session"
          >
            <Upload size={14} className="text-[var(--text-tertiary)]" aria-hidden />
            Import Session
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExportSession();
            }}
            disabled={!dataset}
            className={itemClass}
            aria-label="Export Session"
          >
            <Download size={14} className="text-[var(--text-tertiary)]" aria-hidden />
            Export Session
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              useVelocityStore.getState().toggleAppMode();
            }}
            className={itemClass}
          >
            <Database size={14} className="text-[var(--text-tertiary)]" aria-hidden />
            Variable Manager
          </button>

          <button
            type="button"
            role="menuitem"
            data-testid="focus-mode-toggle"
            onClick={() => {
              setOpen(false);
              onToggleFocusMode();
            }}
            aria-pressed={focusMode}
            className={itemClass}
          >
            {focusMode ? (
              <Minimize2 size={14} className="text-[var(--text-tertiary)]" aria-hidden />
            ) : (
              <Maximize2 size={14} className="text-[var(--text-tertiary)]" aria-hidden />
            )}
            {focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
          </button>

          <div className="my-1 border-t border-[var(--border-color-muted)]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onReset();
            }}
            className={itemClass}
            aria-label="Reset"
          >
            <RotateCcw size={14} className="text-[var(--text-tertiary)]" aria-hidden />
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  dataset,
  activeSlideId,
  activeSlide,
  focusMode,
  canOpenExport,
  recipeOpen,
  onToggleRecipe,
  onReturnToWorkspace,
  onOpenSessionImport,
  onExportSession,
  onExport,
  onToggleFocusMode,
  onReset,
}) => (
  <header className="surface-panel relative z-[var(--z-sticky)] h-14 border-b border-[var(--border-color-muted)] flex items-center justify-between px-6 bg-[var(--bg-panel)] shrink-0 overflow-visible">
    <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
      <button
        onClick={onReturnToWorkspace}
        className={GHOST_BUTTON}
        title="Return to Workspace"
        aria-label="Return to Workspace"
      >
        <Home size={16} aria-hidden />
      </button>
      {!focusMode && (
        <>
          <span className="text-[var(--border-color)]">/</span>
          <span className="text-[var(--text-primary)] font-medium">{dataset?.name || 'Untitled'}</span>
        </>
      )}
    </div>

    <div className="flex items-center gap-2 shrink-0">
      <div className="flex items-center bg-[var(--bg-rail)] p-1 rounded-lg">
        <button
          type="button"
          onClick={() => {
            if (activeSlideId) {
              useVelocityStore.getState().setSlideVisualizationType(activeSlideId, 'table');
            }
          }}
          aria-label="Table view"
          aria-pressed={activeSlide?.visualizationType === 'table'}
          className={`p-1.5 rounded-md transition-all ${activeSlide?.visualizationType === 'table' ? 'bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          <Table size={16} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => {
            if (activeSlideId) {
              useVelocityStore.getState().setSlideVisualizationType(activeSlideId, 'chart');
            }
          }}
          aria-label="Chart view"
          aria-pressed={activeSlide?.visualizationType === 'chart'}
          className={`p-1.5 rounded-md transition-all ${activeSlide?.visualizationType === 'chart' ? 'bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          <BarChart3 size={16} aria-hidden />
        </button>
      </div>

      <button
        type="button"
        data-testid="recipe-inspector-toggle"
        onClick={onToggleRecipe}
        aria-pressed={recipeOpen}
        className={`${GHOST_BUTTON} ${recipeOpen ? 'bg-[var(--bg-rail)] text-[var(--text-primary)]' : ''}`}
      >
        Recipe
      </button>

      <button type="button" onClick={() => useVelocityStore.getState().openCommandPalette()} className={GHOST_BUTTON}>
        Insert
        <kbd className={KBD_HINT}>⌘K</kbd>
      </button>

      <OverflowMenu
        dataset={dataset}
        focusMode={focusMode}
        onOpenSessionImport={onOpenSessionImport}
        onExportSession={onExportSession}
        onToggleFocusMode={onToggleFocusMode}
        onReset={onReset}
      />

      <button
        onClick={onExport}
        disabled={!canOpenExport}
        data-testid="export-slide-button"
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-[12.5px] font-medium bg-[var(--color-accent)] text-[var(--text-inverse)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export current slide"
        aria-label="Export"
      >
        <FileDown size={14} aria-hidden />
        Export
      </button>
    </div>
  </header>
);
