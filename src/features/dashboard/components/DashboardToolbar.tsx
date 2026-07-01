import React from 'react';
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
  Rows3,
} from 'lucide-react';

import type { Dataset } from '../../../types/dataset';
import type { Slide } from '../../../types/slides';
import { useVelocityStore } from '../../../store';
import { ThemeSwitcher } from '../../../components/common/ThemeSwitcher';
import { ModeToggleButton } from '../../../components/layout/AppShell';

export interface DashboardToolbarProps {
  dataset: Dataset | null;
  activeSlideId: string | null;
  activeSlide: Slide | null;
  focusMode: boolean;
  tableDensity: 'compact' | 'generous';
  canOpenExport: boolean;
  onReturnToWorkspace: () => void;
  onOpenSessionImport: () => void;
  onExportSession: () => void;
  onExport: () => void;
  onToggleFocusMode: () => void;
  onToggleTableDensity: () => void;
  onReset: () => void;
}

export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  dataset,
  activeSlideId,
  activeSlide,
  focusMode,
  tableDensity,
  canOpenExport,
  onReturnToWorkspace,
  onOpenSessionImport,
  onExportSession,
  onExport,
  onToggleFocusMode,
  onToggleTableDensity,
  onReset,
}) => (
  <header className="surface-panel relative z-30 h-14 border-b border-[var(--border-color-muted)] flex items-center justify-between px-6 bg-[var(--bg-panel)] shrink-0 overflow-visible">
    <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
      <button
        onClick={onReturnToWorkspace}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--color-accent)] transition-colors"
        title="Return to Workspace"
      >
        <Home size={16} />
      </button>
      {!focusMode && (
        <>
          <span className="text-[var(--border-color)]">/</span>
          <span className="text-[var(--text-primary)] font-medium">{dataset?.name || 'Untitled'}</span>
        </>
      )}
    </div>

    <div className="flex items-center gap-2 xl:gap-4 shrink-0">
      <div className="flex items-center bg-[var(--bg-surface)] p-1 rounded-lg">
        <button
          type="button"
          onClick={() => {
            if (activeSlideId) {
              useVelocityStore.getState().setSlideVisualizationType(activeSlideId, 'table');
            }
          }}
          aria-label="Table view"
          aria-pressed={activeSlide?.visualizationType === 'table'}
          className={`p-1.5 rounded-md transition-all ${activeSlide?.visualizationType === 'table' ? 'bg-[var(--bg-panel)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
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
          className={`p-1.5 rounded-md transition-all ${activeSlide?.visualizationType === 'chart' ? 'bg-[var(--bg-panel)] text-[var(--color-accent)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
        >
          <BarChart3 size={16} aria-hidden />
        </button>
      </div>

      {!focusMode && (
        <>
          <button
            onClick={onOpenSessionImport}
            className="flex items-center gap-2 px-2 xl:px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] rounded-md hover:bg-[var(--bg-surface)] transition-colors"
            title="Import portable session"
            aria-label="Import Session"
          >
            <Upload size={14} aria-hidden />
            <span className="hidden xl:inline">Import Session</span>
          </button>

          <button
            onClick={onExportSession}
            disabled={!dataset}
            className="flex items-center gap-2 px-2 xl:px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] rounded-md hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export portable session"
            aria-label="Export Session"
          >
            <Download size={14} aria-hidden />
            <span className="hidden xl:inline">Export Session</span>
          </button>

          <button
            onClick={onExport}
            disabled={!canOpenExport}
            data-testid="export-slide-button"
            className="flex items-center gap-2 px-2 xl:px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] rounded-md hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export current slide"
            aria-label="Export"
          >
            <FileDown size={14} aria-hidden />
            <span className="hidden xl:inline">Export</span>
          </button>

          <ThemeSwitcher />

          <button
            onClick={onToggleTableDensity}
            className={`p-2 rounded-lg transition-colors ${tableDensity === 'generous' ? 'bg-[var(--color-accent)] text-[var(--text-inverse)]' : 'hover:bg-[var(--bg-active)] text-[var(--text-secondary)] hover:text-[var(--color-accent)]'}`}
            title={tableDensity === 'generous' ? 'Switch to Compact View' : 'Switch to Presentation View'}
            aria-label={tableDensity === 'generous' ? 'Compact View' : 'Presentation View'}
            aria-pressed={tableDensity === 'generous'}
          >
            <Rows3 size={18} />
          </button>

          <ModeToggleButton />

          <button
            onClick={onReset}
            className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--color-accent)] flex items-center gap-1.5 px-2 xl:px-3 py-1.5 rounded-md hover:bg-[var(--bg-surface)] transition-colors"
            title="Reset analysis"
            aria-label="Reset"
          >
            <RotateCcw size={12} aria-hidden />
            <span className="hidden xl:inline">Reset</span>
          </button>
        </>
      )}

      <button
        onClick={onToggleFocusMode}
        data-testid="focus-mode-toggle"
        className={`p-2 rounded-lg transition-colors ${focusMode ? 'bg-[var(--color-accent)] text-[var(--text-inverse)]' : 'hover:bg-[var(--bg-active)] text-[var(--text-secondary)] hover:text-[var(--color-accent)]'}`}
        title={focusMode ? 'Exit Focus Mode (F)' : 'Enter Focus Mode (F)'}
        aria-label={focusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
        aria-pressed={focusMode}
      >
        {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
    </div>
  </header>
);
