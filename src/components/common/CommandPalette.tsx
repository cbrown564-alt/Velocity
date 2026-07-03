import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  Search,
  LayoutGrid,
  Maximize2,
  RotateCcw,
  FileDown,
  Home,
  Keyboard,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { useVelocityStore } from '../../store';
import { invokeReturnToWorkspace } from '../../lib/navigationActions';
import { pushModalShortcutContext } from '../../lib/keyboardShortcuts/registry';
import { useAnalysisExportAction } from '../../features/dashboard/hooks/useAnalysisExportAction';
import {
  buildShelfPlacement,
  listVariableSetsForPalette,
  resolveInsertTarget,
  searchVariableSetsForPalette,
  variableSetGlyph,
  variableSetMeta,
  type InsertTarget,
} from './commandPaletteSearch';
import type { VariableSet } from '../../types';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

const VARIABLE_LIMIT = 12;

/**
 * Insert palette (⌘K) — variables are the default result set; ↵ adds to rows,
 * ⌥↵ to columns, ⇧↵ filters. Commands live behind a `>` prefix.
 */
export const CommandPalette: React.FC = () => {
  const commandPaletteOpen = useVelocityStore((state) => state.commandPaletteOpen);
  const closeCommandPalette = useVelocityStore((state) => state.closeCommandPalette);
  const toggleAppMode = useVelocityStore((state) => state.toggleAppMode);
  const toggleFocusMode = useVelocityStore((state) => state.toggleFocusMode);
  const reset = useVelocityStore((state) => state.reset);
  const addToast = useVelocityStore((state) => state.addToast);
  const openShortcuts = useVelocityStore((state) => state.openShortcuts);
  const openFilterModal = useVelocityStore((state) => state.openFilterModal);
  const setTableConfig = useVelocityStore((state) => state.setTableConfig);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const dataset = useVelocityStore((state) => state.dataset);
  const isWorkspaceMode = useVelocityStore((state) => state.isWorkspaceMode);

  const { openExport, canExport } = useAnalysisExportAction();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useFocusTrap(commandPaletteOpen, panelRef);

  const commandMode = query.startsWith('>');
  const commandQuery = commandMode ? query.slice(1).trim().toLowerCase() : '';

  const insertVariable = useMemo(() => {
    return (set: VariableSet, target: InsertTarget) => {
      if (target === 'filter') {
        openFilterModal(set.variableIds[0]);
        closeCommandPalette();
        return;
      }

      const shelfTarget = target === 'columns' ? 'drop-zone-cols' : 'drop-zone-rows';
      const placement = buildShelfPlacement(set, shelfTarget, tableConfig);
      if (!placement) {
        addToast({ message: `${set.name} is already on the slide`, type: 'info' });
        closeCommandPalette();
        return;
      }

      setTableConfig(placement);
      addToast({ message: `${set.name} → ${target}`, type: 'success' });
      closeCommandPalette();
    };
  }, [tableConfig, setTableConfig, openFilterModal, addToast, closeCommandPalette]);

  const commands = useMemo<CommandItem[]>(
    () => [
      {
        id: 'toggle-manager',
        label: 'Toggle Variable Manager',
        shortcut: 'D',
        icon: <LayoutGrid size={16} />,
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
        action: () => {
          toggleFocusMode();
          closeCommandPalette();
        },
      },
      {
        id: 'open-filters',
        label: 'Open Filters',
        icon: <Filter size={16} />,
        action: () => {
          openFilterModal();
          closeCommandPalette();
        },
      },
      {
        id: 'export-slide',
        label: 'Export Current Slide',
        icon: <FileDown size={16} />,
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
        action: () => {
          if (isWorkspaceMode) {
            addToast({ message: 'Already on workspace home', type: 'info' });
          } else {
            invokeReturnToWorkspace();
          }
          closeCommandPalette();
        },
      },
      {
        id: 'shortcuts',
        label: 'Open Keyboard Shortcuts',
        shortcut: '?',
        icon: <Keyboard size={16} />,
        action: () => {
          openShortcuts();
          closeCommandPalette();
        },
      },
    ],
    [
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
    ],
  );

  const filteredCommands = useMemo(() => {
    if (!commandMode) return [];
    if (!commandQuery) return commands;
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(commandQuery) ||
        (command.shortcut && command.shortcut.toLowerCase().includes(commandQuery)),
    );
  }, [commandMode, commandQuery, commands]);

  const variableResults = useMemo<VariableSet[]>(() => {
    if (commandMode) return [];
    if (!query.trim()) return listVariableSetsForPalette(variableSets, VARIABLE_LIMIT);
    return searchVariableSetsForPalette(query, variableSets, {
      variables: dataset?.variables,
      limit: VARIABLE_LIMIT,
    }).map((match) => match.set);
  }, [commandMode, query, variableSets, dataset?.variables]);

  const variableLabels = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const variable of dataset?.variables ?? []) {
      lookup.set(variable.id, variable.label || variable.name);
    }
    return lookup;
  }, [dataset?.variables]);

  const resultCount = commandMode ? filteredCommands.length : variableResults.length;

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
    const selected = listRef.current?.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!commandPaletteOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((index) => (resultCount === 0 ? 0 : (index + 1) % resultCount));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((index) => (resultCount === 0 ? 0 : (index - 1 + resultCount) % resultCount));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (commandMode) {
          filteredCommands[selectedIndex]?.action();
        } else {
          const set = variableResults[selectedIndex];
          if (set) insertVariable(set, resolveInsertTarget(e));
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandPalette();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    commandPaletteOpen,
    commandMode,
    filteredCommands,
    variableResults,
    selectedIndex,
    resultCount,
    insertVariable,
    closeCommandPalette,
  ]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center pt-[16vh] bg-[rgb(36_48_42/0.18)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCommandPalette();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
        className="w-full max-w-xl bg-[var(--bg-panel)] rounded-[10px] shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color-muted)]">
          <Search size={16} className="text-[var(--text-tertiary)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a variable…"
            aria-label="Find a variable"
            className="focus-quiet flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none ring-0"
          />
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5">
          {resultCount === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
              {commandMode ? 'No matching commands.' : 'No matching variables.'}
            </div>
          ) : commandMode ? (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => cmd.action()}
                onMouseEnter={() => setSelectedIndex(index)}
                data-selected={index === selectedIndex || undefined}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  index === selectedIndex ? 'bg-[var(--bg-panel-tint)] shadow-[inset_0_0_0_1px_var(--border-color)]' : ''
                }`}
              >
                <span className="text-[var(--text-tertiary)]">{cmd.icon}</span>
                <span className="flex-1 text-sm text-[var(--text-primary)]">{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-panel-tint)] rounded text-[var(--text-tertiary)] border border-[var(--border-color-muted)] font-mono">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          ) : (
            variableResults.map((set, index) => (
              <button
                key={set.id}
                type="button"
                onClick={(e) => insertVariable(set, resolveInsertTarget(e))}
                onMouseEnter={() => setSelectedIndex(index)}
                data-selected={index === selectedIndex || undefined}
                data-testid={`palette-variable-${set.id}`}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                  index === selectedIndex ? 'bg-[var(--bg-panel-tint)] shadow-[inset_0_0_0_1px_var(--border-color)]' : ''
                }`}
              >
                <span className="w-[18px] shrink-0 text-center font-mono text-[11px] text-[var(--text-tertiary)] border border-[var(--border-color)] rounded px-0 py-px">
                  {variableSetGlyph(set)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-mono text-[12.5px] text-[var(--text-primary)] truncate">{set.name}</span>
                  {variableLabels.get(set.variableIds[0]) &&
                    variableLabels.get(set.variableIds[0]) !== set.name && (
                      <span className="block text-[11.5px] text-[var(--text-secondary)] truncate">
                        {variableLabels.get(set.variableIds[0])}
                      </span>
                    )}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">
                  {variableSetMeta(set)}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-[var(--border-color-muted)] flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]">
          {commandMode ? (
            <span>
              <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">↵</kbd> Run
            </span>
          ) : (
            <>
              <span>
                <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">↵</kbd> Add to rows
              </span>
              <span>
                <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">⌥↵</kbd> Columns
              </span>
              <span>
                <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">⇧↵</kbd> Filter
              </span>
              <span className="inline-flex items-center gap-1">
                <ChevronRight size={11} aria-hidden />
                Commands
              </span>
            </>
          )}
          <span className="ml-auto">
            <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  );
};
