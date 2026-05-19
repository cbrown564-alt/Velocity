import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Search,
    LayoutGrid,
    Maximize2,
    RotateCcw,
    FileDown,
    Home,
    Moon,
    Sun,
    Droplets,
    Command,
    Keyboard,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useVelocityStore } from '../../store';

interface CommandItem {
    id: string;
    label: string;
    shortcut?: string;
    icon: React.ReactNode;
    action: () => void;
}

export const CommandPalette: React.FC = () => {
    const { theme, setTheme, availableThemes } = useTheme();
    const {
        commandPaletteOpen,
        closeCommandPalette,
        toggleAppMode,
        toggleFocusMode,
        setFocusMode,
        reset,
        analysisExportModal,
        openAnalysisExportModal,
        closeAnalysisExportModal,
        addToast,
        slides,
        activeSlideId,
    } = useVelocityStore();

    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Build command list dynamically
    const commands = useMemo<CommandItem[]>(() => {
        const list: CommandItem[] = [
            {
                id: 'toggle-manager',
                label: 'Toggle Variable Manager',
                shortcut: 'D',
                icon: <LayoutGrid size={16} />,
                action: () => {
                    toggleAppMode();
                    closeCommandPalette();
                },
            },
            {
                id: 'toggle-focus',
                label: 'Toggle Focus Mode',
                shortcut: 'F',
                icon: <Maximize2 size={16} />,
                action: () => {
                    toggleFocusMode();
                    closeCommandPalette();
                },
            },
            {
                id: 'reset-analysis',
                label: 'Reset Analysis',
                icon: <RotateCcw size={16} />,
                action: () => {
                    reset();
                    closeCommandPalette();
                    addToast({ message: 'Analysis reset', type: 'info' });
                },
            },
            {
                id: 'export-slide',
                label: 'Export Current Slide',
                icon: <FileDown size={16} />,
                action: () => {
                    // Export is handled by DashboardShell; we just trigger a toast here
                    // since the actual export config needs context from DashboardShell.
                    // For MVP, we open the export modal if possible or toast.
                    addToast({ message: 'Use Export button in header', type: 'info' });
                    closeCommandPalette();
                },
            },
            {
                id: 'workspace',
                label: 'Return to Workspace',
                icon: <Home size={16} />,
                action: () => {
                    // Navigation is handled by App; toast for MVP
                    addToast({ message: 'Use Home button in header', type: 'info' });
                    closeCommandPalette();
                },
            },
            {
                id: 'shortcuts',
                label: 'Open Keyboard Shortcuts',
                shortcut: '?',
                icon: <Keyboard size={16} />,
                action: () => {
                    useVelocityStore.getState().openShortcuts();
                    closeCommandPalette();
                },
            },
        ];

        // Theme switch commands
        availableThemes.forEach((t) => {
            const icon =
                t.id === 'soft-machine' ? <Sun size={16} /> :
                    t.id === 'mission-control' ? <Moon size={16} /> :
                        <Droplets size={16} />;
            list.push({
                id: `theme-${t.id}`,
                label: `Switch Theme: ${t.name}`,
                icon,
                action: () => {
                    setTheme(t.id);
                    closeCommandPalette();
                    addToast({ message: `Switched to ${t.name}`, type: 'success' });
                },
            });
        });

        return list;
    }, [availableThemes, setTheme, toggleAppMode, toggleFocusMode, reset, closeCommandPalette, addToast]);

    const filtered = useMemo(() => {
        if (!query.trim()) return commands;
        const q = query.toLowerCase();
        return commands.filter(
            (c) =>
                c.label.toLowerCase().includes(q) ||
                (c.shortcut && c.shortcut.toLowerCase().includes(q))
        );
    }, [commands, query]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    useEffect(() => {
        if (commandPaletteOpen) {
            setQuery('');
            setSelectedIndex(0);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [commandPaletteOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!commandPaletteOpen) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) => (i + 1) % filtered.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                filtered[selectedIndex]?.action();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                closeCommandPalette();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [commandPaletteOpen, filtered, selectedIndex, closeCommandPalette]);

    if (!commandPaletteOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-start justify-center pt-[20vh] bg-[rgb(0_0_0_/0.2)] backdrop-blur-sm"
            onClick={(e) => {
                if (e.target === e.currentTarget) closeCommandPalette();
            }}
        >
            <div className="w-full max-w-lg bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col">
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)]">
                    <Search size={18} className="text-[var(--text-secondary)]" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type a command or search..."
                        className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                    />
                    <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 bg-[var(--bg-active)] rounded text-[var(--text-tertiary)] border border-[var(--border-color-muted)]">
                        ESC
                    </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[50vh] overflow-y-auto py-2">
                    {filtered.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
                            No commands found
                        </div>
                    ) : (
                        filtered.map((cmd, index) => (
                            <button
                                key={cmd.id}
                                onClick={() => cmd.action()}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                    index === selectedIndex
                                        ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-active)]/50'
                                }`}
                            >
                                <span className="text-[var(--text-tertiary)]">{cmd.icon}</span>
                                <span className="flex-1 text-sm">{cmd.label}</span>
                                {cmd.shortcut && (
                                    <kbd className="text-[10px] px-1.5 py-0.5 bg-[var(--bg-surface)] rounded text-[var(--text-tertiary)] border border-[var(--border-color-muted)]">
                                        {cmd.shortcut}
                                    </kbd>
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-[var(--border-color)] flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 rounded bg-[var(--bg-active)] border border-[var(--border-color-muted)]">↑↓</kbd> to navigate
                        </span>
                        <span className="flex items-center gap-1">
                            <kbd className="px-1 rounded bg-[var(--bg-active)] border border-[var(--border-color-muted)]">↵</kbd> to select
                        </span>
                    </div>
                    <span>{filtered.length} commands</span>
                </div>
            </div>
        </div>
    );
};
