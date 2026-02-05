/**
 * ExportModal Component
 *
 * Provides UI for exporting analysis results to PPTX or XLSX formats.
 * Calls the export pipeline from src/core/export/*.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileDown, FileSpreadsheet, Presentation, Download, CheckCircle2 } from 'lucide-react';
import styles from './ExportModal.module.css';
import { exportPptx } from '../../core/export/pptxExporter';
import { exportXlsx } from '../../core/export/xlsxExporter';
import { ExportConfig } from '../../core/export/types';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pre-populated export configuration */
    config: ExportConfig;
}

type ExportFormat = 'pptx' | 'xlsx';

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

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        setExportSuccess(false);

        try {
            // Build export config with user options
            const exportConfig: ExportConfig = {
                title,
                analyses: initialConfig.analyses.map(analysis => ({
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
                                    {initialConfig.analyses.length === 1
                                        ? '1 table'
                                        : `${initialConfig.analyses.length} tables`}
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
                                        disabled={isExporting || !title.trim()}
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
