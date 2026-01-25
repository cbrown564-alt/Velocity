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

    const getTypeStyle = (variableType?: VariableType) => {
        switch (variableType) {
            case 'nominal':
                return {
                    backgroundColor: 'var(--tag-nominal-bg)',
                    color: 'var(--tag-nominal-text)',
                    borderColor: 'transparent'
                };
            case 'ordinal':
                return {
                    backgroundColor: 'var(--tag-ordinal-bg)',
                    color: 'var(--tag-ordinal-text)',
                    borderColor: 'transparent'
                };
            case 'scale':
            case 'numeric':
                return {
                    backgroundColor: 'var(--tag-scale-bg)',
                    color: 'var(--tag-scale-text)',
                    borderColor: 'var(--border-color-muted)'
                };
            default:
                return {
                    backgroundColor: 'var(--bg-active)',
                    color: 'var(--text-secondary)',
                    borderColor: 'transparent'
                };
        }
    };

    const typeIcons = {
        nominal: CheckCircle,
        ordinal: CheckCircle,
        scale: BarChart2,
    };

    const currentTypeStyle = getTypeStyle(type);
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
            style={{ ...style, ...currentTypeStyle }}
            onClick={handleClick}
            className={`
                relative p-4 rounded-md border cursor-pointer group
                transition-all duration-150
                ${isSelected
                    ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 border-[var(--color-accent)]'
                    : 'hover:shadow-float hover:border-[var(--color-accent)]/30'
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
                        ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-[var(--text-inverse)] scale-100'
                        : 'bg-[var(--bg-panel)] border-[var(--border-color)] scale-0 group-hover:scale-100'
                    }
                `}
            >
                {isSelected && <Check size={12} strokeWidth={3} />}
            </div>

            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-2 right-2 p-1 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing transition-opacity"
            >
                <GripVertical size={14} />
            </div>

            {/* Type Badge */}
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1.5 font-body">
                <TypeIcon
                    size={12}
                    className={structure !== 'single' ? 'text-[var(--text-secondary)]' : ''}
                />
                {type || 'unknown'}
            </div>

            {/* Variable Name */}
            <div
                className="font-medium text-sm truncate pr-4 text-[var(--text-primary)] font-body"
                title={name}
            >
                {name}
            </div>

            {/* Structure Badge */}
            {structure !== 'single' && (
                <div className="text-[10px] mt-2 text-[var(--text-secondary)] font-mono bg-[var(--bg-surface)] inline-block px-1 rounded">
                    {structure === 'multi' ? 'Multiple response' : 'Grid'}
                </div>
            )}

            {/* Hidden Indicator */}
            {hidden && (
                <div className="absolute bottom-2 right-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                    Hidden
                </div>
            )}
        </div>
    );
};
