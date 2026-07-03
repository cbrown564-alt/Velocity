import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVelocityStore } from '../../store';
import { VariableManager } from '../../features/variableManager/VariableManager';
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

  const canvasRef = useRef<HTMLDivElement>(null);
  const isCanvasHidden = appMode === 'variables';
  const supportsInert = typeof HTMLElement !== 'undefined' && 'inert' in HTMLElement.prototype;

  useEffect(() => {
    const el = canvasRef.current;
    if (!el || !supportsInert) return;
    el.inert = isCanvasHidden;
  }, [isCanvasHidden, supportsInert]);

  return (
    <div className="relative h-screen overflow-hidden">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {/* Analysis Canvas (always rendered, recedes when Variable Manager is open) */}
      <motion.div
        ref={canvasRef}
        aria-hidden={isCanvasHidden ? true : undefined}
        data-testid="analysis-canvas"
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
            className="absolute inset-0 z-[var(--z-modal)]"
          >
            <VariableManager onClose={toggleAppMode} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
