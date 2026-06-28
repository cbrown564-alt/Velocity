import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { resolveContextMenuSelection, useChartSelection } from './useChartSelection';

describe('resolveContextMenuSelection', () => {
  const items = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];

  it('returns only clicked item when it is not selected', () => {
    const result = resolveContextMenuSelection(items[1], 'B', items, new Set(['A']), (item) => item.label);
    expect(result).toEqual([{ label: 'B' }]);
  });

  it('returns all selected items when clicked item is selected', () => {
    const result = resolveContextMenuSelection(items[1], 'B', items, new Set(['A', 'B']), (item) => item.label);
    expect(result).toEqual([{ label: 'A' }, { label: 'B' }]);
  });
});

describe('useChartSelection', () => {
  it('replaces selection on plain click', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() =>
      useChartSelection({
        interactive: true,
        selectedKeys: new Set(['A']),
        onSelectionChange,
      }),
    );

    act(() => {
      result.current.handleToggle('B', { metaKey: false, ctrlKey: false } as React.MouseEvent);
    });

    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['B']));
  });

  it('toggles selection on meta/ctrl click', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() =>
      useChartSelection({
        interactive: true,
        selectedKeys: new Set(['A']),
        onSelectionChange,
      }),
    );

    act(() => {
      result.current.handleToggle('B', { metaKey: true, ctrlKey: false } as React.MouseEvent);
    });

    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['A', 'B']));
  });

  it('invokes context menu with resolved selection', () => {
    const onContextMenu = vi.fn();
    const items = [{ label: 'A' }, { label: 'B' }];
    const { result } = renderHook(() =>
      useChartSelection({
        interactive: true,
        selectedKeys: new Set(['A', 'B']),
        onContextMenu,
      }),
    );

    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 10,
      clientY: 20,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleItemContextMenu(items[1], items, event);
    });

    expect(onContextMenu).toHaveBeenCalledWith({
      selected: items,
      position: { x: 10, y: 20 },
    });
  });
});
