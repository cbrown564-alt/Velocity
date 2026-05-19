/**
 * VirtualizedVariableList
 * 
 * A virtualized list component for rendering 500+ variables efficiently.
 * Uses react-window for virtualization with built-in auto sizing
 * to avoid react-virtualized-auto-sizer import issues.
 */

import React, { useCallback } from 'react';
import { List, type RowComponentProps } from 'react-window';
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

type RowProps = {
    variableSets: VariableSet[];
    selectedIds: Set<string>;
    focusedId?: string | null;
    onRecode: (variable: VariableSet) => void;
    onClick: (variable: VariableSet, e: React.MouseEvent) => void;
    onContextMenu: (variable: VariableSet, e: React.MouseEvent) => void;
};

export const VirtualizedVariableList: React.FC<VirtualizedVariableListProps> = ({
    variableSets,
    selectedIds,
    focusedId,
    onRecode,
    onClick,
    onContextMenu,
}) => {
    // Row renderer for react-window
    const Row = useCallback(
        ({
            index,
            style,
            variableSets,
            selectedIds,
            focusedId,
            onRecode,
            onClick,
            onContextMenu,
        }: RowComponentProps<RowProps>) => {
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
            <div className="flex items-center justify-center h-32 text-[var(--text-tertiary)] text-sm">
                No variables found
            </div>
        );
    }

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <List
                style={{ height: '100%', width: '100%' }}
                rowCount={variableSets.length}
                rowHeight={ITEM_HEIGHT}
                overscanCount={OVERSCAN_COUNT}
                rowComponent={Row}
                rowProps={{
                    variableSets,
                    selectedIds,
                    focusedId,
                    onRecode,
                    onClick,
                    onContextMenu,
                }}
            />
        </div>
    );
};
