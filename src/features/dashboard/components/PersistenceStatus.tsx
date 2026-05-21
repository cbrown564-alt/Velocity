import React, { useState } from 'react';
import { Database, HardDrive, AlertCircle, RefreshCw, Trash2, CheckCircle2, TriangleAlert, Activity, FileUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion, getBackdropProps, getModalPresenceProps } from '../../../lib/motion';
import { getPersistenceDisplayMessage } from '../../../lib/persistenceDisplay';
import { ConfirmModal } from '../../../components/overlays/ConfirmModal';

interface PersistenceStatusProps {
    mode: string;
    opfsAvailable: boolean;
    dbLabel: string | null;
    usageMb: number | null;
    quotaMb: number | null;
    usagePct: number | null;
    error: string | null;
    errorHint: string | null;
    rehydrateError: string | null;
    datasetRows?: number | null;
    datasetColumns?: number | null;
    estimatedCells?: number | null;
    labeledVariableCount?: number | null;
    totalVariableCount?: number | null;
    totalValueLabelCount?: number | null;
    memoryRisk?: 'normal' | 'elevated' | 'critical';
    partialLoadMessage?: string | null;
    opfsFileKey?: string;
    onRefresh: () => void;
    onPurge: () => void;
    onRebuild: () => void;
}

