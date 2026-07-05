/**
 * RecipeInspector — analysis configuration as slide properties
 * (north-star screen 1-recipe). A slide *is* its recipe: Rows / Columns /
 * Filter / Weight chips plus display and significance settings live in a
 * collapsible right panel, not persistent shelf chrome.
 *
 * The chips are droppable targets with the same ids the shelf used
 * (drop-zone-rows / drop-zone-cols / drop-zone-weight), so drag insertion
 * and the ⌘K palette keep working unchanged.
 */

import React, { useEffect, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';
import { useVelocityStore } from '../../../store';
import type { VariableSet } from '../../../store';
import { variableSetMeta } from '../../../components/common/commandPaletteSearch';
import type { ComparisonMethod, CorrectionType } from '../../../store/slices/analysisSlice';
import styles from './RecipeInspector.module.css';

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, children }) => (
  <div className="mb-3.5">
    <span className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-1.5">
      {label}
    </span>
    {children}
  </div>
);

interface RecipeChipProps {
  title: string;
  subtitle?: string;
  onRemove?: () => void;
  removeLabel?: string;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  dragging?: boolean;
}

const RecipeChip: React.FC<RecipeChipProps> = ({
  title,
  subtitle,
  onRemove,
  removeLabel,
  dragHandleProps,
  dragging = false,
}) => (
  <span
    {...dragHandleProps}
    className={`group/chip relative block text-[12.5px] bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-md px-2.5 py-[7px] leading-[1.35] mb-1 touch-none select-none ${
      dragging ? 'opacity-50 cursor-grabbing' : 'cursor-grab'
    }`}
  >
    <span className="block text-[var(--text-primary)] pr-5 truncate">{title}</span>
    {subtitle && <span className="block text-[11px] text-[var(--text-tertiary)] mt-px">{subtitle}</span>}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        onPointerDown={(event) => event.stopPropagation()}
        aria-label={removeLabel ?? `Remove ${title}`}
        className="absolute top-1.5 right-1.5 p-0.5 rounded text-[var(--text-tertiary)] opacity-0 group-hover/chip:opacity-100 focus-visible:opacity-100 hover:text-[var(--text-primary)] hover:bg-[var(--bg-rail)] transition-opacity"
      >
        <X size={12} aria-hidden />
      </button>
    )}
  </span>
);

interface SortableRecipeChipProps {
  variableSet: VariableSet;
  subtitle: string;
  onRemove: () => void;
  removeLabel: string;
}

const SortableRecipeChip: React.FC<SortableRecipeChipProps> = ({ variableSet, subtitle, onRemove, removeLabel }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: variableSet.id,
    data: { variableSet, type: 'sortable-row', slot: 'row' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <RecipeChip
        title={variableSet.name}
        subtitle={subtitle}
        onRemove={onRemove}
        removeLabel={removeLabel}
        dragHandleProps={{ ...attributes, ...listeners }}
        dragging={isDragging}
      />
    </div>
  );
};

interface ColumnRecipeChipProps {
  variableSet: VariableSet;
  subtitle: string;
  onRemove: () => void;
  removeLabel: string;
}

const ColumnRecipeChip: React.FC<ColumnRecipeChipProps> = ({ variableSet, subtitle, onRemove, removeLabel }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: variableSet.id,
    data: { variableSet, type: 'recipe-chip', slot: 'column' },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div ref={setNodeRef} style={style}>
      <RecipeChip
        title={variableSet.name}
        subtitle={subtitle}
        onRemove={onRemove}
        removeLabel={removeLabel}
        dragHandleProps={{ ...attributes, ...listeners }}
        dragging={isDragging}
      />
    </div>
  );
};

const EmptyChip: React.FC<{ children: React.ReactNode; highlight?: boolean }> = ({ children, highlight }) => (
  <span
    className={`block text-[12.5px] rounded-md px-2.5 py-[7px] leading-[1.35] border border-dashed ${
      highlight
        ? 'border-[var(--border-color)] bg-[var(--bg-rail)] text-[var(--text-secondary)]'
        : 'border-[var(--border-color)] text-[var(--text-tertiary)]'
    }`}
  >
    {children}
  </span>
);

