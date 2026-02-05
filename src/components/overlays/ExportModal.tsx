/**
 * ExportModal Component
 *
 * Provides UI for exporting analysis results to PPTX or XLSX formats.
 * Calls the export pipeline from src/core/export/*.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileDown, FileSpreadsheet, Presentation, Download, CheckCircle2 } from 'lucide-react';
import styles from './ExportModal.module.css';
import { exportPptx } from '../../core/export/pptxExporter';
import { exportXlsx } from '../../core/export/xlsxExporter';
import { ExportConfig } from '../../core/export/types';
import { useVelocityStore } from '../../store';
import { buildExportConfig } from '../../core/export/buildExportConfig';
import { resolveAnalysisVariables } from '../../core/export/resolveAnalysisVariables';
import { runCrosstabForExport } from '../../core/export/runCrosstabForExport';
import type { SlideAnalysisState } from '../../types/slides';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pre-populated export configuration */
    config: ExportConfig;
}

type ExportFormat = 'pptx' | 'xlsx';
type ExportScope = 'current' | 'all' | 'selected';

export const ExportModal: React.FC<ExportModalProps> = ({
    isOpen,
    onClose,
    config: initialConfig,
}) => {
    const [format, setFormat] = useState<ExportFormat>('pptx');
    const [title, setTitle] = useState(initialConfig.title);
    const [showSignificance, setShowSignificance] = useState(true);
    const [showPercents, setShowPercents] = useState(true);
    const [showCounts, setShowCounts] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);
    const [scope, setScope] = useState<ExportScope>('current');
    const [selectedSlideIds, setSelectedSlideIds] = useState<string[]>([]);

    const slides = useVelocityStore((state) => state.slides);
    const activeSlideId = useVelocityStore((state) => state.activeSlideId);
    const tableConfig = useVelocityStore((state) => state.tableConfig);
    const activeFilters = useVelocityStore((state) => state.activeFilters);
    const dataset = useVelocityStore((state) => state.dataset);
    const variableSets = useVelocityStore((state) => state.variableSets);
    const worker = useVelocityStore((state) => state.worker);
    const isQuerying = useVelocityStore((state) => state.isQuerying);

    const activeSlideTitle = useMemo(() => {
        if (!activeSlideId) return null;
        return slides.find((slide) => slide.id === activeSlideId)?.title || null;
    }, [slides, activeSlideId]);

    useEffect(() => {
        if (!isOpen) return;
        setTitle(initialConfig.title);
        setExportSuccess(false);
        setScope('current');
        setSelectedSlideIds(activeSlideId ? [activeSlideId] : []);
    }, [isOpen, initialConfig.title, activeSlideId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    const slideIdsForScope = useMemo(() => {
        if (scope === 'current') {
            return activeSlideId ? [activeSlideId] : [];
        }
        if (scope === 'all') {
            return slides.map((slide) => slide.id);
        }
        return selectedSlideIds;
    }, [scope, activeSlideId, slides, selectedSlideIds]);

    const handleToggleSelectedSlide = (slideId: string) => {
        setSelectedSlideIds((prev) => {
            if (prev.includes(slideId)) {
                return prev.filter((id) => id !== slideId);
            }
            return [...prev, slideId];
        });
    };

    const handleSelectAllSlides = () => {
        setSelectedSlideIds(slides.map((slide) => slide.id));
    };

    const handleClearSelectedSlides = () => {
        setSelectedSlideIds([]);
    };

    const isExportDisabled = isExporting || !title.trim() || slideIdsForScope.length === 0 || isQuerying || !dataset || !worker;

    const handleExport = async () => {
        if (!worker || !dataset) {
            alert('Export is unavailable until a dataset is loaded.');
            return;
        }
        if (isQuerying) {
            alert('Please wait for analysis to finish, then try exporting again.');
            return;
        }
        if (slideIdsForScope.length === 0) {
            alert('Select at least one slide to export.');
            return;
        }

        setIsExporting(true);
        setExportSuccess(false);

        try {
            const analyses: ExportConfig['analyses'] = [];

            for (const slideId of slideIdsForScope) {
                const slide = slides.find((s) => s.id === slideId);
                if (!slide) continue;

                const analysisState: SlideAnalysisState = slideId === activeSlideId
                    ? {
                        rowVars: tableConfig.rowVars,
                        colVar: tableConfig.colVar,
                        filters: activeFilters,
                        weightVar: dataset.weightVariable ?? null,
                    }
                    : slide.analysisState;

                const weightVar = analysisState.weightVar ?? dataset.weightVariable ?? null;
                const { rowVariables, colVariable, firstRowVarSet } = resolveAnalysisVariables(
                    analysisState,
                    variableSets,
                    dataset.variables
                );

                const isMultipleResponse = firstRowVarSet?.structure === 'multiple';
                const crosstab = await runCrosstabForExport({
                    worker,
                    dataset,
                    variableSets,
                    rowVars: analysisState.rowVars,
                    colVar: analysisState.colVar,
                    filters: analysisState.filters,
                    weightVar,
                });

                const slideConfig = buildExportConfig({
                    title,
                    label: slide.title,
                    data: crosstab.data,
                    rowVariables,
                    colVariable,
                    isWeighted: !!weightVar,
                    isMultipleResponse: !!isMultipleResponse,
                });

                analyses.push(...slideConfig.analyses);
            }

            if (analyses.length === 0) {
                alert('No exportable analyses were found for the selected slides.');
                return;
            }

            // Build export config with user options
            const exportConfig: ExportConfig = {
                title,
                analyses: analyses.map((analysis) => ({
                    ...analysis,
                    options: {
                        showSignificance,
                        showPercents,
                        showCounts,
                    },
                })),
                branding: initialConfig.branding,
            };

            // Call appropriate exporter
            const data = format === 'pptx'
                ? await exportPptx(exportConfig)
                : await exportXlsx(exportConfig);

            // Trigger download
            const blob = new Blob([data], {
                type: format === 'pptx'
                    ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                    : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${title}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            setExportSuccess(true);
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className={styles.backdrop}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2 }}
                        className={styles.backdrop}
                        style={{ pointerEvents: 'none' }}
                    >
                        <div
                            className={styles.modal}
                            style={{ pointerEvents: 'auto' }}
                            onKeyDown={handleKeyDown}
                        >
                            {/* Header */}
                            <div className={styles.header}>
                                <div className={styles.headerLeft}>
                                    <div className={styles.headerIcon}>
                                        <FileDown size={20} />
                                    </div>
                                    <h2 className={styles.headerTitle}>Export Analysis</h2>
                                </div>
                                <button
                                    onClick={onClose}
                                    className={styles.closeButton}
                                    aria-label="Close modal"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className={styles.content}>
                                {/* Export Scope */}
                                <div className={styles.section}>
                                    <div className={styles.sectionLabel}>Export Scope</div>
                                    <div className={styles.scopeGroup}>
                                        <label
                                            className={`${styles.scopeOption} ${scope === 'current' ? styles.selected : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="export-scope"
                                                checked={scope === 'current'}
                                                onChange={() => setScope('current')}
                                            />
                                            <div className={styles.scopeRadio} />
                                            <div>
                                                <div className={styles.scopeLabel}>
                                                    Current Slide{activeSlideTitle ? ` (${activeSlideTitle})` : ''}
                                                </div>
                                                <div className={styles.scopeDescription}>Export the slide you are viewing now</div>
                                            </div>
                                        </label>
                                        <label
                                            className={`${styles.scopeOption} ${scope === 'all' ? styles.selected : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="export-scope"
                                                checked={scope === 'all'}
                                                onChange={() => setScope('all')}
                                            />
                                            <div className={styles.scopeRadio} />
                                            <div>
                                                <div className={styles.scopeLabel}>All Slides ({slides.length})</div>
                                                <div className={styles.scopeDescription}>Export every slide in the deck</div>
                                            </div>
                                        </label>
                                        <label
                                            className={`${styles.scopeOption} ${scope === 'selected' ? styles.selected : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="export-scope"
                                                checked={scope === 'selected'}
                                                onChange={() => setScope('selected')}
                                            />
                                            <div className={styles.scopeRadio} />
                                            <div>
                                                <div className={styles.scopeLabel}>Selected Slides</div>
                                                <div className={styles.scopeDescription}>Pick specific slides to export</div>
                                            </div>
                                        </label>
                                    </div>

                                    {scope === 'selected' && (
                                        <div className={styles.scopeList}>
                                            <div className={styles.scopeListActions}>
                                                <div className={styles.scopeActionGroup}>
                                                    <button
                                                        type="button"
                                                        onClick={handleSelectAllSlides}
                                                        className={styles.scopeActionButton}
                                                    >
                                                        Select all
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleClearSelectedSlides}
                                                        className={styles.scopeActionButton}
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                                <div className={styles.scopeCount}>
                                                    {selectedSlideIds.length} of {slides.length} selected
                                                </div>
                                            </div>
                                            {slides.map((slide, index) => (
                                                <label key={slide.id} className={styles.scopeListItem}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedSlideIds.includes(slide.id)}
                                                        onChange={() => handleToggleSelectedSlide(slide.id)}
                                                    />
                                                    <div className={styles.scopeCheckbox} />
                                                    <span className={styles.scopeItemIndex}>{index + 1}.</span>
                                                    <span className={styles.scopeItemLabel}>{slide.title || 'Untitled Slide'}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Format Selection */}
                                <div className={styles.section}>
                                    <div className={styles.sectionLabel}>Export Format</div>
                                    <div className={styles.formatGrid}>
                                        <div
                                            className={`${styles.formatOption} ${format === 'pptx' ? styles.selected : ''}`}
                                            onClick={() => setFormat('pptx')}
                                        >
                                            <div className={styles.formatIcon}>
                                                <Presentation size={24} />
                                            </div>
                                            <div className={styles.formatName}>PowerPoint</div>
                                            <div className={styles.formatDescription}>
                                                Editable slides with tables
                                            </div>
                                        </div>
                                        <div
                                            className={`${styles.formatOption} ${format === 'xlsx' ? styles.selected : ''}`}
                                            onClick={() => setFormat('xlsx')}
                                        >
                                            <div className={styles.formatIcon}>
                                                <FileSpreadsheet size={24} />
                                            </div>
                                            <div className={styles.formatName}>Excel</div>
                                            <div className={styles.formatDescription}>
                                                Workbook with formatted data
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Title Input */}
                                <div className={styles.section}>
                                    <div className={styles.inputGroup}>
                                        <label htmlFor="export-title" className={styles.inputLabel}>
                                            Report Title
                                        </label>
                                        <input
                                            id="export-title"
                                            type="text"
                                            className={styles.input}
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="Analysis Report"
                                        />
                                    </div>
                                </div>

                                {/* Export Options */}
                                <div className={styles.section}>
                                    <div className={styles.sectionLabel}>Include</div>
                                    <div className={styles.checkboxGroup}>
                                        <label className={styles.checkboxItem}>
                                            <input
                                                type="checkbox"
                                                checked={showSignificance}
                                                onChange={(e) => setShowSignificance(e.target.checked)}
                                            />
                                            <div className={styles.checkbox} />
                                            <div>
                                                <div className={styles.checkboxLabel}>
                                                    Significance Markers
                                                </div>
                                                <div className={styles.checkboxDescription}>
                                                    ▲▼ arrows for statistical significance
                                                </div>
                                            </div>
                                        </label>

                                        <label className={styles.checkboxItem}>
                                            <input
                                                type="checkbox"
                                                checked={showPercents}
                                                onChange={(e) => setShowPercents(e.target.checked)}
                                            />
                                            <div className={styles.checkbox} />
                                            <div>
                                                <div className={styles.checkboxLabel}>
                                                    Percentages
                                                </div>
                                                <div className={styles.checkboxDescription}>
                                                    Show cell percentages
                                                </div>
                                            </div>
                                        </label>

                                        <label className={styles.checkboxItem}>
                                            <input
                                                type="checkbox"
                                                checked={showCounts}
                                                onChange={(e) => setShowCounts(e.target.checked)}
                                            />
                                            <div className={styles.checkbox} />
                                            <div>
                                                <div className={styles.checkboxLabel}>
                                                    Raw Counts
                                                </div>
                                                <div className={styles.checkboxDescription}>
                                                    Show unweighted counts
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                {/* Success Message */}
                                {exportSuccess && (
                                    <div className={styles.successMessage}>
                                        <CheckCircle2 size={16} />
                                        Export successful! File downloaded.
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className={styles.footer}>
                                <div className={styles.footerInfo}>
                                    {scope === 'current' && 'Current slide'}
                                    {scope === 'all' && `${slides.length} slides`}
                                    {scope === 'selected' && `${selectedSlideIds.length} slides selected`}
                                </div>
                                <div className={styles.footerActions}>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className={`${styles.button} ${styles.buttonSecondary}`}
                                        disabled={isExporting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExport}
                                        className={`${styles.button} ${styles.buttonPrimary}`}
                                        disabled={isExportDisabled}
                                    >
                                        {isExporting ? (
                                            <>
                                                <span className={styles.loadingSpinner} />
                                                Exporting...
                                            </>
                                        ) : (
                                            <>
                                                <Download size={16} />
                                                Export
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ExportModal;
