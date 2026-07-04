import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { Search, LayoutGrid, Maximize2, RotateCcw, FileDown, Home, Keyboard, Filter, ChevronRight } from 'lucide-react';
import { useVelocityStore } from '../../store';
import { invokeReturnToWorkspace } from '../../lib/navigationActions';
import { pushModalShortcutContext } from '../../lib/keyboardShortcuts/registry';
import { useAnalysisExportAction } from '../../features/dashboard/hooks/useAnalysisExportAction';
import {
  buildShelfPlacement,
  canAddVariableSetToWeight,
  listVariableSetsForPalette,
  resolveInsertTarget,
  searchVariableSetsForPalette,
  variableSetGlyph,
  variableSetMeta,
  type InsertTarget,
} from './commandPaletteSearch';
import type { VariableSet, Variable } from '../../types';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

const VARIABLE_LIMIT = 12;

interface PaletteVariableRowProps {
  set: VariableSet;
  primaryVariable?: Variable;
  index: number;
  selected: boolean;
  label: string | undefined;
  onSelect: (index: number) => void;
  onInsert: (set: VariableSet, modifiers: { altKey: boolean; shiftKey: boolean }) => void;
}

const rowContent = (set: VariableSet, label: string | undefined, primaryVariable?: Variable) => (
  <>
    <span className="w-[18px] shrink-0 text-center font-mono text-[11px] text-[var(--text-tertiary)] border border-[var(--border-color)] rounded px-0 py-px">
      {variableSetGlyph(set, primaryVariable)}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block font-mono text-[12.5px] text-[var(--text-primary)] truncate">{set.name}</span>
      {label && label !== set.name && (
        <span className="block text-[11.5px] text-[var(--text-secondary)] truncate">{label}</span>
      )}
    </span>
    <span className="shrink-0 text-[11px] text-[var(--text-tertiary)] whitespace-nowrap">
      {variableSetMeta(set, primaryVariable)}
    </span>
  </>
);

const rowClass = (selected: boolean) =>
  `w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
    selected ? 'bg-[var(--bg-panel-tint)] shadow-[inset_0_0_0_1px_var(--border-color)]' : ''
  }`;

const PaletteVariableRow: React.FC<PaletteVariableRowProps> = ({
  set,
  primaryVariable,
  index,
  selected,
  label,
  onSelect,
  onInsert,
}) => (
  <button
    type="button"
    onClick={(e) => onInsert(set, e)}
    onMouseEnter={() => onSelect(index)}
    data-selected={selected || undefined}
    data-testid={`palette-variable-${set.id}`}
    className={rowClass(selected)}
  >
    {rowContent(set, label, primaryVariable)}
  </button>
);

/** Palette row that can also be dragged onto the slide (dashboard mount only). */
const DraggablePaletteRow: React.FC<PaletteVariableRowProps> = ({
  set,
  primaryVariable,
  index,
  selected,
  label,
  onSelect,
  onInsert,
}) => {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `palette-${set.id}`,
    data: { variableSet: set, source: 'palette' },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={(e) => onInsert(set, e)}
      onMouseEnter={() => onSelect(index)}
      data-selected={selected || undefined}
      data-testid={`palette-variable-${set.id}`}
      className={rowClass(selected)}
    >
      {rowContent(set, label, primaryVariable)}
    </button>
  );
};

export interface CommandPaletteProps {
  /**
   * True when mounted inside the dashboard's DndContext — rows become
   * draggable onto the slide, and the palette hides itself during a drag.
   */
  withinDnd?: boolean;
}

