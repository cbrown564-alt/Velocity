/**
 * SlideHeader Component
 * 
 * Inline-editable header for the active slide, displaying title and subtitle.
 * Click to edit, Enter/Escape or blur to commit/cancel.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { resolveSlideSubtitle, resolveSlideTitle } from '../../../core/export/resolveSlideDefaults';
import { useVelocityStore } from '../../../store';

interface SlideHeaderProps {
    className?: string;
}

export const SlideHeader: React.FC<SlideHeaderProps> = ({ className = '' }) => {
    const activeSlideId = useVelocityStore(s => s.activeSlideId);
    const slides = useVelocityStore(s => s.slides);
    const updateSlideTitle = useVelocityStore(s => s.updateSlideTitle);
    const updateSlideSubtitle = useVelocityStore(s => s.updateSlideSubtitle);
    const tableConfig = useVelocityStore(s => s.tableConfig);
    const activeFilters = useVelocityStore(s => s.activeFilters);
    const dataset = useVelocityStore(s => s.dataset);
    const variableSets = useVelocityStore(s => s.variableSets);

    const activeSlide = slides.find(s => s.id === activeSlideId);

    // Editing state
    const [editingField, setEditingField] = useState<'title' | 'subtitle' | null>(null);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when entering edit mode
    useEffect(() => {
        if (editingField && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingField]);

    const startEditing = useCallback((field: 'title' | 'subtitle') => {
        if (!activeSlide) return;
        setEditingField(field);
        setEditValue(field === 'title' ? activeSlide.title : activeSlide.subtitle);
    }, [activeSlide]);

    const commitEdit = useCallback(() => {
        if (!activeSlideId || !editingField) return;

        const trimmedValue = editValue.trim();
        if (trimmedValue) {
            if (editingField === 'title') {
                updateSlideTitle(activeSlideId, trimmedValue);
            } else {
                updateSlideSubtitle(activeSlideId, trimmedValue);
            }
        }
        setEditingField(null);
        setEditValue('');
    }, [activeSlideId, editingField, editValue, updateSlideTitle, updateSlideSubtitle]);

    const cancelEdit = useCallback(() => {
        setEditingField(null);
        setEditValue('');
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    }, [commitEdit, cancelEdit]);

    if (!activeSlide) return null;

    // Compute display values with defaults
    const variables = dataset?.variables || [];
    const weightVarLabel = dataset?.weightVariable
        ? variables.find(v => v.id === dataset.weightVariable)?.label || null
        : null;

    // Dynamic title logic: If the slide's saved title is simply the default "New Slide", 
    // it means the user hasn't explicitly renamed it yet. If they've dropped variables
    // into the workspace, we should auto-generate a descriptive title on the fly.
    const isDefaultTitleUnedited = activeSlide.title === 'New Slide';
    const hasVariablesInCanvas = tableConfig.rowVars.length > 0;

    let displayTitle = activeSlide.title;
    if (isDefaultTitleUnedited && hasVariablesInCanvas) {
        displayTitle = resolveSlideTitle(
            tableConfig.rowVars.map(id => variableSets.find(v => v.id === id)).filter(Boolean).map(v => ({
                id: v!.id,
                name: v!.name,
                label: v!.name,
            })),
            tableConfig.colVar
                ? (() => {
                    const variableSet = variableSets.find(v => v.id === tableConfig.colVar);
                    return variableSet ? { id: variableSet.id, name: variableSet.name, label: variableSet.name } : null;
                })()
                : null
        );
    } else if (!activeSlide.title) {
        // Fallback for complete empty state if needed
        displayTitle = resolveSlideTitle(
            tableConfig.rowVars.map(id => variableSets.find(v => v.id === id)).filter(Boolean).map(v => ({
                id: v!.id,
                name: v!.name,
                label: v!.name,
            })),
            tableConfig.colVar
                ? (() => {
                    const variableSet = variableSets.find(v => v.id === tableConfig.colVar);
                    return variableSet ? { id: variableSet.id, name: variableSet.name, label: variableSet.name } : null;
                })()
                : null
        );
    }

    const variableLabels = Object.fromEntries(
        (dataset?.variables ?? []).map(v => [v.id, v.label || v.name])
    );
    const displaySubtitle = activeSlide.subtitle || resolveSlideSubtitle(
        activeFilters || [],
        weightVarLabel ? { id: dataset?.weightVariable || 'weight', name: weightVarLabel, label: weightVarLabel } : null,
        dataset?.rowCount || 0,
        !!dataset?.weightVariable,
        variableLabels
    );

    return (
        <div className={`slide-header ${className}`}>
            {/* Title row */}
            <div className="flex items-center gap-2 group">
                {editingField === 'title' ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="slide-header-input slide-header-title-input"
                        placeholder="Enter title..."
                    />
                ) : (
                    <>
                        <h2
                            className="slide-header-title cursor-pointer hover:text-[var(--color-accent)] transition-colors"
                            onClick={() => startEditing('title')}
                        >
                            {displayTitle}
                        </h2>
                        <button
                            onClick={() => startEditing('title')}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--bg-hover)]"
                            title="Edit title"
                        >
                            <Pencil size={14} className="text-[var(--text-secondary)]" />
                        </button>
                    </>
                )}
            </div>

            {/* Subtitle row */}
            <div className="flex items-center gap-2 group">
                {editingField === 'subtitle' ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={handleKeyDown}
                        className="slide-header-input slide-header-subtitle-input"
                        placeholder="Enter subtitle..."
                    />
                ) : (
                    <>
                        <p
                            className="slide-header-subtitle cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                            onClick={() => startEditing('subtitle')}
                        >
                            {displaySubtitle}
                        </p>
                        <button
                            onClick={() => startEditing('subtitle')}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--bg-hover)]"
                            title="Edit subtitle"
                        >
                            <Pencil size={12} className="text-[var(--text-secondary)]" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default SlideHeader;
