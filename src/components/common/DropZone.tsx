import React from 'react';
import { motion } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { Plus, Weight, ToggleLeft, ToggleRight } from 'lucide-react';
import { VariableSet } from '../../types';
import { SortableRowShelf } from './SortableRowShelf';

interface DropZoneProps {
  id: string; // The DOM id used for collision detection
  type: 'row' | 'column' | 'weight';
  label: string;
  active: boolean; // Is the user currently dragging something globally?
  currentVariables: VariableSet[];
  onRemove: (id: string) => void;
  /** Whether weighting is currently enabled (only used for type='weight') */
  weightEnabled?: boolean;
  /** Toggle weight on/off without removing it (only used for type='weight') */
  onToggleWeight?: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({
  id,
  type,
  label,
  active,
  currentVariables,
  onRemove,
  weightEnabled,
  onToggleWeight,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  });

  const hasVariables = currentVariables.length > 0;

  // Weight type: compact inline control
  if (type === 'weight') {
    if (hasVariables) {
      const weightVar = currentVariables[0];
      return (
        <div
          ref={setNodeRef}
          data-testid={id}
          className={`
            flex items-center gap-2 min-h-[36px] px-2 py-1 rounded-md transition-all duration-200
            ${
              active
                ? 'bg-[var(--bg-surface)] border border-dashed border-[color-mix(in_srgb,var(--color-accent),transparent_70%)]'
                : 'border border-transparent'
            }
            ${
              isOver
                ? 'ring-2 ring-[color-mix(in_srgb,var(--color-accent),transparent_50%)] bg-[var(--bg-surface)] border-[var(--color-accent)]'
                : ''
            }
          `}
        >
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`
              relative flex items-center gap-2 py-1.5 px-3 rounded-md border transition-all duration-200
              ${
                weightEnabled
                  ? 'bg-[color-mix(in_srgb,var(--color-accent),transparent_92%)] border-[color-mix(in_srgb,var(--color-accent),transparent_60%)]'
                  : 'bg-[var(--bg-panel)] border-[var(--border-color)] opacity-60'
              }
            `}
          >
            <Weight
              size={13}
              className={weightEnabled ? 'text-[var(--color-accent)]' : 'text-[var(--text-secondary)]'}
            />
            <span
              className={`text-sm font-medium font-body truncate max-w-[140px] ${weightEnabled ? 'text-[var(--color-accent)]' : 'text-[var(--text-secondary)] line-through'}`}
              title={weightVar.name}
            >
              {weightVar.name}
            </span>

            {/* Toggle button */}
            {onToggleWeight && (
              <button
                onClick={onToggleWeight}
                className="ml-1 p-0.5 rounded transition-colors hover:bg-[var(--bg-active)]"
                title={weightEnabled ? 'Disable weighting' : 'Enable weighting'}
                aria-label={
                  weightEnabled ? `Disable weighting for ${weightVar.name}` : `Enable weighting for ${weightVar.name}`
                }
              >
                {weightEnabled ? (
                  <ToggleRight size={18} className="text-[var(--color-accent)]" />
                ) : (
                  <ToggleLeft size={18} className="text-[var(--text-secondary)]" />
                )}
              </button>
            )}

            {/* Remove button */}
            <button
              onClick={() => onRemove(weightVar.id)}
              className="p-1 text-[var(--text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--bg-active)] rounded-full transition-colors"
              aria-label={`Remove weight variable ${weightVar.name}`}
            >
              <svg
                width="10"
                height="10"
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
          </motion.div>
        </div>
      );
    }

