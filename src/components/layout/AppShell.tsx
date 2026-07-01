import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVelocityStore } from '../../store';
import { VariableManager } from '../../features/variableManager/VariableManager';
import { Database } from 'lucide-react';
import { getMotionProps, useReducedMotion, DURATIONS, EASINGS } from '../../lib/motion';
import { registerShortcut, setManagerShortcutContext } from '../../lib/keyboardShortcuts/registry';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const appMode = useVelocityStore((state) => state.appMode);
  const toggleAppMode = useVelocityStore((state) => state.toggleAppMode);
  const focusMode = useVelocityStore((state) => state.focusMode);
  const toggleFocusMode = useVelocityStore((state) => state.toggleFocusMode);
  const setFocusMode = useVelocityStore((state) => state.setFocusMode);
  const openCommandPalette = useVelocityStore((state) => state.openCommandPalette);
  const openShortcuts = useVelocityStore((state) => state.openShortcuts);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    setManagerShortcutContext(appMode === 'variables');
  }, [appMode]);

  useEffect(() => {
    const unregister = registerShortcut({
      id: 'global-command-palette',
      contexts: ['global', 'canvas'],
      priority: 10,
      match: (event) => (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k',
      handler: (event) => {
        event.preventDefault();
        openCommandPalette();
      },
    });

    return unregister;
  }, [openCommandPalette]);

  useEffect(() => {
    const unregister = registerShortcut({
      id: 'global-shortcuts-reference',
      contexts: ['global', 'canvas'],
      priority: 20,
      match: (event) => event.key === '?',
      handler: (event) => {
        event.preventDefault();
        openShortcuts();
      },
    });

    return unregister;
  }, [openShortcuts]);

  useEffect(() => {
    const unregister = registerShortcut({
      id: 'global-toggle-manager',
      contexts: ['global', 'canvas', 'manager'],
      priority: 30,
      match: (event) => (event.key === 'd' || event.key === 'D') && !event.metaKey && !event.ctrlKey,
      handler: (event) => {
        event.preventDefault();
        toggleAppMode();
      },
    });

    return unregister;
  }, [toggleAppMode]);

  useEffect(() => {
    const unregister = registerShortcut({
      id: 'global-toggle-focus',
      contexts: ['global', 'canvas'],
      priority: 40,
      match: (event) => (event.key === 'f' || event.key === 'F') && appMode !== 'variables',
      handler: (event) => {
        event.preventDefault();
        toggleFocusMode();
      },
    });

    return unregister;
  }, [appMode, toggleFocusMode]);

  // Exit focus mode when Variable Manager opens
  useEffect(() => {
    if (appMode === 'variables' && focusMode) {
      setFocusMode(false);
    }
  }, [appMode, focusMode, setFocusMode]);

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
  const appMode = useVelocityStore((state) => state.appMode);
  const toggleAppMode = useVelocityStore((state) => state.toggleAppMode);
  const transformLog = useVelocityStore((state) => state.transformLog);
  const lastSeenTransformCount = useVelocityStore((state) => state.lastSeenTransformCount);
  const markTransformsSeen = useVelocityStore((state) => state.markTransformsSeen);

  const hasNewTransforms = lastSeenTransformCount >= 0 && transformLog.length > lastSeenTransformCount;

  const handleClick = () => {
    if (appMode !== 'variables') {
      markTransformsSeen(transformLog.length);
    }
    toggleAppMode();
  };

  const newsTitle =
    hasNewTransforms && appMode !== 'variables'
      ? `${transformLog.length - lastSeenTransformCount} new transform${transformLog.length - lastSeenTransformCount === 1 ? '' : 's'} since your last visit`
      : 'Toggle Variable Manager (D)';

  return (
    <button
      onClick={handleClick}
      className={`
                relative flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
                transition-all duration-150
                ${
                  appMode === 'variables'
                    ? 'bg-[var(--color-accent)] text-[var(--text-inverse)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--bg-active)]'
                }
            `}
      title={newsTitle}
      data-testid="mode-toggle-variables"
    >
      <Database size={14} />
      <span>Variables</span>
      {hasNewTransforms && appMode !== 'variables' && (
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--bg-panel)]"
          data-testid="manager-change-dot"
          aria-hidden
        />
      )}
      <kbd className="hidden sm:inline-block text-[10px] px-1 py-0.5 bg-[var(--border-color)] rounded ml-1 text-[var(--text-secondary)]">
        D
      </kbd>
    </button>
  );
};
