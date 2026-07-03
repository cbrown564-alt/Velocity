/**
 * useFocusModeTip — one-time discoverability tip for Focus mode (UXF-006).
 * After the first successful crosstab render of a session, suggests pressing
 * F. Shown once per browser profile; dismissing the toast counts as seen.
 */

import { useEffect, useRef } from 'react';
import { useVelocityStore } from '../../../store';

const STORAGE_KEY = 'velocity-focus-tip-seen';

function hasSeenTip(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return true; // storage unavailable — never nag
  }
}

function markTipSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    // Best effort.
  }
}

export function useFocusModeTip(hasRenderedTable: boolean): void {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!hasRenderedTable || firedRef.current || hasSeenTip()) return;
    firedRef.current = true;
    markTipSeen();
    useVelocityStore.getState().addToast({
      title: 'Focus mode',
      message: 'Press F to let the output fill the canvas.',
      type: 'info',
      duration: 6000,
      dedupeKey: 'focus-mode-tip',
    });
  }, [hasRenderedTable]);
}
