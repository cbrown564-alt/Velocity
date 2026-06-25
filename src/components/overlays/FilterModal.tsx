/**
 * FilterModal Component
 * 
 * Modal for creating filters. Two-step flow:
 * 1. Select a variable from searchable list
 * 2. Select values to include (multi-select checkboxes)
 */

import React, { useState, useMemo } from 'react';
import { X, Search, ChevronLeft, Check } from 'lucide-react';
import { useVelocityStore, type Variable, type Filter } from '../../store';
import { Loader2 } from 'lucide-react';
import { isCategoricalType, isOrderedType } from '../../types';
import { ModalShell } from './ModalShell';

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    variables: Variable[];
    onSave: (filter: Omit<Filter, 'id'>, applyToAll: boolean) => void;
}

type Step = 'variable' | 'values';

export const FilterModal: React.FC<FilterModalProps> = ({
    isOpen,
    onClose,
    variables,
    onSave,
}) => {
    const [step, setStep] = useState<Step>('variable');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedVariable, setSelectedVariable] = useState<Variable | null>(null);
    const [selectedValues, setSelectedValues] = useState<number[] | string[]>([]);

    // New state for async values
    const [availableValues, setAvailableValues] = useState<{ value: string | number; label: string }[]>([]);
    const [loadingValues, setLoadingValues] = useState(false);
    const [applyToAll, setApplyToAll] = useState(false);
    const valuesRequestIdRef = React.useRef(0);

    const getUniqueValues = useVelocityStore(state => state.getUniqueValues);
    const getVariableStats = useVelocityStore(state => state.getVariableStats);

    // Filter variables based on search (only show categoricals with value labels)
    const filteredVariables = useMemo(() => {
        const categoricalVars = variables.filter(v =>
            isCategoricalType(v.type) || isOrderedType(v.type) || v.valueLabels.length > 0
        );

        if (!searchQuery.trim()) return categoricalVars;

        const query = searchQuery.toLowerCase();
        return categoricalVars.filter(v =>
            v.label.toLowerCase().includes(query) ||
            v.name.toLowerCase().includes(query)
        );
    }, [variables, searchQuery]);

    // Reset state when modal closes
    const handleClose = () => {
        setStep('variable');
        setSearchQuery('');
        setSelectedVariable(null);
        setSelectedValues([]);
        setAvailableValues([]);
        onClose();
    };

    const handleVariableSelect = (variable: Variable) => {
        setSelectedVariable(variable);
        setSelectedValues([]);
        setStep('values');
    };

    // Effect to load values when step changes to 'values'
    React.useEffect(() => {
        if (step === 'values' && selectedVariable) {
            const requestId = valuesRequestIdRef.current + 1;
            valuesRequestIdRef.current = requestId;
            const loadValues = async () => {
                setLoadingValues(true);
                setAvailableValues([]);
                try {
                    // Check if we have embedded labels (SAV)
                    if (selectedVariable.valueLabels && selectedVariable.valueLabels.length > 0) {
                        const embeddedValues = selectedVariable.valueLabels.map((entry) => ({
                            value: String(entry.value),
                            label: entry.label,
                        }));
                        if (valuesRequestIdRef.current === requestId) {
                            setAvailableValues(embeddedValues);
                        }
                    } else {
                        // Otherwise fetch from DB (CSV)
                        let values = await getUniqueValues(selectedVariable.id);
                        if (values.length === 0) {
                            const stats = await getVariableStats(selectedVariable.id);
                            values = (stats?.frequencies ?? [])
                                .map((freq) => freq.value)
                                .filter((value): value is string | number => value !== null)
                                .map((value) => String(value));
                        }
                        const uniqueValues = [...new Set(values)];
                        if (valuesRequestIdRef.current === requestId) {
                            setAvailableValues(uniqueValues.map(v => ({ value: v, label: v })));
                        }
                    }
                } catch (e) {
                    console.error("Failed to load unique values", e);
                } finally {
                    if (valuesRequestIdRef.current === requestId) {
                        setLoadingValues(false);
                    }
                }
            };
            loadValues();
        }
    }, [step, selectedVariable, getUniqueValues, getVariableStats]);

    const handleValueToggle = (value: number | string) => {
        setSelectedValues(prev =>
            (prev as any[]).includes(value)
                ? prev.filter(v => v !== value)
                : [...prev, value] as any
        );
    };

    const handleApply = () => {
        if (!selectedVariable || selectedValues.length === 0) return;

        onSave({
            variableId: selectedVariable.id,
            operator: selectedValues.length === 1 ? 'eq' : 'in',
            value: (selectedValues.length === 1 ? selectedValues[0] : selectedValues) as any,
        }, applyToAll);

        handleClose();
    };

    const handleBack = () => {
        setStep('variable');
        setSelectedValues([]);
        setAvailableValues([]);
    };

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={handleClose}
            layout="unified"
            escapeToClose
            unmountWhenClosed
            backdropClassName="fixed inset-0 bg-[var(--text-primary)]/30 backdrop-blur-sm z-50 flex items-center justify-center"
            panelClassName="w-full max-w-md rounded-lg overflow-hidden shadow-2xl"
            panelStyle={{
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                backdropFilter: 'blur(16px)',
            }}
        >
                    {/* Header */}
                    <div
                        className="flex items-center justify-between px-5 py-4 border-b"
                        style={{ borderColor: 'var(--border-color)' }}
                    >
                        <div className="flex items-center gap-3">
                            {step === 'values' && (
                                <button
                                    onClick={handleBack}
                                    aria-label="Back to variable selection"
                                    className="p-1 rounded-md transition-colors"
                                    style={{ color: 'var(--text-secondary)' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                            )}
                            <h2
                                className="text-lg font-semibold"
                                style={{
                                    fontFamily: 'var(--font-display)',
                                    color: 'var(--text-primary)',
                                }}
                            >
                                {step === 'variable' ? 'Add Filter' : selectedVariable?.label}
                            </h2>
                        </div>
                        <button
                            onClick={handleClose}
                            aria-label="Close filter modal"
                            className="p-1.5 rounded-md transition-colors"
                            style={{ color: 'var(--text-secondary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                        {step === 'variable' ? (
                            <>
                                {/* Search */}
                                <div className="relative mb-4">
                                    <Search
                                        className="absolute left-3 top-1/2 -translate-y-1/2"
                                        size={16}
                                        style={{ color: 'var(--text-secondary)' }}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Search variables..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-md text-sm outline-none transition-all font-body"
                                        style={{
                                            backgroundColor: 'var(--bg-app)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--text-primary)',
                                        }}
                                        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                                        autoFocus
                                    />
                                </div>

                                {/* Variable List */}
                                <div
                                    className="max-h-64 overflow-y-auto custom-scrollbar space-y-1"
                                >
                                    {filteredVariables.length === 0 ? (
                                        <p
                                            className="text-sm text-center py-8"
                                            style={{ color: 'var(--text-tertiary)' }}
                                        >
                                            No categorical variables found
                                        </p>
                                    ) : (
                                        filteredVariables.map(variable => (
                                            <button
                                                key={variable.id}
                                                onClick={() => handleVariableSelect(variable)}
                                                className="w-full text-left px-3 py-2.5 rounded-md transition-colors"
                                                style={{ color: 'var(--text-primary)' }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-active)'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <p className="text-sm font-medium truncate">{variable.label}</p>
                                                <p
                                                    className="text-xs truncate font-mono"
                                                    style={{ color: 'var(--text-secondary)' }}
                                                >
                                                    {variable.name} • {variable.valueLabels.length > 0 ? `${variable.valueLabels.length} values` : variable.type}
                                                </p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Value List */}
                                <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                                    {loadingValues ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-[var(--text-tertiary)] gap-2">
                                            <Loader2 className="animate-spin" size={20} />
                                            <span className="text-sm">Loading values...</span>
                                        </div>
                                    ) : availableValues.length === 0 ? (
                                        <p className="text-sm text-center py-8 text-[var(--text-tertiary)]">
                                            No values found
                                        </p>
                                    ) : (
                                        availableValues.map(vl => {
                                            const isSelected = (selectedValues as any[]).includes(vl.value);
                                            return (
                                                <button
                                                    key={vl.value}
                                                    onClick={() => handleValueToggle(vl.value)}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors group"
                                                    style={{
                                                        backgroundColor: isSelected ? 'var(--bg-active)' : 'transparent',
                                                        color: 'var(--text-primary)',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-panel)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                                    }}
                                                >
                                                    <div
                                                        className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0"
                                                        style={{
                                                            borderColor: isSelected ? 'var(--color-accent)' : 'var(--border-color)',
                                                            backgroundColor: isSelected ? 'var(--color-accent)' : 'transparent',
                                                        }}
                                                    >
                                                        {isSelected && <Check size={12} color="var(--text-inverse)" strokeWidth={3} />}
                                                    </div>
                                                    <span className="text-sm truncate text-left">{vl.label}</span>
                                                    <span
                                                        className="text-xs ml-auto shrink-0 font-mono"
                                                        style={{ color: 'var(--text-secondary)' }}
                                                    >
                                                        ({vl.value})
                                                    </span>
                                                </button>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Apply Button */}
                                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                                    <button
                                        onClick={handleApply}
                                        disabled={selectedValues.length === 0}
                                        className="w-full py-2.5 rounded-md text-sm font-medium transition-all shadow-md active:scale-[0.98]"
                                        style={{
                                            backgroundColor: selectedValues.length > 0 ? 'var(--color-accent)' : 'var(--bg-active)',
                                            color: selectedValues.length > 0 ? 'var(--text-inverse)' : 'var(--text-secondary)',
                                            cursor: selectedValues.length > 0 ? 'pointer' : 'not-allowed',
                                            boxShadow: selectedValues.length > 0 ? '0 0 15px color-mix(in srgb, var(--color-accent), transparent 80%)' : 'none',
                                        }}
                                    >
                                        Apply Filter ({selectedValues.length} selected)
                                    </button>
                                </div>

                                {/* Apply to All Slides Toggle */}
                                <div className="mt-4 flex items-center gap-2 px-1 pb-2">
                                    <input
                                        type="checkbox"
                                        id="applyAll"
                                        checked={applyToAll}
                                        onChange={(e) => setApplyToAll(e.target.checked)}
                                        className="w-4 h-4 rounded appearance-none border-2 checked:bg-[var(--color-accent)] checked:border-[var(--color-accent)] transition-colors cursor-pointer relative"
                                        style={{
                                            borderColor: applyToAll ? 'var(--color-accent)' : 'var(--border-color)',
                                            backgroundColor: applyToAll ? 'var(--color-accent)' : 'transparent',
                                        }}
                                    />
                                    <label htmlFor="applyAll" className="text-sm font-medium select-none cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                                        Apply to all slides in deck
                                    </label>
                                </div>
                            </>
                        )}
                    </div>
        </ModalShell>
    );
};