/** Droppable wrapper keyed to the legacy shelf drop-zone ids. */
const DropField: React.FC<{ id: string; dragging: boolean; rejectShake?: boolean; children: React.ReactNode }> = ({
  id,
  dragging,
  rejectShake = false,
  children,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-md transition-shadow ${rejectShake ? styles.rejectShake : ''} ${
        dragging && isOver ? 'shadow-[0_0_0_2px_var(--color-accent)]' : ''
      }`}
    >
      {children}
    </div>
  );
};

const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center justify-between py-1 text-[12.5px]">
    <span className="text-[var(--text-secondary)]">{label}</span>
    {children}
  </div>
);

const FieldAction: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-1 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
  >
    {label}
  </button>
);

const ToggleButton: React.FC<{ on: boolean; onClick: () => void; label: string }> = ({ on, onClick, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onClick}
    className={`text-[12px] font-medium px-2 py-0.5 rounded transition-colors ${
      on
        ? 'bg-[var(--bg-rail)] text-[var(--text-primary)]'
        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
    }`}
  >
    {on ? 'On' : 'Off'}
  </button>
);

export interface RecipeInspectorProps {
  open: boolean;
  weightEnabled: boolean;
  rememberedWeightVar: string | null;
  onWeightRemove: () => void;
  onToggleWeight: () => void;
}

export const RecipeInspector: React.FC<RecipeInspectorProps> = ({
  open,
  weightEnabled,
  rememberedWeightVar,
  onWeightRemove,
  onToggleWeight,
}) => {
  const tableConfig = useVelocityStore((state) => state.tableConfig);
  const setTableConfig = useVelocityStore((state) => state.setTableConfig);
  const variableSets = useVelocityStore((state) => state.variableSets);
  const dataset = useVelocityStore((state) => state.dataset);
  const activeFilters = useVelocityStore((state) => state.activeFilters);
  const removeFilter = useVelocityStore((state) => state.removeFilter);
  const openFilterModal = useVelocityStore((state) => state.openFilterModal);
  const openCommandPalette = useVelocityStore((state) => state.openCommandPalette);
  const draggingId = useVelocityStore((state) => state.draggingId);
  const recipeColumnRejectNonce = useVelocityStore((state) => state.recipeColumnRejectNonce);
  const slides = useVelocityStore((state) => state.slides);
  const activeSlideId = useVelocityStore((state) => state.activeSlideId);
  const analysisSettings = useVelocityStore((state) => state.analysisSettings);
  const updateAnalysisSettings = useVelocityStore((state) => state.updateAnalysisSettings);

  const [columnsRejectShake, setColumnsRejectShake] = useState(false);

  useEffect(() => {
    if (recipeColumnRejectNonce === 0) return;
    setColumnsRejectShake(true);
    const timer = window.setTimeout(() => setColumnsRejectShake(false), 450);
    return () => window.clearTimeout(timer);
  }, [recipeColumnRejectNonce]);

  const dragging = !!draggingId;
  // Reveal while a drag is in progress so the drop targets are reachable.
  const effectiveOpen = open || dragging;

  const slideIndex = slides.findIndex((s) => s.id === activeSlideId);
  const slideNumber = slideIndex >= 0 ? slideIndex + 1 : 1;

  const findSet = (id: string | null | undefined): VariableSet | undefined =>
    id ? variableSets.find((s) => s.id === id) : undefined;

  const rowSets = tableConfig.rowVars.map((id) => findSet(id)).filter(Boolean) as VariableSet[];
  const colSet = findSet(tableConfig.colVar);

  const weightVarId = dataset?.weightVariable || rememberedWeightVar;
  const weightSet = weightVarId ? variableSets.find((s) => s.variableIds.includes(weightVarId)) : undefined;
  const weightName =
    weightSet?.name ?? (weightVarId ? (dataset?.variables.find((v) => v.id === weightVarId)?.name ?? null) : null);

  const setSubtitle = (set: VariableSet): string => {
    if (set.structure === 'single') {
      const variable = dataset?.variables.find((v) => v.id === set.variableIds[0]);
      const categories = variable?.valueLabels?.length ?? 0;
      if (categories > 0) return `${categories} categories`;
    }
    return variableSetMeta(set);
  };

  const variableName = (id: string) => {
    const variable = dataset?.variables.find((v) => v.id === id);
    return variable?.label || variable?.name || id;
  };

  const totalRows = dataset?.rowCount;

  const comparisonLabel = analysisSettings.comparisonMethod === 'pairwise' ? 'pairwise (A/B/C)' : 'cell vs rest';
  const correctionLabel =
    analysisSettings.correctionType === 'none'
      ? null
      : analysisSettings.correctionType === 'bonferroni'
        ? 'Bonferroni'
        : 'BH (FDR)';

  return (
    <aside
      aria-label="Slide recipe"
      aria-hidden={effectiveOpen ? undefined : true}
      data-testid="recipe-inspector"
      data-open={effectiveOpen ? 'true' : 'false'}
      className={`h-full w-[280px] bg-[var(--bg-panel)] border-l ${
        effectiveOpen ? 'border-[var(--border-color-muted)]' : 'border-transparent'
      }`}
    >
      <div className="w-[280px] px-5 py-4 h-full overflow-y-auto">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-4">
          Recipe — Slide {slideNumber}
        </h2>

        <Field label="Rows">
          <DropField id="drop-zone-rows" dragging={dragging}>
            {rowSets.length > 0 ? (
              <SortableContext items={rowSets.map((set) => set.id)} strategy={verticalListSortingStrategy}>
                {rowSets.map((set) => (
                  <SortableRecipeChip
                    key={set.id}
                    variableSet={set}
                    subtitle={setSubtitle(set)}
                    onRemove={() => setTableConfig({ rowVars: tableConfig.rowVars.filter((id) => id !== set.id) })}
                    removeLabel={`Remove ${set.name} from rows`}
                  />
                ))}
              </SortableContext>
            ) : (
              <EmptyChip highlight={dragging}>Drop or ⌘K to add rows</EmptyChip>
            )}
          </DropField>
        </Field>

        <Field label="Columns">
          <DropField id="drop-zone-cols" dragging={dragging} rejectShake={columnsRejectShake}>
            {colSet ? (
              <ColumnRecipeChip
                variableSet={colSet}
                subtitle={setSubtitle(colSet)}
                onRemove={() => setTableConfig({ colVar: null })}
                removeLabel={`Remove ${colSet.name} from columns`}
              />
            ) : (
              <EmptyChip highlight={dragging}>Drop or ⌘K to add columns</EmptyChip>
            )}
          </DropField>
          {!colSet && <FieldAction label="+ Add column" onClick={() => openCommandPalette('columns')} />}
        </Field>

        <Field label="Filter">
          {activeFilters.length > 0 ? (
            activeFilters.map((filter) => (
              <RecipeChip
                key={filter.id}
                title={variableName(filter.variableId)}
                subtitle={Array.isArray(filter.value) ? `${filter.value.length} values` : String(filter.value)}
                onRemove={() => removeFilter(filter.id)}
                removeLabel={`Remove filter on ${variableName(filter.variableId)}`}
              />
            ))
          ) : (
            <EmptyChip>{totalRows ? `None — all ${totalRows.toLocaleString()}` : 'None'}</EmptyChip>
          )}
          <FieldAction label="+ Add filter" onClick={() => openFilterModal()} />
        </Field>

        <Field label="Weight">
          <DropField id="drop-zone-weight" dragging={dragging}>
            {weightName ? (
              <RecipeChip
                title={weightName}
                subtitle={dataset?.weightVariable ? 'Applied' : 'Off'}
                onRemove={onWeightRemove}
                removeLabel="Remove weight"
              />
            ) : (
              <EmptyChip highlight={dragging}>Drop or choose a numeric variable</EmptyChip>
            )}
          </DropField>
          {!weightName && <FieldAction label="+ Add weight" onClick={() => openCommandPalette('weight')} />}
          {weightName && (
            <button
              type="button"
              onClick={onToggleWeight}
              className="mt-1 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              {weightEnabled && dataset?.weightVariable ? 'Disable weight' : 'Enable weight'}
            </button>
          )}
        </Field>

        <hr
          className="border-none border-t border-[var(--border-color-muted)] my-4"
          style={{ borderTopStyle: 'solid' }}
        />

        <SettingRow label="Cell n">
          <ToggleButton
            on={!!analysisSettings.showCellN}
            onClick={() => updateAnalysisSettings({ showCellN: !analysisSettings.showCellN })}
            label="Show cell n"
          />
        </SettingRow>
        <SettingRow label="Column bases">
          <ToggleButton
            on={!!analysisSettings.showColumnBases}
            onClick={() => updateAnalysisSettings({ showColumnBases: !analysisSettings.showColumnBases })}
            label="Show column bases"
          />
        </SettingRow>
        <SettingRow label="Compare">
          <select
            value={analysisSettings.comparisonMethod}
            onChange={(e) => updateAnalysisSettings({ comparisonMethod: e.target.value as ComparisonMethod })}
            aria-label="Comparison method"
            className="text-[12px] bg-transparent text-[var(--text-secondary)] outline-none cursor-pointer text-right"
          >
            <option value="cell_vs_rest">Cell vs rest</option>
            <option value="pairwise">Pairwise (A/B/C)</option>
          </select>
        </SettingRow>
        <SettingRow label="Correction">
          <select
            value={analysisSettings.correctionType}
            onChange={(e) => updateAnalysisSettings({ correctionType: e.target.value as CorrectionType })}
            aria-label="Multiple comparison correction"
            className="text-[12px] bg-transparent text-[var(--text-secondary)] outline-none cursor-pointer text-right"
          >
            <option value="none">None</option>
            <option value="bonferroni">Bonferroni</option>
            <option value="benjamini_hochberg">BH (FDR)</option>
          </select>
        </SettingRow>
        <SettingRow label="Significance">
          <span className="text-[12px] text-[var(--text-tertiary)]">95% · {comparisonLabel}</span>
        </SettingRow>

        <p className="text-[11.5px] text-[var(--text-tertiary)] leading-[1.5] mt-3.5">
          Welch&apos;s t with Kish effective sample size{correctionLabel ? `, ${correctionLabel} corrected` : ''}. Every
          figure traces to the engine&apos;s result envelope.
        </p>
      </div>
    </aside>
  );
};
