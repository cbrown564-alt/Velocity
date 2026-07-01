/**
 * Unified keyboard shortcut registry (STAB-UI-T6).
 * Context stack: modal > manager > canvas/global.
 */

export type ShortcutContext = 'global' | 'canvas' | 'manager' | 'modal';

export interface ShortcutRegistration {
  id: string;
  contexts: ShortcutContext[];
  /** Lower runs first within the same context tier. */
  priority?: number;
  match: (event: KeyboardEvent) => boolean;
  handler: (event: KeyboardEvent) => void;
}

const registrations = new Map<string, ShortcutRegistration>();
let modalDepth = 0;
let managerActive = false;
let listenerAttached = false;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
}

function activeContexts(): ShortcutContext[] {
  if (modalDepth > 0) return ['modal'];
  if (managerActive) return ['manager'];
  return ['global', 'canvas'];
}

function dispatchShortcut(event: KeyboardEvent): void {
  const contexts = activeContexts();
  const allowWhileTyping = contexts.includes('modal');

  if (isTypingTarget(event.target) && !allowWhileTyping) {
    return;
  }

  const candidates = [...registrations.values()]
    .filter((entry) => entry.contexts.some((context) => contexts.includes(context)))
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  for (const entry of candidates) {
    if (entry.match(event)) {
      entry.handler(event);
      return;
    }
  }
}

function ensureListener(): void {
  if (listenerAttached) return;
  document.addEventListener('keydown', dispatchShortcut);
  listenerAttached = true;
}

function maybeRemoveListener(): void {
  if (registrations.size > 0 || listenerAttached === false) return;
  document.removeEventListener('keydown', dispatchShortcut);
  listenerAttached = false;
}

export function registerShortcut(registration: ShortcutRegistration): () => void {
  ensureListener();
  registrations.set(registration.id, registration);
  return () => {
    registrations.delete(registration.id);
    maybeRemoveListener();
  };
}

export function pushModalShortcutContext(): () => void {
  modalDepth += 1;
  return () => {
    modalDepth = Math.max(0, modalDepth - 1);
  };
}

export function setManagerShortcutContext(active: boolean): void {
  managerActive = active;
}

/** Test helper */
export function resetShortcutRegistryForTests(): void {
  registrations.clear();
  modalDepth = 0;
  managerActive = false;
  if (listenerAttached) {
    document.removeEventListener('keydown', dispatchShortcut);
    listenerAttached = false;
  }
}
