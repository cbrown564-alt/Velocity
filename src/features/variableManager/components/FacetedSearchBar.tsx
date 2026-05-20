/**
 * FacetedSearchBar Component
 *
 * Horizontal bar with dropdown facet filters for Variable Manager.
 * Allows filtering variable sets by Type, Status, and Quality.
 *
 * Facet logic:
 * - Empty selection = no filter (all pass)
 * - Multiple selections within a facet are OR'd together
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { useVelocityStore } from '../../../store';
import type { TypeFacet, StatusFacet, QualityFacet } from '../../../store/slices/uiSlice';
import styles from './FacetedSearchBar.module.css';

// Facet option definitions
const TYPE_OPTIONS: { value: TypeFacet; label: string }[] = [
    { value: 'categorical', label: 'Category' },
    { value: 'ordered', label: 'Scale' },
    { value: 'numeric', label: 'Numeric' },
    { value: 'date', label: 'Date' },
    { value: 'text', label: 'Text' },
];

const STATUS_OPTIONS: { value: StatusFacet; label: string }[] = [
    { value: 'visible', label: 'Visible' },
    { value: 'hidden', label: 'Hidden' },
    { value: 'derived', label: 'Derived' },
];

const QUALITY_OPTIONS: { value: QualityFacet; label: string }[] = [
    { value: 'complete', label: 'Complete' },
    { value: 'incomplete', label: 'Incomplete' },
];

// Chip label mapping
const FACET_LABELS: Record<string, string> = {
    categorical: 'Category',
    ordered: 'Scale',
    nominal: 'Category',
    ordinal: 'Scale',
    scale: 'Scale',
    numeric: 'Numeric',
    date: 'Date',
    text: 'Text',
    visible: 'Visible',
    hidden: 'Hidden',
    derived: 'Derived',
    complete: 'Complete',
    incomplete: 'Incomplete',
};

interface FacetDropdownProps<T extends string> {
    label: string;
    options: { value: T; label: string }[];
    selected: T[];
    onToggle: (value: T) => void;
}

function FacetDropdown<T extends string>({
    label,
    options,
    selected,
    onToggle,
}: FacetDropdownProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    const hasSelection = selected.length > 0;

    return (
        <div className={styles.facetGroup} ref={dropdownRef}>
            <button
                className={`${styles.facetButton} ${hasSelection ? styles.facetButtonActive : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-label={`${label} filter${hasSelection ? `, ${selected.length} selected` : ''}`}
            >
                <span>{label}</span>
                {hasSelection && (
                    <span className={styles.facetCount}>{selected.length}</span>
                )}
                <ChevronDown size={12} />
            </button>

            {isOpen && (
                <div className={styles.dropdown} role="listbox" aria-label={`${label} options`}>
                    {options.map((option) => {
                        const isSelected = selected.includes(option.value);
                        return (
                            <button
                                type="button"
                                key={option.value}
                                role="option"
                                aria-selected={isSelected}
                                className={styles.dropdownItem}
                                onClick={() => onToggle(option.value)}
                            >
                                <span
                                    className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''
                                        }`}
                                >
                                    {isSelected && <Check className={styles.checkmark} />}
                                </span>
                                <span className={styles.dropdownLabel}>{option.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export const FacetedSearchBar: React.FC = () => {
    const { facetFilters, setFacetFilters, clearFacetFilters } = useVelocityStore();

    // Toggle functions for each facet type
    const toggleTypeFacet = (value: TypeFacet) => {
        const current = facetFilters.types;
        const newTypes = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value];
        setFacetFilters({ types: newTypes });
    };

    const toggleStatusFacet = (value: StatusFacet) => {
        const current = facetFilters.statuses;
        const newStatuses = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value];
        setFacetFilters({ statuses: newStatuses });
    };

    const toggleQualityFacet = (value: QualityFacet) => {
        const current = facetFilters.qualities;
        const newQualities = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value];
        setFacetFilters({ qualities: newQualities });
    };

    // Remove individual chips
    const removeTypeChip = (value: TypeFacet) => {
        setFacetFilters({ types: facetFilters.types.filter((v) => v !== value) });
    };

    const removeStatusChip = (value: StatusFacet) => {
        setFacetFilters({ statuses: facetFilters.statuses.filter((v) => v !== value) });
    };

    const removeQualityChip = (value: QualityFacet) => {
        setFacetFilters({ qualities: facetFilters.qualities.filter((v) => v !== value) });
    };

    // Check if any filters are active
    const hasActiveFilters =
        facetFilters.types.length > 0 ||
        facetFilters.statuses.length > 0 ||
        facetFilters.qualities.length > 0;

    // Collect all active chips
    const allChips: { key: string; label: string; onRemove: () => void }[] = [
        ...facetFilters.types.map((v) => ({
            key: `type-${v}`,
            label: FACET_LABELS[v],
            onRemove: () => removeTypeChip(v),
        })),
        ...facetFilters.statuses.map((v) => ({
            key: `status-${v}`,
            label: FACET_LABELS[v],
            onRemove: () => removeStatusChip(v),
        })),
        ...facetFilters.qualities.map((v) => ({
            key: `quality-${v}`,
            label: FACET_LABELS[v],
            onRemove: () => removeQualityChip(v),
        })),
    ];

    return (
        <div className={styles.container}>
            {/* Facet Dropdowns */}
            <FacetDropdown
                label="Type"
                options={TYPE_OPTIONS}
                selected={facetFilters.types}
                onToggle={toggleTypeFacet}
            />
            <FacetDropdown
                label="Status"
                options={STATUS_OPTIONS}
                selected={facetFilters.statuses}
                onToggle={toggleStatusFacet}
            />
            <FacetDropdown
                label="Quality"
                options={QUALITY_OPTIONS}
                selected={facetFilters.qualities}
                onToggle={toggleQualityFacet}
            />

            {/* Separator and Chips (only show when filters active) */}
            {hasActiveFilters && (
                <>
                    <div className={styles.separator} />
                    <div className={styles.chips}>
                        {allChips.map((chip) => (
                            <span key={chip.key} className={styles.chip}>
                                {chip.label}
                                <button
                                    className={styles.chipRemove}
                                    onClick={chip.onRemove}
                                    aria-label={`Remove ${chip.label} filter`}
                                >
                                    <X size={10} />
                                </button>
                            </span>
                        ))}
                    </div>
                    <button className={styles.clearAll} onClick={clearFacetFilters}>
                        Clear all
                    </button>
                </>
            )}
        </div>
    );
};
