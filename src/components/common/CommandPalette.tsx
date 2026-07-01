import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  LayoutGrid,
  Maximize2,
  RotateCcw,
  FileDown,
  Home,
  Moon,
  Sun,
  Droplets,
  Keyboard,
  Filter,
  Rows3,
  Columns3,
  Weight,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useVelocityStore } from '../../store';
import { invokeReturnToWorkspace } from '../../lib/navigationActions';
import { pushModalShortcutContext } from '../../lib/keyboardShortcuts/registry';
import { useAnalysisExportAction } from '../../features/dashboard/hooks/useAnalysisExportAction';
import {
  buildShelfPlacement,
  canAddVariableSetToWeight,
  searchVariableSetsForPalette,
  type VariableShelfTarget,
} from './commandPaletteSearch';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  kind: 'action' | 'variable';
}

export const CommandPalette: React.FC = () => {
  const { setTheme, availableThemes } = useTheme();
  const commandPaletteOpen = useVelocityStore((state) => state.commandPaletteOpen);
  const closeCommandPalette = useVelocityStore((state) => state.closeCommandPalette);
  const toggleAppMode = useVelocityStore((state) => state.toggleAppMode);
  const toggleFocusMode = useVelocityStore((state) => state.toggleFocusMode);
  const reset = useVelocityStore((state) => state.reset);
  const addToast = useVelocityStore((state) => state.addToast);
  const openShortcuts = useVelocityStore((state) => state.openShortcuts);
  const openFilterModal = useVelocityStore((state) => state.openFilterModal);
  const setTableConfig = useVelocityStore((state) => state.setTableConfig);
  const setWeightVariable = useVelocityStore((state) => state.setWeightVariable);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const dataset = useVelocityStore((state) => state.dataset);
  const isWorkspaceMode = useVelocityStore((state) => state.isWorkspaceMode);

  const { openExport, canExport } = useAnalysisExportAction();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<CommandItem[]>(() => {
    const runShelfAction = (set: (typeof variableSets)[number], target: VariableShelfTarget) => {
      if (target === 'drop-zone-weight') {
        const variables = dataset?.variables ?? [];
        if (!canAddVariableSetToWeight(set, variables)) {
          addToast({ message: 'Only numeric variables can be used as weight', type: 'warning' });
          closeCommandPalette();
          return;
        }
        setWeightVariable(set.variableIds[0]);
        addToast({ message: `Added ${set.name} as weight`, type: 'success' });
        closeCommandPalette();
        return;
      }

      const placement = buildShelfPlacement(set, target, tableConfig);
      if (!placement) {
        addToast({ message: `${set.name} is already on the shelf`, type: 'info' });
        closeCommandPalette();
        return;
      }

      setTableConfig(placement);
      const shelfLabel = target === 'drop-zone-rows' ? 'Rows' : 'Columns';
      addToast({ message: `Added ${set.name} to ${shelfLabel}`, type: 'success' });
      closeCommandPalette();
    };

    const list: CommandItem[] = [
      {
        id: 'toggle-manager',
        label: 'Toggle Variable Manager',
        shortcut: 'D',
        icon: <LayoutGrid size={16} />,
        kind: 'action',
        action: () => {
          toggleAppMode();
          closeCommandPalette();
        },
      },
      {
        id: 'toggle-focus',
        label: 'Toggle Focus Mode',
        shortcut: 'F',
        icon: <Maximize2 size={16} />,
        kind: 'action',
        action: () => {
          toggleFocusMode();
          closeCommandPalette();
        },
      },
      {
        id: 'open-filters',
        label: 'Open Filters',
        icon: <Filter size={16} />,
        kind: 'action',
        action: () => {
          openFilterModal();
          closeCommandPalette();
        },
      },
      {
        id: 'export-slide',
        label: 'Export Current Slide',
        icon: <FileDown size={16} />,
        kind: 'action',
        action: () => {
          if (!canExport || !openExport()) {
            addToast({ message: 'Load a dataset before exporting', type: 'warning' });
          }
          closeCommandPalette();
        },
      },
      {
        id: 'reset-analysis',
        label: 'Reset Analysis',
        icon: <RotateCcw size={16} />,
        kind: 'action',
        action: () => {
          reset();
          closeCommandPalette();
          addToast({ message: 'Analysis reset', type: 'info' });
        },
      },
      {
        id: 'workspace',
        label: 'Return to Workspace',
        icon: <Home size={16} />,
        kind: 'action',
        action: () => {
          if (isWorkspaceMode) {
            addToast({ message: 'Already on workspace home', type: 'info' });
          } else {
            invokeReturnToWorkspace();
            addToast({ message: 'Returned to workspace', type: 'info' });
          }
          closeCommandPalette();
        },
      },
      {
        id: 'shortcuts',
        label: 'Open Keyboard Shortcuts',
        shortcut: '?',
        icon: <Keyboard size={16} />,
        kind: 'action',
        action: () => {
          openShortcuts();
          closeCommandPalette();
        },
      },
    ];

    availableThemes.forEach((themeOption) => {
      const icon =
        themeOption.id === 'soft-machine' ? (
          <Sun size={16} />
        ) : themeOption.id === 'mission-control' ? (
          <Moon size={16} />
        ) : (
          <Droplets size={16} />
        );
      list.push({
        id: `theme-${themeOption.id}`,
        label: `Switch Theme: ${themeOption.name}`,
        icon,
        kind: 'action',
        action: () => {
          setTheme(themeOption.id);
          closeCommandPalette();
          addToast({ message: `Switched to ${themeOption.name}`, type: 'success' });
        },
      });
    });

    const variableMatches = searchVariableSetsForPalette(query, variableSets);
    for (const match of variableMatches) {
      const { set } = match;
      const shelfActions: Array<{ target: VariableShelfTarget; label: string; icon: React.ReactNode }> = [
        { target: 'drop-zone-rows', label: `Add ${set.name} to Rows`, icon: <Rows3 size={16} /> },
        { target: 'drop-zone-cols', label: `Add ${set.name} to Columns`, icon: <Columns3 size={16} /> },
      ];

      const variables = dataset?.variables ?? [];
      if (canAddVariableSetToWeight(set, variables)) {
        shelfActions.push({
          target: 'drop-zone-weight',
          label: `Add ${set.name} to Weight`,
          icon: <Weight size={16} />,
        });
      }

      for (const shelfAction of shelfActions) {
        list.push({
          id: `var-${set.id}-${shelfAction.target}`,
          label: shelfAction.label,
          icon: shelfAction.icon,
          kind: 'variable',
          action: () => runShelfAction(set, shelfAction.target),
        });
      }
    }

    return list;
  }, [
    availableThemes,
    query,
    variableSets,
    dataset?.variables,
    tableConfig,
    setTableConfig,
    setWeightVariable,
    setTheme,
    toggleAppMode,
    toggleFocusMode,
    reset,
    closeCommandPalette,
    addToast,
    openShortcuts,
    openFilterModal,
    canExport,
    openExport,
    isWorkspaceMode,
  ]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands.filter((command) => command.kind === 'action');
    const q = query.toLowerCase();
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(q) || (command.shortcut && command.shortcut.toLowerCase().includes(q)),
    );
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    return pushModalShortcutContext();
  }, [commandPaletteOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!commandPaletteOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((index) => (filtered.length === 0 ? 0 : (index + 1) % filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((index) => (filtered.length === 0 ? 0 : (index - 1 + filtered.length) % filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filtered[selectedIndex]?.action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandPalette();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, filtered, selectedIndex, closeCommandPalette]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center pt-[20vh] bg-[rgb(0_0_0_/0.2)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCommandPalette();
      }}
    >
      <div className="w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] focus-within:ring-1 focus-within:ring-[var(--border-color-active)]">
          <Search size={18} className="text-[var(--text-secondary)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search variables..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none ring-0"
          />
          <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 bg-[var(--bg-active)] rounded text-[var(--text-tertiary)] border border-[var(--border-color-muted)]">
            ESC
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
              No commands found. Try searching for a variable name.
            </div>
          ) : (
            filtered.map((cmd, index) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => cmd.action()}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-active)]/50'
                }`}
              >
                <span className="text-[var(--text-tertiary)]">{cmd.icon}</span>
                <span className="flex-1 text-sm">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-surface)] rounded text-[var(--text-tertiary)] border border-[var(--border-color-muted)]">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-[var(--border-color)] flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded bg-[var(--bg-active)] border border-[var(--border-color-muted)]">↑↓</kbd> to
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 rounded bg-[var(--bg-active)] border border-[var(--border-color-muted)]">↵</kbd> to
              select
            </span>
          </div>
          <span>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
};
