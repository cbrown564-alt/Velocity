import React from 'react';
import { motion } from 'framer-motion';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { VariableSet } from '../../types';

interface SortableRowShelfProps {
    variableSets: VariableSet[];
    onRemove: (id: string) => void;
}

interface SortableItemProps {
    variableSet: VariableSet;
    onRemove: (id: string) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ variableSet, onRemove }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: variableSet.id,
        data: {
            type: 'sortable-row',
            variableSet: variableSet,
        }
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`relative flex items-center justify-between p-2 pl-2 pr-2 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-md group ${isDragging ? 'z-50 shadow-lg ring-2 ring-[var(--color-terracotta)]' : 'hover:bg-[var(--gray-100)]'
                }`}
        >
            {/* Drag Handle Icon */}
            <div className="p-1 text-[var(--gray-400)]">
                <GripVertical size={14} />
            </div>

            {/* Variable Name */}
            <span
                className="flex-1 text-sm font-medium text-[var(--color-ink)] font-body truncate max-w-[100px] px-2"
                title={variableSet.name}
            >
                {variableSet.name}
            </span>

            {/* Remove Button - stop propagation to prevent drag */}
            <button
                onClick={(e) => { e.stopPropagation(); onRemove(variableSet.id); }}
                onPointerDown={(e) => e.stopPropagation()}
                className="p-1 text-[var(--gray-400)] hover:text-[var(--color-terracotta)] hover:bg-[var(--gray-100)] rounded-full transition-colors"
                aria-label="Remove variable"
            >
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    );
};

export const SortableRowShelf: React.FC<SortableRowShelfProps> = ({
    variableSets,
    onRemove,
}) => {
    return (
        <SortableContext
            items={variableSets.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
        >
            <div className="flex flex-col gap-2 w-full">
                {variableSets.map((set) => (
                    <SortableItem key={set.id} variableSet={set} onRemove={onRemove} />
                ))}
            </div>
        </SortableContext>
    );
};