/**
 * Insert palette (⌘K) — variables are the default result set; ↵ adds to columns,
 * ⌥↵ to rows, ⇧↵ filters. Commands live behind a `>` prefix.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ withinDnd = false }) => {
  const commandPaletteOpen = useVelocityStore((state) => state.commandPaletteOpen);
  const commandPaletteInsertTarget = useVelocityStore((state) => state.commandPaletteInsertTarget);
  const closeCommandPalette = useVelocityStore((state) => state.closeCommandPalette);
  const toggleAppMode = useVelocityStore((state) => state.toggleAppMode);
  const toggleFocusMode = useVelocityStore((state) => state.toggleFocusMode);
  const reset = useVelocityStore((state) => state.reset);
  const addToast = useVelocityStore((state) => state.addToast);
  const openShortcuts = useVelocityStore((state) => state.openShortcuts);
  const openFilterModal = useVelocityStore((state) => state.openFilterModal);
  const setTableConfig = useVelocityStore((state) => state.setTableConfig);
  const setWeightVariable = useVelocityStore((state) => state.setWeightVariable);
  const rejectRecipeColumnPlacement = useVelocityStore((state) => state.rejectRecipeColumnPlacement);
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const dataset = useVelocityStore((state) => state.dataset);
  const isWorkspaceMode = useVelocityStore((state) => state.isWorkspaceMode);
  const draggingId = useVelocityStore((state) => state.draggingId);

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

      if (target === 'weight') {
        const variables = dataset?.variables ?? [];
        if (!canAddVariableSetToWeight(set, variables)) {
          addToast({ message: 'Choose a numeric variable for weight', type: 'warning' });
          return;
        }
        setWeightVariable(set.variableIds[0]);
        addToast({ message: `${set.name} → weight`, type: 'success' });
        closeCommandPalette();
        return;
      }

      const shelfTarget = target === 'columns' ? 'drop-zone-cols' : 'drop-zone-rows';
      const { placement, redirectedFromColumn } = buildShelfPlacement(set, shelfTarget, tableConfig);
      if (!placement) {
        addToast({ message: `${set.name} is already on the slide`, type: 'info' });
        closeCommandPalette();
        return;
      }

      setTableConfig(placement);
      if (redirectedFromColumn) {
        rejectRecipeColumnPlacement();
      } else {
        addToast({ message: `${set.name} → ${target}`, type: 'success' });
      }
      closeCommandPalette();
    };
  }, [
    tableConfig,
    setTableConfig,
    setWeightVariable,
    dataset?.variables,
    openFilterModal,
    addToast,
    closeCommandPalette,
    rejectRecipeColumnPlacement,
  ]);

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
    const variables = dataset?.variables;
    let results: VariableSet[];
    if (!query.trim()) {
      results = listVariableSetsForPalette(variableSets, VARIABLE_LIMIT);
    } else {
      results = searchVariableSetsForPalette(query, variableSets, {
        variables,
        limit: VARIABLE_LIMIT,
      }).map((match) => match.set);
    }
    if (commandPaletteInsertTarget === 'weight' && variables) {
      results = results.filter((set) => canAddVariableSetToWeight(set, variables));
    }
    return results;
  }, [commandMode, query, variableSets, dataset?.variables, commandPaletteInsertTarget]);

  const variableLabels = useMemo(() => {
    const lookup = new Map<string, string>();
    for (const variable of dataset?.variables ?? []) {
      lookup.set(variable.id, variable.label || variable.name);
    }
    return lookup;
  }, [dataset?.variables]);

  const variableById = useMemo(() => {
    return new Map((dataset?.variables ?? []).map((variable) => [variable.id, variable]));
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

  // Hide (don't unmount — unmounting cancels the drag) while a row is being
  // dragged out; close once the drag completes.
  const hiddenForDrag = withinDnd && commandPaletteOpen && !!draggingId;
  const wasHiddenForDragRef = useRef(false);
  useEffect(() => {
    if (hiddenForDrag) {
      wasHiddenForDragRef.current = true;
    } else if (wasHiddenForDragRef.current && !draggingId) {
      wasHiddenForDragRef.current = false;
      if (commandPaletteOpen) closeCommandPalette();
    }
  }, [hiddenForDrag, draggingId, commandPaletteOpen, closeCommandPalette]);

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
          if (set) insertVariable(set, resolveInsertTarget(e, commandPaletteInsertTarget));
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
    commandPaletteInsertTarget,
  ]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[var(--z-modal)] flex items-start justify-center pt-[16vh] bg-[rgb(36_48_42/0.18)] ${
        hiddenForDrag ? 'opacity-0 pointer-events-none' : ''
      }`}
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
              {commandMode
                ? 'No matching commands.'
                : commandPaletteInsertTarget === 'weight'
                  ? 'No numeric weight variables found.'
                  : 'No matching variables.'}
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
                  index === selectedIndex
                    ? 'bg-[var(--bg-panel-tint)] shadow-[inset_0_0_0_1px_var(--border-color)]'
                    : ''
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
            variableResults.map((set, index) => {
              const Row = withinDnd ? DraggablePaletteRow : PaletteVariableRow;
              const primaryVariable = variableById.get(set.variableIds[0]);
              return (
                <Row
                  key={set.id}
                  set={set}
                  primaryVariable={primaryVariable}
                  index={index}
                  selected={index === selectedIndex}
                  label={variableLabels.get(set.variableIds[0])}
                  onSelect={setSelectedIndex}
                  onInsert={(target, modifiers) =>
                    insertVariable(target, resolveInsertTarget(modifiers, commandPaletteInsertTarget))
                  }
                />
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-[var(--border-color-muted)] flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]">
          {commandMode ? (
            <span>
              <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">↵</kbd> Run
            </span>
          ) : commandPaletteInsertTarget === 'columns' ? (
            <>
              <span>
                <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">↵</kbd> Add to columns
              </span>
              <span className="inline-flex items-center gap-1">
                <ChevronRight size={11} aria-hidden />
                Commands
              </span>
            </>
          ) : commandPaletteInsertTarget === 'weight' ? (
            <>
              <span>
                <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">↵</kbd> Set as weight
              </span>
              <span className="inline-flex items-center gap-1">
                <ChevronRight size={11} aria-hidden />
                Commands
              </span>
            </>
          ) : commandPaletteInsertTarget === 'filter' ? (
            <>
              <span>
                <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">↵</kbd> Add as filter
              </span>
              <span className="inline-flex items-center gap-1">
                <ChevronRight size={11} aria-hidden />
                Commands
              </span>
            </>
          ) : (
            <>
              <span>
                <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">↵</kbd> Add to columns
              </span>
              <span>
                <kbd className="font-mono text-[10.5px] text-[var(--text-secondary)]">⌥↵</kbd> Rows
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
