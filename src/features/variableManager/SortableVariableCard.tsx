/**
 * SortableVariableCard Component
 * 
 * Wraps VariableCard with @dnd-kit sortable functionality.
 * Displays selection state and provides drag handle.
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Check, Tag, BarChart2, Layers } from 'lucide-react';
import type { VariableType } from '../../store/slices/dataSlice';

interface SortableVariableCardProps {
    id: string;
    name: string;
    type?: VariableType;
    structure: 'single' | 'multi' | 'grid';
    isSelected: boolean;
    hidden?: boolean;
    onSelect: (id: string, multi: boolean) => void;
    onShiftSelect: (id: string) => void;
}

export const SortableVariableCard: React.FC<SortableVariableCardProps> = ({
    id,
    name,
    type,
    structure,
    isSelected,
    hidden,
    onSelect,
    onShiftSelect,
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : hidden ? 0.4 : 1,
    };

    const typeColors = {
        nominal: 'bg-rose-50 border-rose-200 text-rose-700',
        ordinal: 'bg-amber-50 border-amber-200 text-amber-700',
        scale: 'bg-blue-50 border-blue-200 text-blue-700',
    };

    const typeIcons = {
        nominal: Tag,
        ordinal: Layers,
        scale: BarChart2,
    };

    const typeColor = type ? typeColors[type] : 'bg-gray-50 border-gray-200 text-gray-600';
    const TypeIcon = type ? typeIcons[type] : Tag;

    const handleClick = (e: React.MouseEvent) => {
        if (e.shiftKey) {
            onShiftSelect(id);
        } else {
            onSelect(id, e.metaKey || e.ctrlKey);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={handleClick}
            className={`
                relative p-4 rounded-lg border-2 cursor-pointer group
                transition-all duration-150
                ${typeColor}
                ${isSelected
                    ? 'ring-2 ring-indigo-500 ring-offset-2 border-indigo-400'
                    : 'hover:shadow-md hover:border-indigo-300'
                }
                ${isDragging ? 'z-50 shadow-xl' : ''}
                ${hidden ? 'grayscale' : ''}
            `}
        >
            {/* Selection Checkbox */}
            <div
                className={`
                    absolute -top-2 -left-2 w-5 h-5 rounded-full border-2 
                    flex items-center justify-center transition-all
                    ${isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white scale-100'
                        : 'bg-white border-gray-300 scale-0 group-hover:scale-100'
                    }
                `}
            >
                {isSelected && <Check size={12} strokeWidth={3} />}
            </div>

            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-2 right-2 p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-600 cursor-grab active:cursor-grabbing transition-opacity"
            >
                <GripVertical size={14} />
            </div>

            {/* Type Badge */}
            <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider opacity-60 mb-1">
                <TypeIcon size={12} />
                {type || 'unknown'}
            </div>

            {/* Variable Name */}
            <div
                className="font-medium text-sm truncate pr-4"
                title={name}
            >
                {name}
            </div>

            {/* Structure Badge */}
            {structure !== 'single' && (
                <div className="text-xs mt-2 opacity-60">
                    {structure === 'multi' ? 'Multiple response' : 'Grid'}
                </div>
            )}

            {/* Hidden Indicator */}
            {hidden && (
                <div className="absolute bottom-2 right-2 text-[10px] font-medium text-gray-400 uppercase">
                    Hidden
                </div>
            )}
        </div>
    );
};
