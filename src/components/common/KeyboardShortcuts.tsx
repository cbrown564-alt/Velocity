import React, { useEffect, useId } from 'react';
import { useVelocityStore } from '../../store';
import { X } from 'lucide-react';

interface ShortcutGroup {
    title: string;
    items: { keys: string[]; description: string }[];
}

const SHORTCUTS: ShortcutGroup[] = [
    {
        title: 'Global',
        items: [
            { keys: ['Cmd', 'K'], description: 'Open Command Palette' },
            { keys: ['?'], description: 'Open Keyboard Shortcuts' },
            { keys: ['D'], description: 'Toggle Variable Manager' },
            { keys: ['F'], description: 'Toggle Focus Mode' },
        ],
    },
    {
        title: 'Canvas',
        items: [
            { keys: ['←'], description: 'Previous slide' },
            { keys: ['→'], description: 'Next slide' },
            { keys: ['Delete'], description: 'Delete active slide' },
            { keys: ['Cmd', 'A'], description: 'Select all variables' },
        ],
    },
    {
        title: 'Manager',
        items: [
            { keys: ['Esc'], description: 'Close Variable Manager' },
            { keys: ['Shift', 'Click'], description: 'Range select' },
            { keys: ['Cmd', 'Click'], description: 'Multi-select' },
        ],
    },
];

export const KeyboardShortcuts: React.FC = () => {
    const { shortcutsOpen, closeShortcuts } = useVelocityStore();
    const titleId = useId();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!shortcutsOpen) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                closeShortcuts();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [shortcutsOpen, closeShortcuts]);

    if (!shortcutsOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgb(0_0_0_/0.2)] backdrop-blur-sm p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) closeShortcuts();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="w-full max-w-md bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                    <h2 id={titleId} className="text-base font-semibold text-[var(--text-primary)]">
                        Keyboard Shortcuts
                    </h2>
                    <button
                        type="button"
                        onClick={closeShortcuts}
                        aria-label="Close keyboard shortcuts"
                        className="p-1.5 rounded-md hover:bg-[var(--bg-active)] text-[var(--text-secondary)] transition-colors"
                    >
                        <X size={16} aria-hidden />
                    </button>
                </div>

                <div className="overflow-y-auto p-5 space-y-6">
                    {SHORTCUTS.map((group) => (
                        <section key={group.title} aria-labelledby={`${titleId}-${group.title}`}>
                            <h3
                                id={`${titleId}-${group.title}`}
                                className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3"
                            >
                                {group.title}
                            </h3>
                            <ul className="space-y-2">
                                {group.items.map((item) => (
                                    <li
                                        key={`${group.title}-${item.description}`}
                                        className="flex items-center justify-between py-1.5 gap-4"
                                    >
                                        <span className="text-sm text-[var(--text-secondary)]">
                                            {item.description}
                                        </span>
                                        <span className="flex items-center gap-1 shrink-0">
                                            {item.keys.map((key, ki) => (
                                                <React.Fragment key={key}>
                                                    <kbd className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-active)] rounded text-[var(--text-primary)] border border-[var(--border-color-muted)] font-mono">
                                                        {key}
                                                    </kbd>
                                                    {ki < item.keys.length - 1 && (
                                                        <span className="text-[var(--text-tertiary)]">+</span>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
};
