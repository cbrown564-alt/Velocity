/**
 * FilterChip Component
 *
 * Displays an active filter as a removable chip.
 * Shows variable label, operator, and value label(s).
 */

import React from 'react';
import { X } from 'lucide-react';
import type { Filter, Variable } from '../../store';

interface FilterChipProps {
  filter: Filter;
  variable: Variable | undefined;
  onRemove: (filterId: string) => void;
}

/**
 * Get display text for a filter value using value labels
 */
function getValueDisplay(filter: Filter, variable: Variable | undefined): string {
  if (!variable) return String(filter.value);

  const values = Array.isArray(filter.value) ? filter.value : [filter.value];

  const labels = values.map((val) => {
    const valueLabel = variable.valueLabels.find((vl) => vl.value === val);
    return valueLabel ? valueLabel.label : String(val);
  });

  if (labels.length === 1) {
    return labels[0];
  } else if (labels.length <= 3) {
    return labels.join(', ');
  } else {
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2} more`;
  }
}

/**
 * Get operator display text
 */
function getOperatorDisplay(operator: Filter['operator']): string {
  switch (operator) {
    case 'eq':
      return '=';
    case 'neq':
      return '≠';
    case 'in':
      return '∈';
    case 'gt':
      return '>';
    case 'lt':
      return '<';
    default:
      return '=';
  }
}

export const FilterChip: React.FC<FilterChipProps> = ({ filter, variable, onRemove }) => {
  const variableLabel = variable?.label || filter.variableId;
  const valueDisplay = getValueDisplay(filter, variable);
  const operatorDisplay = getOperatorDisplay(filter.operator);

  // For 'in' operator with single value, display as '='
  const displayOperator = filter.operator === 'in' && !Array.isArray(filter.value) ? '=' : operatorDisplay;

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors"
      style={{
        backgroundColor: 'var(--bg-hover)',
        borderColor: 'var(--border-color)',
        color: 'var(--text-primary)',
      }}
    >
      <span className="truncate max-w-[120px]" title={variableLabel}>
        {variableLabel}
      </span>
      <span className="opacity-60" style={{ color: 'var(--text-secondary)' }}>
        {displayOperator}
      </span>
      <span className="truncate max-w-[150px]" title={valueDisplay}>
        {valueDisplay}
      </span>
      <button
        onClick={() => onRemove(filter.id)}
        className="p-0.5 rounded-full transition-colors hover:bg-opacity-20"
        style={{
          color: 'var(--text-tertiary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--border-color)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-tertiary)';
        }}
        aria-label={`Remove filter: ${variableLabel}`}
      >
        <X size={12} />
      </button>
    </div>
  );
};
