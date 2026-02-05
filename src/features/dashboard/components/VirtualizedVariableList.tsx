/**
 * VirtualizedVariableList
 * 
 * A virtualized list component for rendering 500+ variables efficiently.
 * Uses react-window for virtualization with built-in auto sizing
 * to avoid react-virtualized-auto-sizer import issues.
 */

import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { FixedSizeList as List, type ListChildComponentProps } from 'react-window';
import { DraggableVariable } from './DraggableVariable';
import { Variable, VariableSet } from '../../../types';

interface VirtualizedVariableListProps {
    variableSets: VariableSet[];
    selectedIds: Set<string>;
    /** ID of the variable set that has focus (for bi-directional context awareness) */
    focusedId?: string | null;
    onRecode: (variable: VariableSet) => void;
    onClick: (variable: VariableSet, e: React.MouseEvent) => void;
    onContextMenu: (variable: VariableSet, e: React.MouseEvent) => void;
}

// Fixed height for each variable card (36px content + 4px gap)
const ITEM_HEIGHT = 40;
// Number of items to render outside visible area for smoother scrolling
const OVERSCAN_COUNT = 5;

type RowData = {
    variableSets: VariableSet[];
    selectedIds: Set<string>;
    focusedId?: string | null;
    onRecode: (variable: VariableSet) => void;
    onClick: (variable: VariableSet, e: React.MouseEvent) => void;
    onContextMenu: (variable: VariableSet, e: React.MouseEvent) => void;
};

/**
 * Custom hook to measure container dimensions using ResizeObserver.
 * This replaces react-virtualized-auto-sizer to avoid import issues.
 */
function useContainerSize(): [React.RefObject<HTMLDivElement | null>, { width: number; height: number }] {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;

        const updateSize = () => {
            const { clientWidth, clientHeight } = element;
            setSize({ width: clientWidth, height: clientHeight });
        };

        // Initial measurement
        updateSize();

        // Observe resize
        const resizeObserver = new ResizeObserver(updateSize);
        resizeObserver.observe(element);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return [ref, size];
}

export const VirtualizedVariableList: React.FC<VirtualizedVariableListProps> = ({
    variableSets,
    selectedIds,
    focusedId,
    onRecode,
    onClick,
    onContextMenu,
}) => {
    const [containerRef, { width, height }] = useContainerSize();

    // Row renderer for react-window
    const Row = useCallback(
        ({
            index,
            style,
            data,
        }: ListChildComponentProps<RowData>) => {
            const {
                variableSets,
                selectedIds,
                focusedId,
                onRecode,
                onClick,
                onContextMenu,
            } = data;
            const set = variableSets[index];

            return (
                <div style={{ ...style, paddingRight: 4, paddingBottom: 4 }}>
                    <DraggableVariable
                        variableSet={set}
                        isSelected={selectedIds.has(set.id)}
                        isFocused={focusedId === set.id}
                        onRecode={onRecode}
                        onClick={onClick}
                        onContextMenu={onContextMenu}
                    />
                </div>
            );
        },
        []
    );

    if (variableSets.length === 0) {
        return (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                No variables found
            </div>
        );
    }

    return (
        <div ref={containerRef} style={{ height: '100%', width: '100%' }}>
            {height > 0 && width > 0 && (
                <List
                    height={height}
                    width={width}
                    itemCount={variableSets.length}
                    itemSize={ITEM_HEIGHT}
                    overscanCount={OVERSCAN_COUNT}
                    itemData={{
                        variableSets,
                        selectedIds,
                        focusedId,
                        onRecode,
                        onClick,
                        onContextMenu,
                    }}
                >
                    {Row}
                </List>
            )}
        </div>
    );
};
