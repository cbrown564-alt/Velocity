/**
 * AppShell Component
 * 
 * Wrapper component that manages mode transitions between
 * Analysis Canvas (hub) and Variable Manager (spoke).
 * Implements the "Soft Modal" pattern from research_08_UX_patterns_for_surveys.md.
 */

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVelocityStore } from '../../store';
import { VariableManager } from '../../features/variableManager/VariableManager';
import { Database } from 'lucide-react';
import { getMotionProps, useReducedMotion, DURATIONS, EASINGS } from '../../lib/motion';

interface AppShellProps {
    children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
    const { appMode, toggleAppMode } = useVelocityStore();
    const reducedMotion = useReducedMotion();

    // Keyboard shortcut: D key toggles mode
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        // Ignore if user is typing in an input
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
            return;
        }

        if (event.key === 'd' || event.key === 'D') {
            event.preventDefault();
            toggleAppMode();
        }
    }, [toggleAppMode]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div className="relative h-screen overflow-hidden">
            {/* Analysis Canvas (always rendered, recedes when Variable Manager is open) */}
            <motion.div
                animate={{
                    scale: appMode === 'variables' ? 0.95 : 1,
                    filter: appMode === 'variables' ? 'blur(4px)' : 'blur(0px)',
                }}
                transition={{
                    duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
                    ease: EASINGS.standard,
                }}
                className="h-full"
            >
                {children}
            </motion.div>

            {/* Variable Manager Overlay */}
            <AnimatePresence>
                {appMode === 'variables' && (
                    <motion.div
                        {...getMotionProps({
                            preset: 'slideUp',
                            duration: reducedMotion ? DURATIONS.instant : DURATIONS.normal,
                            ease: 'standard',
                            reducedMotion,
                        })}
                        className="absolute inset-0 z-50"
                    >
                        <VariableManager onClose={toggleAppMode} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * Mode Toggle Button
 * Placed in the header to switch between modes.
 */
export const ModeToggleButton: React.FC = () => {
    const { appMode, toggleAppMode } = useVelocityStore();

    return (
        <button
            onClick={toggleAppMode}
            className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
                transition-all duration-150
                ${appMode === 'variables'
                    ? 'bg-[var(--color-accent)] text-[var(--text-inverse)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--bg-active)]'
                }
            `}
            title="Toggle Variable Manager (D)"
        >
            <Database size={14} />
            <span>Data</span>
            <kbd className="hidden sm:inline-block text-[10px] px-1 py-0.5 bg-[var(--border-color)] rounded ml-1 text-[var(--text-secondary)]">
                D
            </kbd>
        </button>
    );
};
