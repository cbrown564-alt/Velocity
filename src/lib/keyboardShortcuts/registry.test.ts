import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerShortcut, resetShortcutRegistryForTests, setManagerShortcutContext } from './registry';

describe('keyboard shortcut registry', () => {
  beforeEach(() => {
    resetShortcutRegistryForTests();
  });

  afterEach(() => {
    resetShortcutRegistryForTests();
  });

  it('dispatches matching global shortcuts', () => {
    const handler = vi.fn();
    registerShortcut({
      id: 'test-open-palette',
      contexts: ['global'],
      match: (event) => event.key === 'k' && event.metaKey,
      handler,
    });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('prefers manager context over canvas shortcuts', () => {
    const canvasHandler = vi.fn();
    const managerHandler = vi.fn();

    registerShortcut({
      id: 'canvas-test',
      contexts: ['canvas'],
      match: (event) => event.key === 'Escape',
      handler: canvasHandler,
    });
    registerShortcut({
      id: 'manager-test',
      contexts: ['manager'],
      match: (event) => event.key === 'Escape',
      handler: managerHandler,
    });

    setManagerShortcutContext(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(managerHandler).toHaveBeenCalledTimes(1);
    expect(canvasHandler).not.toHaveBeenCalled();
  });

  it('allows manager toggle shortcut while Variable Manager is open', () => {
    const toggleManager = vi.fn();
    registerShortcut({
      id: 'toggle-manager',
      contexts: ['global', 'canvas', 'manager'],
      match: (event) => event.key === 'd',
      handler: toggleManager,
    });

    setManagerShortcutContext(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    expect(toggleManager).toHaveBeenCalledTimes(1);
  });
});
