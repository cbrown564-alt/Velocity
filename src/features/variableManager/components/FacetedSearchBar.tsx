/**
 * FacetedSearchBar Component — Smart Facets (Phase 1 Back-Room Delight)
 *
 * Transforms passive dropdown filters into actionable insight cards:
 * - Type: always-visible distribution mini-bar; click a bar to filter
 * - Quality: count badge with batch-fix suggestions
 * - Status: count badge with one-click "Unhide all" action
 *
 * Keeps existing chip/clear-all behaviour and facet filter state contract.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Wand2, Eye, EyeOff } from 'lucide-react';
import { useVelocityStore } from '../../../store';
import type { TypeFacet, StatusFacet, QualityFacet } from '../../../store/slices/uiSlice';
import { normalizeVariableType, isCategoricalType, type CanonicalVariableType } from '../../../types';
import styles from './FacetedSearchBar.module.css';

// ============================================================================
// Type Distribution Mini-Bar
// ============================================================================

const TYPE_ORDER: { value: CanonicalVariableType; label: string }[] = [
    { value: 'categorical', label: 'Cat' },
    { value: 'ordered',     label: 'Scale' },
    { value: 'numeric',     label: 'Num' },
    { value: 'date',        label: 'Date' },
    { value: 'text',        label: 'Text' },
];

function TypeDistributionBar({
    counts,
    selected,
    onToggle,
}: {
    counts: Record<CanonicalVariableType, number>;
    selected: TypeFacet[];
    onToggle: (value: TypeFacet) => void;
}) {
    const maxCount = Math.max(...TYPE_ORDER.map((t) => counts[t.value]), 1);

    return (
        <div className={styles.typeFacet}>
            <span className={styles.facetLabel}>Type</span>
            <div className={styles.typeBars}>
                {TYPE_ORDER.map((type) => {
                    const count = counts[type.value];
                    const isActive = selected.includes(type.value);
                    const heightPercent = count > 0 ? Math.max(20, (count / maxCount) * 100) : 8;

                    return (
                        <button
                            key={type.value}
                            type="button"
                            className={`${styles.typeBar} ${isActive ? styles.typeBarActive : ''} ${count === 0 ? styles.typeBarEmpty : ''}`}
                            onClick={() => onToggle(type.value as TypeFacet)}
                            title={`${type.label}: ${count} variable${count !== 1 ? 's' : ''}`}
                            aria-pressed={isActive}
                        >
                            <span
                                className={styles.typeBarFill}
                                style={{ height: `${heightPercent}%` }}
                            />
                            <span className={styles.typeBarLabel}>{type.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ============================================================================
// Quality Insight Card
// ============================================================================

function QualityInsight({
    incompleteCount,
    unlabeledCount,
    selected,
    onToggle,
}: {
    incompleteCount: number;
    unlabeledCount: number;
    selected: QualityFacet[];
    onToggle: (value: QualityFacet) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    const hasIssues = incompleteCount > 0 || unlabeledCount > 0;
    const isActive = selected.length > 0;

    return (
        <div className={styles.facetGroup} ref={dropdownRef}>
            <button
                className={`${styles.insightButton} ${isActive ? styles.insightButtonActive : ''} ${hasIssues ? styles.insightButtonAttention : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={styles.facetLabel}>Quality</span>
                {hasIssues ? (
                    <span className={styles.insightBadge}>
                        {incompleteCount + unlabeledCount}
                    </span>
                ) : (
                    <span className={styles.insightOk}>OK</span>
                )}
                <ChevronDown size={12} />
            </button>

            {isOpen && (
                <div className={styles.insightDropdown} role="listbox" aria-label="Quality options">
                    {/* Filter toggle */}
                    <button
                        type="button"
                        role="option"
                        aria-selected={selected.includes('incomplete')}
                        className={styles.dropdownItem}
                        onClick={() => onToggle('incomplete')}
                    >
                        <span className={`${styles.checkbox} ${selected.includes('incomplete') ? styles.checkboxChecked : ''}`}>
                            {selected.includes('incomplete') && <Check className={styles.checkmark} />}
                        </span>
                        <span className={styles.dropdownLabel}>Incomplete data</span>
                        {incompleteCount > 0 && (
                            <span className={styles.dropdownCount}>{incompleteCount}</span>
                        )}
                    </button>

                    <button
                        type="button"
                        role="option"
                        aria-selected={selected.includes('complete')}
                        className={styles.dropdownItem}
                        onClick={() => onToggle('complete')}
                    >
                        <span className={`${styles.checkbox} ${selected.includes('complete') ? styles.checkboxChecked : ''}`}>
                            {selected.includes('complete') && <Check className={styles.checkmark} />}
                        </span>
                        <span className={styles.dropdownLabel}>Complete data</span>
                    </button>

                    {/* Batch-fix suggestions */}
                    {incompleteCount > 0 && (
                        <div className={styles.suggestionItem}>
                            <Wand2 size={12} />
                            <span>{incompleteCount} variable{incompleteCount !== 1 ? 's' : ''} with missing values — review in Inspector</span>
                        </div>
                    )}
                    {unlabeledCount > 0 && (
                        <div className={styles.suggestionItem}>
                            <Wand2 size={12} />
                            <span>{unlabeledCount} variable{unlabeledCount !== 1 ? 's' : ''} missing value labels</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Status Insight Card
// ============================================================================

function StatusInsight({
    hiddenCount,
    derivedCount,
    selected,
    onToggle,
    onUnhideAll,
}: {
    hiddenCount: number;
    derivedCount: number;
    selected: StatusFacet[];
    onToggle: (value: StatusFacet) => void;
    onUnhideAll: () => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    const isActive = selected.length > 0;

    return (
        <div className={styles.facetGroup} ref={dropdownRef}>
            <button
                className={`${styles.insightButton} ${isActive ? styles.insightButtonActive : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={styles.facetLabel}>Status</span>
                {hiddenCount > 0 && (
                    <span className={`${styles.insightBadge} ${styles.insightBadgeMuted}`}>
                        <EyeOff size={10} />
                        {hiddenCount}
                    </span>
                )}
                <ChevronDown size={12} />
            </button>

            {isOpen && (
                <div className={styles.insightDropdown} role="listbox" aria-label="Status options">
                    {['visible', 'hidden', 'derived'] .map((status) => {
                        const count = status === 'hidden' ? hiddenCount : status === 'derived' ? derivedCount : undefined;
                        return (
                            <button
                                key={status}
                                type="button"
                                role="option"
                                aria-selected={selected.includes(status as StatusFacet)}
                                className={styles.dropdownItem}
                                onClick={() => onToggle(status as StatusFacet)}
                            >
                                <span className={`${styles.checkbox} ${selected.includes(status as StatusFacet) ? styles.checkboxChecked : ''}`}>
                                    {selected.includes(status as StatusFacet) && <Check className={styles.checkmark} />}
                                </span>
                                <span className={styles.dropdownLabel}>
                                    {status === 'visible' ? 'Visible' : status === 'hidden' ? 'Hidden' : 'Derived'}
                                </span>
                                {count !== undefined && (
                                    <span className={styles.dropdownCount}>{count}</span>
                                )}
                            </button>
                        );
                    })}

                    {hiddenCount > 0 && (
                        <button
                            type="button"
                            className={styles.actionItem}
                            onClick={() => {
                                onUnhideAll();
                                setIsOpen(false);
                            }}
                        >
                            <Eye size={12} />
                            <span>Unhide all {hiddenCount} hidden</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

export const FacetedSearchBar: React.FC = () => {
    const {
        variableSets,
        dataset,
        facetFilters,
        setFacetFilters,
        clearFacetFilters,
        variableStats,
        bulkHide,
    } = useVelocityStore();

    // ------------------------------------------------------------------------
    // Insight computations
    // ------------------------------------------------------------------------

    const visibleVariableSets = useMemo(
        () => variableSets,
        [variableSets]
    );

    const typeCounts = useMemo(() => {
        const counts: Record<CanonicalVariableType, number> = {
            categorical: 0,
            ordered: 0,
            numeric: 0,
            date: 0,
            text: 0,
        };
        visibleVariableSets.forEach((vs) => {
            const type = normalizeVariableType(vs.type || 'categorical');
            counts[type] = (counts[type] ?? 0) + 1;
        });
        return counts;
    }, [visibleVariableSets]);

    const { incompleteCount, unlabeledCount, hiddenCount, derivedCount } = useMemo(() => {
        let incomplete = 0;
        let unlabeled = 0;
        let hidden = 0;
        let derived = 0;

        visibleVariableSets.forEach((vs) => {
            if (vs.hidden) hidden++;
            if (vs.derived) derived++;

            if (vs.variableIds.length === 1) {
                const stats = variableStats[vs.variableIds[0]];
                if (stats) {
                    const missingPercent = stats.totalCount > 0
                        ? (stats.missingCount / stats.totalCount) * 100
                        : 0;
                    if (missingPercent > 0) incomplete++;
                }

                const variable = dataset?.variables.find((v) => v.id === vs.variableIds[0]);
                if (variable) {
                    const hasLabels = (variable.valueLabels?.length ?? 0) > 0;
                    const hasCodes = variable.type !== 'text' && variable.type !== 'date';
                    if (hasCodes && !hasLabels) unlabeled++;
                }
            }
        });

        return { incompleteCount: incomplete, unlabeledCount: unlabeled, hiddenCount: hidden, derivedCount: derived };
    }, [visibleVariableSets, variableStats, dataset]);

    // ------------------------------------------------------------------------
    // Toggle actions
    // ------------------------------------------------------------------------

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

    const handleUnhideAll = () => {
        const hiddenIds = visibleVariableSets.filter((vs) => vs.hidden).map((vs) => vs.id);
        if (hiddenIds.length > 0) {
            bulkHide(hiddenIds, false);
        }
    };

    // ------------------------------------------------------------------------
    // Active chips (retained from original)
    // ------------------------------------------------------------------------

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

    const hasActiveFilters =
        facetFilters.types.length > 0 ||
        facetFilters.statuses.length > 0 ||
        facetFilters.qualities.length > 0;

    const allChips: { key: string; label: string; onRemove: () => void }[] = [
        ...facetFilters.types.map((v) => ({
            key: `type-${v}`,
            label: FACET_LABELS[v],
            onRemove: () => setFacetFilters({ types: facetFilters.types.filter((t) => t !== v) }),
        })),
        ...facetFilters.statuses.map((v) => ({
            key: `status-${v}`,
            label: FACET_LABELS[v],
            onRemove: () => setFacetFilters({ statuses: facetFilters.statuses.filter((s) => s !== v) }),
        })),
        ...facetFilters.qualities.map((v) => ({
            key: `quality-${v}`,
            label: FACET_LABELS[v],
            onRemove: () => setFacetFilters({ qualities: facetFilters.qualities.filter((q) => q !== v) }),
        })),
    ];

    return (
        <div className={styles.container}>
            {/* Smart Facets */}
            <TypeDistributionBar
                counts={typeCounts}
                selected={facetFilters.types}
                onToggle={toggleTypeFacet}
            />

            <QualityInsight
                incompleteCount={incompleteCount}
                unlabeledCount={unlabeledCount}
                selected={facetFilters.qualities}
                onToggle={toggleQualityFacet}
            />

            <StatusInsight
                hiddenCount={hiddenCount}
                derivedCount={derivedCount}
                selected={facetFilters.statuses}
                onToggle={toggleStatusFacet}
                onUnhideAll={handleUnhideAll}
            />

            {/* Separator and active chips */}
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
