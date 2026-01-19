/**
 * FilterBar Component
 * 
 * Displays active filters and provides "Add Filter" button.
 * Uses FilterChip for each active filter.
 */

import React from 'react';
import { Plus } from 'lucide-react';
import { FilterChip } from './FilterChip';
import type { Filter, Variable } from '../../store';

interface FilterBarProps {
    filters: Filter[];
    variables: Variable[];
    onAddFilter: () => void;
    onRemoveFilter: (filterId: string) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
    filters,
    variables,
    onAddFilter,
    onRemoveFilter,
}) => {
    return (
        <div
            className="h-12 border-b flex items-center px-6 gap-3 shrink-0 z-10"
            style={{
                borderColor: 'var(--gray-200)',
                backgroundColor: 'var(--color-parchment)',
            }}
        >
            {/* Add Filter Button */}
            <button
                onClick={onAddFilter}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-dashed rounded-full transition-colors group"
                style={{
                    borderColor: 'var(--gray-300)',
                    color: 'var(--gray-600)',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-terracotta)';
                    e.currentTarget.style.color = 'var(--color-terracotta)';
                    e.currentTarget.style.backgroundColor = 'rgba(224, 122, 95, 0.05)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--gray-300)';
                    e.currentTarget.style.color = 'var(--gray-600)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
                <Plus size={14} />
                Add Filter
            </button>

            {/* Active Filters */}
            {filters.map(filter => (
                <FilterChip
                    key={filter.id}
                    filter={filter}
                    variable={variables.find(v => v.id === filter.variableId)}
                    onRemove={onRemoveFilter}
                />
            ))}

            {/* Filter count indicator when many filters */}
            {filters.length > 0 && (
                <span
                    className="text-xs ml-auto"
                    style={{ color: 'var(--gray-400)' }}
                >
                    {filters.length} filter{filters.length !== 1 ? 's' : ''} active
                </span>
            )}
        </div>
    );
};
