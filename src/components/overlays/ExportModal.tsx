/**
 * ExportModal Component
 *
 * Provides UI for exporting analysis results to PPTX or XLSX formats.
 * Calls the export pipeline from src/core/export/*.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, FileDown, FileSpreadsheet, Presentation, Download, CheckCircle2 } from 'lucide-react';
import styles from './ExportModal.module.css';
import { exportPptx } from '../../core/export/pptxExporter';
import { exportXlsx } from '../../core/export/xlsxExporter';
import { ExportConfig, TemplateRefreshMode } from '../../core/export/types';
import { useVelocityStore } from '../../store';
import { buildExportConfig } from '../../core/export/buildExportConfig';
import { buildExportReview, slidesToRecipes } from '../../core/export/slideRecipe';
import {
    applyTemplateBindingsToPptx,
    buildDefaultTemplateMapping,
    buildTemplateApplicabilityReview,
    extractTemplateMetadataFromPptxBinary,
} from '../../core/export/templateMapping';
import { resolveAnalysisVariables } from '../../core/export/resolveAnalysisVariables';
import { runCrosstabForExport } from '../../core/export/runCrosstabForExport';
import type { SlideAnalysisState } from '../../types/slides';
import { ModalShell } from './ModalShell';
import { recordPilotEvent } from '../../services/pilotOnboarding';

const TEMPLATE_STATE_STORAGE_KEY = 'velocity.export.template-state.v1';

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
    const [exportError, setExportError] = useState<string | null>(null);
    const [scope, setScope] = useState<ExportScope>('current');
    const [selectedSlideIds, setSelectedSlideIds] = useState<string[]>([]);
    const [useTemplateMode, setUseTemplateMode] = useState(false);
    const [templateRefreshMode, setTemplateRefreshMode] = useState<TemplateRefreshMode>('wave_refresh');
    const [templateOptionsState, setTemplateOptionsState] = useState(initialConfig.templateOptions ?? null);

    const slides = useVelocityStore((state) => state.slides);
    const activeSlideId = useVelocityStore((state) => state.activeSlideId);
    const tableConfig = useVelocityStore((state) => state.tableConfig);
    const activeFilters = useVelocityStore((state) => state.activeFilters);
    const dataset = useVelocityStore((state) => state.dataset);
    const variableSets = useVelocityStore((state) => state.variableSets);
    const browserEngine = useVelocityStore((state) => state.browserEngine);
    const isQuerying = useVelocityStore((state) => state.isQuerying);
    const analysisSettings = useVelocityStore((state) => state.analysisSettings);

    const activeSlideTitle = useMemo(() => {
        if (!activeSlideId) return null;
        return slides.find((slide) => slide.id === activeSlideId)?.title || null;
    }, [slides, activeSlideId]);

    useEffect(() => {
        if (!isOpen) return;
        setTitle(initialConfig.title);
        setExportSuccess(false);
        setExportError(null);
        setScope('current');
        setSelectedSlideIds(activeSlideId ? [activeSlideId] : []);
        setUseTemplateMode(false);
        setTemplateRefreshMode('wave_refresh');
        setTemplateOptionsState(initialConfig.templateOptions ?? null);
    }, [isOpen, initialConfig.title, activeSlideId]);

    const slideIdsForScope = useMemo(() => {
        if (scope === 'current') {
            return activeSlideId ? [activeSlideId] : [];
        }
        if (scope === 'all') {
            return slides.map((slide) => slide.id);
        }
        return selectedSlideIds;
    }, [scope, activeSlideId, slides, selectedSlideIds]);

    const exportReview = useMemo(() => {
        if (!dataset) {
            return {
                canExport: false,
                slideCount: 0,
                blockedSlideCount: 0,
                warningCount: 0,
                issues: [],
            };
        }

        return buildExportReview({
            slides,
            slideIds: slideIdsForScope,
            variableSets,
            variables: dataset.variables,
            analysisStateOverrides: activeSlideId
                ? {
                    [activeSlideId]: {
                        rowVars: tableConfig.rowVars,
                        colVar: tableConfig.colVar,
                        filters: activeFilters,
                        weightVar: dataset.weightVariable ?? null,
                    },
                }
                : undefined,
        });
    }, [dataset, slides, slideIdsForScope, variableSets, activeSlideId, tableConfig, activeFilters]);

    const templateSlideRecipes = useMemo(
        () => slidesToRecipes(slides.filter((slide) => slideIdsForScope.includes(slide.id))),
        [slides, slideIdsForScope]
    );

    useEffect(() => {
        if (!isOpen || initialConfig.templateOptions) {
            return;
        }
        const stored = localStorage.getItem(TEMPLATE_STATE_STORAGE_KEY);
        if (!stored) {
            return;
        }
        try {
            const parsed = JSON.parse(stored) as {
                template: NonNullable<ExportConfig['templateOptions']>['template'];
                mapping: NonNullable<ExportConfig['templateOptions']>['mapping'];
                baseTemplate: string;
            };
            const raw = atob(parsed.baseTemplate);
            const bytes = new Uint8Array(raw.length);
            for (let index = 0; index < raw.length; index += 1) {
                bytes[index] = raw.charCodeAt(index);
            }
            setTemplateOptionsState({
                template: parsed.template,
                mapping: parsed.mapping,
                slideRecipes: templateSlideRecipes,
                baseTemplate: bytes,
                applyTemplateBindings: applyTemplateBindingsToPptx,
                preserveUntouchedContent: true,
            });
        } catch {
            localStorage.removeItem(TEMPLATE_STATE_STORAGE_KEY);
        }
    }, [isOpen, initialConfig.templateOptions, templateSlideRecipes]);

    useEffect(() => {
        if (!templateOptionsState?.baseTemplate) {
            localStorage.removeItem(TEMPLATE_STATE_STORAGE_KEY);
            return;
        }
        let raw = '';
        for (const byte of templateOptionsState.baseTemplate) {
            raw += String.fromCharCode(byte);
        }
        const baseTemplate = btoa(raw);
        localStorage.setItem(
            TEMPLATE_STATE_STORAGE_KEY,
            JSON.stringify({
                template: templateOptionsState.template,
                mapping: templateOptionsState.mapping,
                baseTemplate,
            })
        );
    }, [templateOptionsState]);

    const templateReviewIssues = useMemo(() => {
        if (!useTemplateMode || format !== 'pptx') {
            return [];
        }
        return buildTemplateApplicabilityReview({
            template: templateOptionsState?.template,
            mapping: templateOptionsState?.mapping,
            recipes: templateOptionsState?.slideRecipes ?? templateSlideRecipes,
            preserveEditableObjects: templateOptionsState?.preserveUntouchedContent ?? true,
        });
    }, [useTemplateMode, format, templateOptionsState, templateSlideRecipes]);

    const reviewIssues = useMemo(() => {
        if (format !== 'pptx' || !useTemplateMode) {
            return exportReview.issues;
        }
        return [...exportReview.issues, ...templateReviewIssues];
    }, [exportReview.issues, format, useTemplateMode, templateReviewIssues]);

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

    const isExportDisabled =
        isExporting
        || !title.trim()
        || slideIdsForScope.length === 0
        || isQuerying
        || !dataset
        || !browserEngine
        || !exportReview.canExport
        || (format === 'pptx'
            && useTemplateMode
            && templateReviewIssues.some((issue) => issue.severity === 'block'));

    const handleExport = async () => {
        if (!browserEngine || !dataset) {
            setExportError('Export is unavailable until a dataset is loaded.');
            return;
        }
        if (isQuerying) {
            setExportError('Please wait for the current analysis to finish, then try again.');
            return;
        }
        if (slideIdsForScope.length === 0) {
            setExportError('Select at least one slide to export.');
            return;
        }
        if (!exportReview.canExport) {
            setExportError(exportReview.issues.find((issue) => issue.severity === 'block')?.message
                ?? 'Resolve export issues before downloading.');
            return;
        }
        if (format === 'pptx' && useTemplateMode) {
            const blockingIssue = templateReviewIssues.find((issue) => issue.severity === 'block');
            if (blockingIssue) {
                setExportError(`Template export blocked: ${blockingIssue.message}`);
                return;
            }
        }

        setIsExporting(true);
        setExportSuccess(false);
        setExportError(null);

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
                    engine: browserEngine,
                    dataset,
                    variableSets,
                    rowVars: analysisState.rowVars,
                    colVar: analysisState.colVar,
                    filters: analysisState.filters,
                    weightVar,
                    analysisSettings,
                });

                const slideConfig = buildExportConfig({
                    title,
                    label: slide.title,
                    data: crosstab.data,
                    rowVariables,
                    colVariable,
                    isWeighted: !!weightVar,
                    isMultipleResponse: !!isMultipleResponse,
                    viewType: slide.visualizationType,
                    chartType: slide.chartType,
                });

                analyses.push(...slideConfig.analyses);
            }

            if (analyses.length === 0) {
                setExportError('No exportable analyses were found for the selected slides.');
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
                ...(format === 'pptx' && useTemplateMode && templateOptionsState
                    ? {
                        templateOptions: {
                            ...templateOptionsState,
                            slideRecipes: templateSlideRecipes,
                            applyTemplateBindings: applyTemplateBindingsToPptx,
                            refreshMode: templateRefreshMode,
                            preserveUntouchedContent: true,
                        },
                    }
                    : {}),
            };

            // Call appropriate exporter
            const data = format === 'pptx'
                ? await exportPptx(exportConfig)
                : await exportXlsx(exportConfig);

            // Trigger download
            const blob = new Blob([data as unknown as BlobPart], {
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

            recordPilotEvent(format === 'pptx' ? 'pptx_exported' : 'xlsx_exported', {
                title,
                slideCount: slideIdsForScope.length,
                scope,
            });

            setExportSuccess(true);
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            console.error('Export failed:', error);
            setExportError(error instanceof Error ? error.message : 'Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleTemplateImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        try {
            const buffer = await file.arrayBuffer();
            const baseTemplate = new Uint8Array(buffer);
            const template = await extractTemplateMetadataFromPptxBinary(file.name, baseTemplate);
            const mapping = buildDefaultTemplateMapping(template);
            setTemplateOptionsState({
                template,
                mapping,
                slideRecipes: templateSlideRecipes,
                baseTemplate,
                refreshMode: templateRefreshMode,
                preserveUntouchedContent: true,
                applyTemplateBindings: applyTemplateBindingsToPptx,
            });
            setUseTemplateMode(true);
        } catch (error) {
            setExportError(error instanceof Error ? error.message : 'Template import failed.');
        } finally {
            event.target.value = '';
        }
    };

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            escapeToClose
            backdropClassName={styles.backdrop}
            overlayClassName={styles.backdrop}
            overlayStyle={{ pointerEvents: 'none' }}
            panelClassName={styles.modal}
            panelStyle={{ pointerEvents: 'auto' }}
            panelDataTestId="export-modal"
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
                                    <fieldset>
                                        <legend className={styles.sectionLabel}>Export Format</legend>
                                        <div className={styles.formatGrid} role="radiogroup" aria-label="Export format">
                                        <label
                                            className={`${styles.formatOption} ${format === 'pptx' ? styles.selected : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="export-format"
                                                checked={format === 'pptx'}
                                                onChange={() => setFormat('pptx')}
                                                className="sr-only"
                                                aria-label="PowerPoint"
                                            />
                                            <div className={styles.formatIcon}>
                                                <Presentation size={24} aria-hidden />
                                            </div>
                                            <div className={styles.formatName}>PowerPoint</div>
                                            <div className={styles.formatDescription}>
                                                Editable slides with tables
                                            </div>
                                        </label>
                                        <label
                                            className={`${styles.formatOption} ${format === 'xlsx' ? styles.selected : ''}`}
                                        >
                                            <input
                                                type="radio"
                                                name="export-format"
                                                checked={format === 'xlsx'}
                                                onChange={() => setFormat('xlsx')}
                                                className="sr-only"
                                                aria-label="Excel"
                                            />
                                            <div className={styles.formatIcon}>
                                                <FileSpreadsheet size={24} aria-hidden />
                                            </div>
                                            <div className={styles.formatName}>Excel</div>
                                            <div className={styles.formatDescription}>
                                                Workbook with formatted data
                                            </div>
                                        </label>
                                        </div>
                                    </fieldset>
                                </div>

                                {format === 'pptx' && (
                                    <div className={styles.section}>
                                        <div className={styles.sectionLabel}>Template Mode</div>
                                        <label className={styles.checkboxItem}>
                                            <input
                                                type="checkbox"
                                                checked={useTemplateMode}
                                                onChange={(e) => setUseTemplateMode(e.target.checked)}
                                                disabled={!templateOptionsState}
                                            />
                                            <div className={styles.checkbox} />
                                            <div>
                                                <div className={styles.checkboxLabel}>
                                                    Apply mapped placeholders
                                                </div>
                                                <div className={styles.checkboxDescription}>
                                                    {templateOptionsState
                                                        ? 'Keep untouched template content and refresh mapped values only.'
                                                        : 'Load and map a PowerPoint template to enable template-aware export.'}
                                                </div>
                                            </div>
                                        </label>
                                        {useTemplateMode && templateOptionsState && (
                                            <div className={styles.templateModeOptions}>
                                                <label className={styles.scopeOption}>
                                                    <input
                                                        type="radio"
                                                        name="template-refresh-mode"
                                                        checked={templateRefreshMode === 'wave_refresh'}
                                                        onChange={() => setTemplateRefreshMode('wave_refresh')}
                                                    />
                                                    <div className={styles.scopeRadio} />
                                                    <div>
                                                        <div className={styles.scopeLabel}>Wave refresh</div>
                                                        <div className={styles.scopeDescription}>
                                                            Refresh mapped placeholders and preserve untouched template content.
                                                        </div>
                                                    </div>
                                                </label>
                                                <label className={styles.scopeOption}>
                                                    <input
                                                        type="radio"
                                                        name="template-refresh-mode"
                                                        checked={templateRefreshMode === 'full_rebuild'}
                                                        onChange={() => setTemplateRefreshMode('full_rebuild')}
                                                    />
                                                    <div className={styles.scopeRadio} />
                                                    <div>
                                                        <div className={styles.scopeLabel}>Full rebuild</div>
                                                        <div className={styles.scopeDescription}>
                                                            Re-apply placeholders for a full template export refresh.
                                                        </div>
                                                    </div>
                                                </label>
                                            </div>
                                        )}
                                        <div className={styles.inputGroup}>
                                            <label htmlFor="template-import" className={styles.inputLabel}>
                                                Import Client Template (.pptx)
                                            </label>
                                            <input
                                                id="template-import"
                                                type="file"
                                                accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                                                className={styles.input}
                                                onChange={handleTemplateImport}
                                            />
                                        </div>
                                        {useTemplateMode && templateReviewIssues.length > 0 && (
                                            <ul className={styles.reviewList} data-testid="template-review-list">
                                                {templateReviewIssues.map((issue) => (
                                                    <li
                                                        key={`${issue.code}-${issue.placeholderId ?? 'none'}-${issue.slot ?? 'none'}`}
                                                        className={
                                                            issue.severity === 'block'
                                                                ? styles.reviewIssueBlock
                                                                : styles.reviewIssueWarn
                                                        }
                                                    >
                                                        {issue.message}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

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

                                {reviewIssues.length > 0 && (
                                    <div className={styles.section}>
                                        <div className={styles.sectionLabel}>Review Before Export</div>
                                        <ul className={styles.reviewList} data-testid="export-review-list">
                                            {reviewIssues.map((issue, index) => (
                                                <li
                                                    key={`${issue.code}-${issue.severity}-${index}`}
                                                    className={
                                                        issue.severity === 'block'
                                                            ? styles.reviewIssueBlock
                                                            : styles.reviewIssueWarn
                                                    }
                                                >
                                                    {issue.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Status Messages */}
                                {exportSuccess && (
                                    <div className={styles.successMessage} data-testid="export-modal-success">
                                        <CheckCircle2 size={16} />
                                        Export successful! File downloaded.
                                    </div>
                                )}
                                {exportError && (
                                    <div className={styles.errorMessage}>
                                        {exportError}
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
                                        data-testid="export-modal-submit"
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
        </ModalShell>
    );
};

export default ExportModal;
