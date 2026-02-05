import React, { useState } from 'react';
import { Database, HardDrive, AlertCircle, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
    opfsFileKey,
    onRefresh,
    onPurge,
    onRebuild,
}) => {
    const [showDetails, setShowDetails] = useState(false);

    // Determine status color/icon
    const hasError = !!error || !!rehydrateError;
    const isHealthy = opfsAvailable && !hasError;

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
          ${hasError
                        ? 'bg-red-100 text-red-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }
        `}>
                    {hasError ? <AlertCircle size={16} /> : <Database size={16} />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                        {hasError ? 'Storage Issue' : 'Local Storage'}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] truncate">
                        {usageMb ? `${usageMb.toFixed(1)} MB used` : 'Ready'}
                    </div>
                </div>
            </button>

            {/* Details Modal */}
            <AnimatePresence>
                {showDetails && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowDetails(false)}
                            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="relative w-full max-w-md bg-[var(--bg-surface)] rounded-xl shadow-2xl border border-[var(--border-color)] overflow-hidden"
                        >
                            <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-panel)]">
                                <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                                    <HardDrive size={18} className="text-[var(--text-secondary)]" />
                                    Storage Health
                                </h3>
                                <button
                                    onClick={() => setShowDetails(false)}
                                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1 rounded-md hover:bg-[var(--bg-active)]"
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
                                                ? <><CheckCircle2 size={14} className="text-emerald-500" /><span className="text-sm font-medium">Active</span></>
                                                : <><AlertCircle size={14} className="text-amber-500" /><span className="text-sm font-medium">Unavailable</span></>
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

                                {/* Error Section */}
                                {(hasError || errorHint) && (
                                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-amber-900 text-sm space-y-2">
                                        {error && <div className="font-medium flex items-center gap-2"><AlertCircle size={14} /> {error}</div>}
                                        {rehydrateError && <div className="font-medium flex items-center gap-2"><AlertCircle size={14} /> {rehydrateError}</div>}
                                        {errorHint && <div className="text-xs opacity-90">{errorHint}</div>}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="pt-2 flex flex-col gap-2">
                                    <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Troubleshooting</div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={onRefresh}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-element)] hover:bg-[var(--bg-hover)] text-sm font-medium transition-colors border border-[var(--border-color)]"
                                        >
                                            <RefreshCw size={14} /> Refresh
                                        </button>
                                        <button
                                            onClick={onPurge}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-element)] hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-sm font-medium transition-colors border border-[var(--border-color)]"
                                        >
                                            <Trash2 size={14} /> Purge Corruption
                                        </button>
                                    </div>

                                    {opfsFileKey && (
                                        <button
                                            onClick={onRebuild}
                                            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 text-sm font-medium transition-opacity shadow-sm"
                                        >
                                            <Database size={14} /> Rebuild DB from Source
                                        </button>
                                    )}
                                </div>

                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};