    // Weight empty state: compact
    return (
      <div
        ref={setNodeRef}
        data-testid={id}
        className={`
          relative flex items-center justify-start px-3 transition-all duration-200 rounded-md border border-dashed
          ${
            isOver
              ? 'border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent),transparent_90%)] text-[var(--color-accent)]'
              : active
                ? 'border-[color-mix(in_srgb,var(--color-accent),transparent_50%)] bg-[var(--bg-surface)] text-[color-mix(in_srgb,var(--color-accent),transparent_30%)]'
                : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-color-active)] hover:bg-[var(--bg-active)]'
          }
          h-9 min-w-[160px]
        `}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <Weight
            size={14}
            className={active || isOver ? 'text-[var(--color-accent)]' : 'text-[var(--text-secondary)]'}
          />
          <span className="shelf-label text-xs font-medium uppercase tracking-widest font-mono">{label}</span>
        </div>
      </div>
    );
  }

  // Populated state: Render pills with expanded droppable area around them
  if (hasVariables) {
    // For row type, use sortable shelf with expanded container
    if (type === 'row') {
      return (
        <div
          ref={setNodeRef}
          data-testid={id}
          className={`
            w-full min-h-[52px] px-2 py-1.5 rounded-md transition-all duration-200 flex items-center
            ${
              active
                ? 'bg-[var(--bg-surface)] border-2 border-dashed border-[color-mix(in_srgb,var(--color-accent),transparent_70%)] backdrop-blur-sm'
                : 'border-2 border-transparent bg-transparent'
            }
            ${
              isOver
                ? 'ring-2 ring-[color-mix(in_srgb,var(--color-accent),transparent_50%)] bg-[var(--bg-surface)] border-[var(--color-accent)]'
                : ''
            }
          `}
        >
          <SortableRowShelf variableSets={currentVariables} onRemove={onRemove} />
        </div>
      );
    }

    // For column type, use static pills with expanded container
    return (
      <div
        ref={setNodeRef}
        data-testid={id}
        className={`
          flex flex-row flex-wrap gap-2 min-w-[120px] min-h-[40px] px-2 py-1.5 rounded-md transition-all duration-200 items-center
          ${
            active
              ? 'bg-[var(--bg-surface)] border-2 border-dashed border-[color-mix(in_srgb,var(--color-accent),transparent_70%)] backdrop-blur-sm'
              : 'border-2 border-dashed border-transparent'
          }
          ${
            isOver
              ? 'ring-2 ring-[color-mix(in_srgb,var(--color-accent),transparent_50%)] bg-[var(--bg-surface)] border-[var(--color-accent)]'
              : ''
          }
        `}
      >
        {currentVariables.map((set) => (
          <motion.div
            key={set.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex items-center justify-between p-2 pl-3 pr-2 bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-md group"
          >
            <span
              className="text-sm font-medium text-[var(--text-primary)] font-body truncate max-w-[160px]"
              title={set.name}
            >
              {set.name}
            </span>
            <button
              onClick={() => onRemove(set.id)}
              className="ml-2 p-1 text-[var(--text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--bg-active)] rounded-full transition-colors"
              aria-label={`Remove column variable ${set.name}`}
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
          </motion.div>
        ))}
      </div>
    );
  }

  // Empty state: Generous dimensions with clear visual affordance
  return (
    <div
      ref={setNodeRef}
      data-testid={id}
      className={`
        relative flex items-center justify-start px-3 transition-all duration-200 rounded-md border border-dashed
        ${
          isOver
            ? 'border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent),transparent_90%)] text-[var(--color-accent)]'
            : active
              ? 'border-[color-mix(in_srgb,var(--color-accent),transparent_50%)] bg-[var(--bg-surface)] text-[color-mix(in_srgb,var(--color-accent),transparent_30%)]'
              : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--border-color-active)] hover:bg-[var(--bg-active)]'
        }
        h-10 w-full min-w-[200px]
      `}
    >
      <div className="flex items-center gap-2 pointer-events-none">
        <Plus size={16} className={active || isOver ? 'text-[var(--color-accent)]' : 'text-[var(--text-secondary)]'} />
        <span className="shelf-label text-xs font-medium uppercase tracking-widest font-mono">{label}</span>
        <span className="text-[10px] normal-case tracking-normal text-[var(--text-tertiary)]">or ⌘K</span>
      </div>
    </div>
  );
};
