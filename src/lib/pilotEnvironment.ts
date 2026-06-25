/** Browser capability checks for pilot deployments (PILOT-1). */

import { PILOT_BROWSER_LIMITS } from '../constants/pilotCopy';

export interface PilotEnvironmentStatus {
  secureContext: boolean;
  opfsAvailable: boolean;
  recommendedBrowser: boolean;
  warnings: string[];
}

function detectRecommendedBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isChromium = /Chrome|Edg\//.test(ua) && !/OPR|Opera/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  return isChromium || isSafari;
}

export async function assessPilotEnvironment(): Promise<PilotEnvironmentStatus> {
  const secureContext = typeof globalThis !== 'undefined' && globalThis.isSecureContext === true;
  let opfsAvailable = false;

  if (secureContext && typeof navigator !== 'undefined' && navigator.storage?.getDirectory) {
    try {
      await navigator.storage.getDirectory();
      opfsAvailable = true;
    } catch {
      opfsAvailable = false;
    }
  }

  const recommendedBrowser = detectRecommendedBrowser();
  const warnings: string[] = [];

  if (!secureContext) {
    warnings.push('Velocity requires HTTPS or localhost. Open the app in a secure context.');
  }
  if (!opfsAvailable) {
    warnings.push(
      'Browser storage (OPFS) is unavailable. You can analyze files but may need to re-upload after closing the tab.',
    );
  }
  if (!recommendedBrowser) {
    warnings.push(`Pilot builds are validated on ${PILOT_BROWSER_LIMITS.recommendedBrowsers}.`);
  }
  warnings.push(PILOT_BROWSER_LIMITS.singleTab);

  return { secureContext, opfsAvailable, recommendedBrowser, warnings };
}