export const PersistenceStatus: React.FC<PersistenceStatusProps> = ({
    mode,
    opfsAvailable,
    dbLabel,
    usageMb,
    quotaMb,
    usagePct,
    error,
    errorHint,
    rehydrateError,
    datasetRows,
    datasetColumns,
    estimatedCells,
    labeledVariableCount,
    totalVariableCount,
    totalValueLabelCount,
    memoryRisk = 'normal',
    partialLoadMessage,
    opfsFileKey,
    onRefresh,
    onPurge,
    onRebuild,
}) => {
    const [showDetails, setShowDetails] = useState(false);
    const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

    // Determine status color/icon
    const hasError = !!error || !!rehydrateError;
    const hasPartialLoad = !!partialLoadMessage;
    const persistenceMessage = getPersistenceDisplayMessage(error, errorHint);
    const statusTone = hasError || hasPartialLoad
        ? 'issue'
        : memoryRisk === 'critical'
            ? 'issue'
            : memoryRisk === 'elevated'
                ? 'warn'
                : 'ok';
    const statusLabel = hasError
        ? (persistenceMessage.headline ?? 'Storage Issue')
        : hasPartialLoad
            ? 'Partial Metadata'
            : memoryRisk === 'critical'
                ? 'High Memory Risk'
                : memoryRisk === 'elevated'
                    ? 'Memory Risk'
                    : 'Local Storage';
    const labelCoveragePct =
        typeof labeledVariableCount === 'number' &&
            typeof totalVariableCount === 'number' &&
            totalVariableCount > 0
            ? Math.round((labeledVariableCount / totalVariableCount) * 100)
            : null;

    const reducedMotion = useReducedMotion();

    return (
        <>
            <button
                onClick={() => setShowDetails(true)}
                className={`
          w-full mt-auto p-3 border-t border-[var(--border-color)] bg-[var(--bg-app)] 
          hover:bg-[var(--bg-surface)] transition-colors text-left flex items-center gap-3
          group
                `}
            >
                <div className={`
          w-8 h-8 rounded-full flex items-center justify-center shrink-0
          ${statusTone === 'issue'
                        ? 'bg-[var(--status-error-surface)] text-[var(--color-error)]'
                        : statusTone === 'warn'
                            ? 'bg-[var(--status-warning-surface)] text-[var(--status-warning-text)]'
                            : 'bg-[var(--status-success-surface)] text-[var(--color-success)]'
                    }
        `}>
                    {statusTone === 'issue' ? <AlertCircle size={16} /> : statusTone === 'warn' ? <TriangleAlert size={16} /> : <Database size={16} />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {statusLabel}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] truncate">
                        {hasPartialLoad
                            ? 'Value labels were partially dropped'
                            : usageMb ? `${usageMb.toFixed(1)} MB used` : 'Ready'}
                    </div>
                </div>
            </button>

            {/* Details Modal */}
            <AnimatePresence>
                {showDetails && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            {...getBackdropProps(reducedMotion)}
                            onClick={() => setShowDetails(false)}
                            className="absolute inset-0 bg-[var(--text-primary)]/20 backdrop-blur-sm"
                        />

                        <motion.div
                            {...getModalPresenceProps(reducedMotion)}
                            className="relative w-full max-w-md bg-[var(--bg-surface)] rounded-xl shadow-2xl border border-[var(--border-color)] overflow-hidden"
                        >
                            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-panel)]">
                                <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                                    <HardDrive size={18} className="text-[var(--text-secondary)]" />
                                    Storage Health
                                </h3>
                                <button
                                    onClick={() => setShowDetails(false)}
                                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-md hover:bg-[var(--bg-active)] transition-colors"
                                >
                                    <span className="sr-only">Close</span>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color-muted)]">
                                        <div className="text-xs text-[var(--text-secondary)] mb-1">Status</div>
                                        <div className="flex items-center gap-2">
                                            {opfsAvailable
                                                ? <><CheckCircle2 size={14} className="text-[var(--color-success)]" /><span className="text-sm font-medium">Active</span></>
                                                : <><AlertCircle size={14} className="text-[var(--status-warning-text)]" /><span className="text-sm font-medium">Unavailable</span></>
                                            }
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color-muted)]">
                                        <div className="text-xs text-[var(--text-secondary)] mb-1">Mode</div>
                                        <div className="text-sm font-medium capitalize">{mode}</div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color-muted)]">
                                        <div className="text-xs text-[var(--text-secondary)] mb-1">Database</div>
                                        <div className="text-sm font-medium truncate" title={dbLabel || ''}>
                                            {dbLabel || 'In-Memory'}
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color-muted)]">
                                        <div className="text-xs text-[var(--text-secondary)] mb-1">Usage</div>
                                        <div className="text-sm font-medium">
                                            {usageMb !== null ? `${usageMb.toFixed(1)} MB` : '--'}
                                            {usagePct !== null && <span className="text-[var(--text-secondary)] text-xs ml-1">({usagePct}%)</span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Dataset Diagnostics */}
                                {(datasetRows !== null || datasetColumns !== null || estimatedCells !== null) && (
                                    <div className="p-4 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color-muted)] space-y-3">
                                        <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2 mb-2">
                                            <Activity size={14} />
                                            Runtime Diagnostics
                                        </div>
                                        <div className="grid grid-cols-[1fr,auto] gap-y-2.5 gap-x-4 text-sm">
                                            <div className="text-[var(--text-secondary)]">Rows</div>
                                            <div className="text-right font-medium text-[var(--text-primary)]">{datasetRows !== null && datasetRows !== undefined ? datasetRows.toLocaleString() : '--'}</div>

                                            <div className="text-[var(--text-secondary)]">Columns</div>
                                            <div className="text-right font-medium text-[var(--text-primary)]">{datasetColumns !== null && datasetColumns !== undefined ? datasetColumns.toLocaleString() : '--'}</div>

                                            <div className="text-[var(--text-secondary)] flex items-center gap-1.5">
                                                Estimated Cells
                                            </div>
                                            <div className="text-right font-medium text-[var(--text-primary)]">{estimatedCells !== null && estimatedCells !== undefined ? estimatedCells.toLocaleString() : '--'}</div>

                                            <div className="text-[var(--text-secondary)]">Label Coverage</div>
                                            <div className="text-right font-medium text-[var(--text-primary)]">
                                                {labelCoveragePct !== null ? `${labelCoveragePct}%` : '--'}
                                                {typeof totalValueLabelCount === 'number' && (
                                                    <span className="text-[var(--text-secondary)] ml-1.5 text-xs font-normal">({totalValueLabelCount.toLocaleString()} labels)</span>
                                                )}
                                            </div>

                                            <div className="text-[var(--text-secondary)]">Memory Risk</div>
                                            <div className={`text-right font-medium flex items-center justify-end gap-1.5 ${memoryRisk === 'critical'
                                                ? 'text-[var(--color-error)]'
                                                : memoryRisk === 'elevated'
                                                    ? 'text-[var(--status-warning-text)]'
                                                    : 'text-[var(--color-success)]'}`}>
                                                {memoryRisk === 'critical' ? 'Critical' : memoryRisk === 'elevated' ? 'Elevated' : 'Normal'}
                                                {memoryRisk !== 'normal' && <AlertCircle size={14} />}
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-[var(--border-color-muted)] flex items-start gap-2 text-[var(--status-warning-text)] bg-[var(--status-warning-surface)] p-2.5 rounded-md">
                                            <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                            <div className="text-xs leading-relaxed">
                                                Browser limits are based on total process memory, not only OPFS disk quota. High memory risk may cause the tab to crash.
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Error Section */}
                                {(hasError || errorHint || partialLoadMessage) && (
                                    <div className="p-3 rounded-lg bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] text-[var(--status-warning-text)] text-sm space-y-2">
                                        {persistenceMessage.headline && (
                                            <div className="font-medium flex items-center gap-2">
                                                <AlertCircle size={14} />
                                                {persistenceMessage.headline}
                                            </div>
                                        )}
                                        {rehydrateError && !error && (
                                            <div className="font-medium flex items-center gap-2">
                                                <AlertCircle size={14} />
                                                Couldn&apos;t restore data from your saved file.
                                            </div>
                                        )}
                                        {partialLoadMessage && (
                                            <div className="font-medium flex items-center gap-2">
                                                <TriangleAlert size={14} />
                                                {partialLoadMessage}
                                            </div>
                                        )}
                                        {(persistenceMessage.detail || rehydrateError) && (
                                            <details className="text-xs opacity-90">
                                                <summary className="cursor-pointer hover:opacity-100">Technical details</summary>
                                                <p className="mt-1 break-words">{persistenceMessage.detail || rehydrateError}</p>
                                            </details>
                                        )}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="pt-2 flex flex-col gap-3">
                                    {(hasError || errorHint || partialLoadMessage) && (
                                        <>
                                            <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Troubleshooting</div>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={onRefresh}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--bg-element)] hover:bg-[var(--bg-hover)] text-sm font-medium transition-colors border border-[var(--border-color)] text-[var(--text-primary)]"
                                                >
                                                    <RefreshCw size={16} /> Refresh
                                                </button>
                                                <button
                                                    onClick={() => setShowPurgeConfirm(true)}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--status-error-surface)] text-[var(--color-error)] border border-[var(--status-error-border)] hover:opacity-90 text-sm font-medium transition-opacity"
                                                >
                                                    <Trash2 size={16} /> Purge Corruption
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {opfsFileKey && (
                                        <>
                                            {!(hasError || errorHint || partialLoadMessage) && (
                                                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Storage Actions</div>
                                            )}
                                            <button
                                                onClick={onRebuild}
                                                className={`w-full ${hasError || errorHint || partialLoadMessage ? 'mt-2' : ''} flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--color-accent)] text-[var(--text-inverse)] hover:opacity-90 text-sm font-medium transition-opacity shadow-sm`}
                                            >
                                                <FileUp size={16} /> Re-import Original File
                                            </button>
                                        </>
                                    )}
                                </div>

                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmModal
                isOpen={showPurgeConfirm}
                onClose={() => setShowPurgeConfirm(false)}
                onConfirm={onPurge}
                title="Purge corrupted storage?"
                message="This permanently deletes quarantined OPFS database files. You may need to re-import your datasets afterward."
                confirmLabel="Purge"
                cancelLabel="Cancel"
                variant="danger"
            />
        </>
    );
};
