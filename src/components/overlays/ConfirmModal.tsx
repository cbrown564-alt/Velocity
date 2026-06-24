/**
 * ConfirmModal Component
 * 
 * A reusable React modal for confirmation dialogs.
 * Supports normal and danger variants for destructive actions.
 */

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ModalShell } from './ModalShell';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'normal' | 'danger';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'normal',
}) => {
    const confirmButtonRef = useRef<HTMLButtonElement>(null);

    // Focus confirm button when modal opens
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => confirmButtonRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    const isDanger = variant === 'danger';

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            onPanelKeyDown={handleKeyDown}
            panelClassName="bg-[var(--bg-panel)] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden pointer-events-auto border border-[var(--border-color)]"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                    {isDanger && (
                        <AlertTriangle size={18} className="text-[var(--color-error)]" />
                    )}
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        {title}
                    </h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-active)] transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Content */}
            <div className="p-5">
                <p className="text-sm text-[var(--text-secondary)]">
                    {message}
                </p>

                {/* Buttons */}
                <div className="flex justify-end gap-2 mt-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-active)] rounded-lg transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        ref={confirmButtonRef}
                        type="button"
                        onClick={handleConfirm}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isDanger
                                ? 'bg-[var(--color-error)] hover:opacity-90 text-[var(--text-inverse)]'
                                : 'bg-[var(--color-accent)] hover:opacity-90 text-[var(--text-inverse)]'
                            }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
};

export default ConfirmModal;
