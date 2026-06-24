import { useCallback } from 'react';

export interface ChartContextMenuPayload<T> {
  selected: T[];
  position: { x: number; y: number };
}

export interface UseChartSelectionOptions<T> {
  interactive?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  onContextMenu?: (event: ChartContextMenuPayload<T>) => void;
  getKey?: (item: T) => string;
}

export function resolveContextMenuSelection<T>(
  clickedItem: T,
  clickedKey: string,
  items: T[],
  selectedKeys: Set<string> | undefined,
  getKey: (item: T) => string,
): T[] {
  const isCurrentlySelected = selectedKeys?.has(clickedKey);
  return isCurrentlySelected
    ? items.filter((item) => selectedKeys?.has(getKey(item)))
    : [clickedItem];
}

/**
 * Shared click-to-select and context-menu helpers for chart renderers.
 */
export function useChartSelection<T>({
  interactive = true,
  selectedKeys,
  onSelectionChange,
  onContextMenu,
  getKey = (item: T) => (item as { label: string }).label,
}: UseChartSelectionOptions<T>) {
  const handleToggle = useCallback(
    (key: string, event: React.MouseEvent | MouseEvent) => {
      if (!interactive || !onSelectionChange) return;

      const newSelection = new Set(selectedKeys);
      if (event.metaKey || event.ctrlKey) {
        if (newSelection.has(key)) {
          newSelection.delete(key);
        } else {
          newSelection.add(key);
        }
      } else {
        newSelection.clear();
        newSelection.add(key);
      }
      onSelectionChange(newSelection);
    },
    [interactive, onSelectionChange, selectedKeys],
  );

  const handleItemContextMenu = useCallback(
    (item: T, items: T[], event: React.MouseEvent) => {
      if (!interactive || !onContextMenu) return;
      event.preventDefault();
      event.stopPropagation();

      const key = getKey(item);
      const selectedItems = resolveContextMenuSelection(
        item,
        key,
        items,
        selectedKeys,
        getKey,
      );

      onContextMenu({
        selected: selectedItems,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [interactive, onContextMenu, selectedKeys, getKey],
  );

  const handleBackgroundContextMenu = useCallback(
    (items: T[], event: React.MouseEvent) => {
      if (!interactive || !onContextMenu) return;
      event.preventDefault();

      const selectedItems = items.filter((item) => selectedKeys?.has(getKey(item)));
      if (selectedItems.length === 0) return;

      onContextMenu({
        selected: selectedItems,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [interactive, onContextMenu, selectedKeys, getKey],
  );

  return {
    handleToggle,
    handleItemContextMenu,
    handleBackgroundContextMenu,
  };
}
