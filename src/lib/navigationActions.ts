/**
 * Imperative navigation hooks registered by App orchestration layers.
 * Keeps CommandPalette decoupled from React phase state.
 */

let returnToWorkspaceHandler: (() => void) | null = null;

export function registerReturnToWorkspaceHandler(handler: () => void): () => void {
  returnToWorkspaceHandler = handler;
  return () => {
    if (returnToWorkspaceHandler === handler) {
      returnToWorkspaceHandler = null;
    }
  };
}

export function invokeReturnToWorkspace(): void {
  returnToWorkspaceHandler?.();
}
