/**
 * SortableVariableCard Component
 * 
 * Wraps VariableCard with @dnd-kit sortable functionality.
 * Displays selection state and provides drag handle.
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Check, CheckCircle, SquareCheck, BarChart2, Grid3X3 } from 'lucide-react';
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
        nominal: 'bg-[#fcece9] border-[#edbaac] text-terracotta',
        ordinal: 'bg-[#f3f6f5] border-[#cbdad6] text-info',
        scale: 'bg-[#f5f5f4] border-[#d8d7d6] text-charcoal',
    };

    const typeIcons = {
        nominal: CheckCircle,
        ordinal: CheckCircle,
        scale: BarChart2,
    };

    const typeColor = type ? typeColors[type] : 'bg-gray-50 border-gray-200 text-gray-600';
    const TypeIcon = structure === 'multi' ? SquareCheck : structure === 'grid' ? Grid3X3 : type ? typeIcons[type] : CheckCircle;

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
                relative p-4 rounded-md border cursor-pointer group
                transition-all duration-150 bg-[#FDFCFA]
                ${typeColor}
                ${isSelected
                    ? 'ring-2 ring-terracotta ring-offset-2 border-terracotta'
                    : 'hover:shadow-float hover:border-terracotta/30'
                }
                ${isDragging ? 'z-50 shadow-drag scale-105' : ''}
                ${hidden ? 'opacity-50 grayscale' : ''}
            `}
        >
            {/* Selection Checkbox */}
            <div
                className={`
                    absolute -top-2 -left-2 w-5 h-5 rounded-full border 
                    flex items-center justify-center transition-all shadow-sm
                    ${isSelected
                        ? 'bg-terracotta border-terracotta text-white scale-100'
                        : 'bg-paper border-gray-300 scale-0 group-hover:scale-100'
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
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1.5 font-body">
                <TypeIcon
                    size={12}
                    className={structure !== 'single' ? 'text-gray-500' : ''}
                />
                {type || 'unknown'}
            </div>

            {/* Variable Name */}
            <div
                className="font-medium text-sm truncate pr-4 text-ink font-body"
                title={name}
            >
                {name}
            </div>

            {/* Structure Badge */}
            {structure !== 'single' && (
                <div className="text-[10px] mt-2 text-gray-500 font-mono bg-white/50 inline-block px-1 rounded">
                    {structure === 'multi' ? 'Multiple response' : 'Grid'}
                </div>
            )}

            {/* Hidden Indicator */}
            {hidden && (
                <div className="absolute bottom-2 right-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Hidden
                </div>
            )}
        </div>
    );
};
