import React from 'react';
import { Plus } from 'lucide-react';

import type { Dataset } from '../../../types/dataset';
import type { VariableSet } from '../../../store';
import { DropZone } from '../../../components/common/DropZone';

export interface AnalysisShelfProps {
  focusMode: boolean;
  draggingId: string | null;
  tableConfig: { rowVars: string[]; colVar: string | null };
  variableSets: VariableSet[];
  dataset: Dataset | null;
  rememberedWeightVar: string | null;
  weightEnabled: boolean;
  onSetTableConfig: (config: Partial<{ rowVars: string[]; colVar: string | null }>) => void;
  onWeightRemove: () => void;
  onToggleWeight: () => void;
}

export const AnalysisShelf: React.FC<AnalysisShelfProps> = ({
  focusMode,
  draggingId,
  tableConfig,
  variableSets,
  dataset,
  rememberedWeightVar,
  weightEnabled,
  onSetTableConfig,
  onWeightRemove,
  onToggleWeight,
}) => (
  <div
    className={`shrink-0 surface-panel bg-[var(--bg-panel)] border-b border-[var(--border-color)] flex flex-col gap-3 shadow-xs z-0 transition-all duration-300 overflow-hidden ${focusMode ? 'h-0 py-0 opacity-0 border-none' : ''} ${!focusMode ? 'px-4 xl:px-6 py-4 opacity-100' : ''}`}
  >
    {!focusMode &&
      !draggingId &&
      tableConfig.rowVars.length === 0 &&
      !tableConfig.colVar &&
      !(dataset?.weightVariable || rememberedWeightVar) && (
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          <Plus size={14} className="text-[var(--text-secondary)]" />
          <span className="font-medium">Drag variables to rows, columns, or weight to begin</span>
        </div>
      )}
    <div
      className={`flex items-center gap-3 transition-all duration-200 ${!tableConfig.colVar && !draggingId ? 'h-0 opacity-0 overflow-hidden' : 'h-auto opacity-100'}`}
    >
      <div className="shrink-0 min-w-[4.5rem]">
        <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Columns</span>
      </div>
      <div className="flex-1 max-w-3xl">
        <DropZone
          id="drop-zone-cols"
          type="column"
          label="Drop Column Variable"
          active={!!draggingId}
          currentVariables={
            tableConfig.colVar ? [variableSets.find((s) => s.id === tableConfig.colVar)!].filter(Boolean) : []
          }
          onRemove={() => onSetTableConfig({ colVar: null })}
        />
      </div>
    </div>

    <div
      className={`flex items-center gap-3 transition-all duration-200 ${tableConfig.rowVars.length === 0 && !draggingId ? 'h-0 opacity-0 overflow-hidden' : 'h-auto opacity-100'}`}
    >
      <div className="shrink-0 min-w-[4.5rem]">
        <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Rows</span>
      </div>
      <div className="flex-1 max-w-3xl">
        <DropZone
          id="drop-zone-rows"
          type="row"
          label="Drop Row Variables"
          active={!!draggingId}
          currentVariables={
            tableConfig.rowVars.map((id) => variableSets.find((s) => s.id === id)).filter(Boolean) as VariableSet[]
          }
          onRemove={(id) => onSetTableConfig({ rowVars: tableConfig.rowVars.filter((r) => r !== id) })}
        />
      </div>

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <div className="shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Weight</span>
        </div>
        <DropZone
          id="drop-zone-weight"
          type="weight"
          label="Weight"
          active={!!draggingId}
          currentVariables={
            dataset?.weightVariable || rememberedWeightVar
              ? ([
                  variableSets.find((s) =>
                    s.variableIds.includes(dataset?.weightVariable || rememberedWeightVar || ''),
                  ),
                ].filter(Boolean) as VariableSet[])
              : []
          }
          onRemove={onWeightRemove}
          weightEnabled={weightEnabled && !!dataset?.weightVariable}
          onToggleWeight={onToggleWeight}
        />
      </div>
    </div>
  </div>
);
