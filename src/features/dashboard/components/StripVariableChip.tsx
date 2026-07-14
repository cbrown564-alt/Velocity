import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Pin } from 'lucide-react';

import { VariableTypeIcon } from '../../../components/common/VariableTypeIcon';
import type { VariableSet } from '../../../types';
import { useVelocityStore } from '../../../store';

export interface StripVariableChipProps {
  variableSet: VariableSet;
  pinned: boolean;
  shelfType?: 'row' | 'col' | 'weight' | null;
  onClick?: (variableSet: VariableSet, e: React.MouseEvent) => void;
  onContextMenu?: (variableSet: VariableSet, e: React.MouseEvent) => void;
}

export const StripVariableChip: React.FC<StripVariableChipProps> = ({
  variableSet,
  pinned,
  shelfType,
  onClick,
  onContextMenu,
}) => {
  const setHoveredVariableSetId = useVelocityStore((state) => state.setHoveredVariableSetId);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `strip-${variableSet.id}`,
    data: { variableSet },
  });

  const shelfColor = shelfType ? `var(--shelf-${shelfType})` : undefined;

  return (
    <button
      ref={setNodeRef}
      type="button"
      data-testid={`strip-variable-${variableSet.id}`}
      data-variable-set-id={variableSet.id}
      {...listeners}
      {...attributes}
      className={`group inline-flex items-center gap-1.5 h-7 max-w-[168px] shrink-0 px-2 rounded-md border border-[var(--border-color-muted)] bg-[var(--bg-panel)] text-left cursor-grab active:cursor-grabbing transition-colors hover:bg-[var(--bg-rail)] hover:border-[var(--border-color)] ${
        isDragging ? 'opacity-40' : ''
      }`}
      title={pinned ? `${variableSet.name} (pinned)` : variableSet.name}
      onMouseEnter={() => setHoveredVariableSetId(variableSet.id)}
      onMouseLeave={() => setHoveredVariableSetId(null)}
      onClick={(e) => {
        if (!isDragging) onClick?.(variableSet, e);
      }}
      onContextMenu={(e) => {
        if (!isDragging && onContextMenu) {
          e.preventDefault();
          onContextMenu(variableSet, e);
        }
      }}
    >
      {shelfType && (
        <span
          className="w-[3px] self-stretch rounded-full shrink-0 my-1"
          style={{ background: shelfColor }}
          aria-hidden
        />
      )}
      <VariableTypeIcon
        type={variableSet.type}
        structure={variableSet.structure as 'single' | 'grid' | 'multiple'}
        size={12}
        className="text-[var(--text-secondary)] shrink-0"
      />
      <span className="font-mono text-[11px] text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] truncate tabular-nums">
        {variableSet.name}
      </span>
      {pinned && (
        <Pin
          size={10}
          className="text-[var(--text-tertiary)] shrink-0"
          aria-label="Pinned"
          data-testid={`strip-pin-${variableSet.id}`}
        />
      )}
    </button>
  );
};
