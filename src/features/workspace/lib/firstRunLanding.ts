/**
 * First-run landing detection for Workshop Door activation (STAB-UI-F).
 */

import { getPilotEventLog } from '../../../services/pilotOnboarding';

const ACTIVATION_EVENTS = new Set(['file_selected', 'canvas_ready']);

/** True when the workspace is empty and the user has not yet activated. */
export function isFirstRunLanding(datasetCount: number): boolean {
  if (datasetCount > 0) return false;
  return !getPilotEventLog().some((event) => ACTIVATION_EVENTS.has(event.name));
}
