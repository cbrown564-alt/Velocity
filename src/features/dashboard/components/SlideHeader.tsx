/**
 * SlideHeader Component
 *
 * Inline-editable header for the active slide, displaying title and subtitle.
 * Click to edit, Enter/Escape or blur to commit/cancel.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Sparkles } from 'lucide-react';
import { computeAnalysisSampleSize } from '../../../core/analysis/computeAnalysisSampleSize';
import { generateNarrativeTitleFromRows } from '../../../core/analysis/generateNarrativeTitleFromRows';
import { resolveSlideSubtitle, resolveSlideTitle } from '../../../core/export/resolveSlideDefaults';
import { useVelocityStore } from '../../../store';

interface SlideHeaderProps {
  className?: string;
}

export const SlideHeader: React.FC<SlideHeaderProps> = ({ className = '' }) => {
  const activeSlideId = useVelocityStore((s) => s.activeSlideId);
  const slides = useVelocityStore((s) => s.slides);
  const updateSlideTitle = useVelocityStore((s) => s.updateSlideTitle);
  const updateSlideSubtitle = useVelocityStore((s) => s.updateSlideSubtitle);
  const tableConfig = useVelocityStore((s) => s.tableConfig);
  const activeFilters = useVelocityStore((s) => s.activeFilters);
  const dataset = useVelocityStore((s) => s.dataset);
  const variableSets = useVelocityStore((s) => s.variableSets);
  const queryResult = useVelocityStore((s) => s.queryResult);
  const tableStats = useVelocityStore((s) => s.tableStats);
  const isWeighted = useVelocityStore((s) => !!s.dataset?.weightVariable);

  const activeSlide = slides.find((s) => s.id === activeSlideId);

  // Editing state
  const [editingField, setEditingField] = useState<'title' | 'subtitle' | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Story Shelf: narrative suggestion state
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [suggestionVisible, setSuggestionVisible] = useState(false);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingField && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingField]);

  // Story Shelf: auto-dismiss suggestion after 8 seconds (long enough to notice; VP-D-022)
  useEffect(() => {
    if (!suggestionVisible) return;
    const timer = setTimeout(() => setSuggestionVisible(false), 8000);
    return () => clearTimeout(timer);
  }, [suggestionVisible]);

  // Allow a fresh suggestion when slide or analysis configuration changes
  useEffect(() => {
    setSuggestionDismissed(false);
  }, [activeSlideId, tableConfig.rowVars, tableConfig.colVar]);

  const variables = useMemo(() => dataset?.variables ?? [], [dataset?.variables]);

  const isDefaultTitleUnedited = activeSlide?.title === 'New Slide';
  const hasVariablesInCanvas = tableConfig.rowVars.length > 0;

  const suggestedTitle = useMemo(() => {
    if (!activeSlide || !isDefaultTitleUnedited || !hasVariablesInCanvas || !queryResult || queryResult.length === 0) {
      return null;
    }
    const rowVarSet = variableSets.find((v) => v.id === tableConfig.rowVars[0]);
    const colVarSet = tableConfig.colVar ? variableSets.find((v) => v.id === tableConfig.colVar) : null;
    const rowVarLabel = rowVarSet?.name || 'Variable';
    const colVarLabel = colVarSet?.name || null;

    const rowVar = variables.find((v) => v.id === rowVarSet?.variableIds[0]);
    const colVar = tableConfig.colVar
      ? variables.find((v) => {
          const colSet = variableSets.find((vs) => vs.id === tableConfig.colVar);
          return v.id === colSet?.variableIds[0];
        })
      : null;

    const valueLabelMap = (varObj: typeof rowVar) => {
      const map = new Map<string, string>();
      if (varObj?.valueLabels) {
        for (const vl of varObj.valueLabels) {
          map.set(String(vl.value), vl.label);
        }
      }
      return map;
    };

    const rowLabelMap = valueLabelMap(rowVar);
    const colLabelMap = valueLabelMap(colVar);

    return generateNarrativeTitleFromRows(queryResult, tableStats, rowVarLabel, colVarLabel, {
      rowLabel: (k) => rowLabelMap.get(k) || null,
      colLabel: (k) => colLabelMap.get(k) || null,
    });
  }, [
    activeSlide,
    isDefaultTitleUnedited,
    hasVariablesInCanvas,
    queryResult,
    tableStats,
    tableConfig.rowVars,
    tableConfig.colVar,
    variableSets,
    variables,
  ]);

  useEffect(() => {
    if (suggestedTitle && !suggestionDismissed) {
      setSuggestionVisible(true);
    }
  }, [suggestedTitle, suggestionDismissed]);

  const startEditing = useCallback(
    (field: 'title' | 'subtitle') => {
      if (!activeSlide) return;
      setEditingField(field);
      setEditValue(field === 'title' ? activeSlide.title : activeSlide.subtitle);
      if (field === 'title') {
        setSuggestionVisible(false);
        setSuggestionDismissed(true);
      }
    },
    [activeSlide],
  );

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
    setSuggestionDismissed(true);
  }, [activeSlideId, editingField, editValue, updateSlideTitle, updateSlideSubtitle]);

  const cancelEdit = useCallback(() => {
    setEditingField(null);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      }
    },
    [commitEdit, cancelEdit],
  );

  if (!activeSlide) return null;

  const weightVarLabel = dataset?.weightVariable
    ? variables.find((v) => v.id === dataset.weightVariable)?.label || null
    : null;

  // Dynamic title logic: If the slide's saved title is simply the default "New Slide",
  // it means the user hasn't explicitly renamed it yet. If they've dropped variables
  // into the workspace, we should auto-generate a descriptive title on the fly.

  let displayTitle = activeSlide.title;
  if (isDefaultTitleUnedited && hasVariablesInCanvas) {
    displayTitle = resolveSlideTitle(
      tableConfig.rowVars
        .map((id) => variableSets.find((v) => v.id === id))
        .filter(Boolean)
        .map((v) => ({
          id: v!.id,
          name: v!.name,
          label: v!.name,
        })),
      tableConfig.colVar
        ? (() => {
            const variableSet = variableSets.find((v) => v.id === tableConfig.colVar);
            return variableSet ? { id: variableSet.id, name: variableSet.name, label: variableSet.name } : null;
          })()
        : null,
    );
  } else if (!activeSlide.title) {
    // Fallback for complete empty state if needed
    displayTitle = resolveSlideTitle(
      tableConfig.rowVars
        .map((id) => variableSets.find((v) => v.id === id))
        .filter(Boolean)
        .map((v) => ({
          id: v!.id,
          name: v!.name,
          label: v!.name,
        })),
      tableConfig.colVar
        ? (() => {
            const variableSet = variableSets.find((v) => v.id === tableConfig.colVar);
            return variableSet ? { id: variableSet.id, name: variableSet.name, label: variableSet.name } : null;
          })()
        : null,
    );
  }

  const variableLabels = Object.fromEntries((dataset?.variables ?? []).map((v) => [v.id, v.label || v.name]));

  const filteredSampleSize = computeAnalysisSampleSize(queryResult, { isWeighted });
  const respondentCount = filteredSampleSize ?? dataset?.rowCount ?? 0;

  const displaySubtitle =
    activeSlide.subtitle ||
    resolveSlideSubtitle(
      activeFilters || [],
      weightVarLabel ? { id: dataset?.weightVariable || 'weight', name: weightVarLabel, label: weightVarLabel } : null,
      respondentCount,
      !!dataset?.weightVariable,
      variableLabels,
    );

  return (
    <div className={`slide-header ${className}`}>
      {/* Title row */}
      <div className="relative flex items-center gap-2 group pr-8">
        {editingField === 'title' ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            className="slide-header-input slide-header-title-input"
            placeholder="Enter title..."
          />
        ) : (
          <>
            <h2
              className="slide-header-title cursor-pointer hover:text-[var(--text-primary)] transition-colors"
              onClick={() => startEditing('title')}
            >
              {displayTitle}
            </h2>
            <button
              onClick={() => startEditing('title')}
              className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--bg-hover)]"
              title="Edit title"
            >
              <Pencil size={14} className="text-[var(--text-secondary)]" />
            </button>
            {suggestionVisible && suggestedTitle && (
              <motion.button
                data-testid="story-shelf-suggestion"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                onClick={() => {
                  if (activeSlideId) {
                    updateSlideTitle(activeSlideId, suggestedTitle);
                    setSuggestionVisible(false);
                    setSuggestionDismissed(true);
                  }
                }}
                className="ml-2 flex items-center gap-1 text-[var(--text-secondary)] italic text-sm hover:text-[var(--color-accent)] transition-colors"
                title="Click to use suggested title"
              >
                <Sparkles size={12} />
                <span className="hidden sm:inline">{suggestedTitle}</span>
              </motion.button>
            )}
          </>
        )}
      </div>

      {/* Subtitle row */}
      <div className="relative flex items-center gap-2 group pr-7">
        {editingField === 'subtitle' ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
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
              className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--bg-hover)]"
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
