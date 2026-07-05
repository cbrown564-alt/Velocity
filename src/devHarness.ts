/**
 * Dev-only harness for E2E chaos tests (Plan 06 Phase 3).
 */
import { useVelocityStore } from './store';

declare global {
  interface Window {
    __velocityStore?: typeof useVelocityStore;
  }
}

if (import.meta.env.DEV) {
  window.__velocityStore = useVelocityStore;
}
