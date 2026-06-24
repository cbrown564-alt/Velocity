/**
 * InputModal Component
 * 
 * A reusable React modal for text input, replacing native prompt() dialogs.
 * Provides better UX and compatibility with React's concurrent rendering.
 */

import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { ModalShell } from './ModalShell';

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (value: string) => void;
    title: string;
    placeholder?: string;
    initialValue?: string;
    submitLabel?: string;
}

export const InputModal: React.FC<InputModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    title,
    placeholder = 'Enter value...',
    initialValue = '',
    submitLabel = 'OK',
}) => {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset value when modal opens
    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            // Focus input after animation
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, initialValue]);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (value.trim()) {
            onSubmit(value.trim());
            onClose();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            onPanelKeyDown={handleKeyDown}
            panelClassName="bg-[var(--bg-panel)] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden pointer-events-auto border border-[var(--border-color)]"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                    {title}
                </h2>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-5">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={placeholder}
                    className="w-full px-4 py-2.5 border border-[var(--border-color)] rounded-lg text-sm outline-none focus:border-[var(--border-color-active)] focus:ring-2 focus:ring-[var(--border-color-active)]/20 transition-all bg-[var(--bg-panel)] text-[var(--text-primary)]"
                />

                {/* Buttons */}
                <div className="flex justify-end gap-2 mt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!value.trim()}
                        className="px-4 py-2 text-sm font-medium text-[var(--text-inverse)] bg-[var(--color-accent)] hover:opacity-90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitLabel}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
};
