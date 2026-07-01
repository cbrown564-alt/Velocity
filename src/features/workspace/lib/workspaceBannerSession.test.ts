import { describe, it, expect, beforeEach } from 'vitest';
import {
  dismissWorkspaceBannerForSession,
  isWorkspaceBannerSessionDismissed,
  resetWorkspaceBannerSessionDismissals,
} from './workspaceBannerSession';

describe('workspaceBannerSession', () => {
  beforeEach(() => {
    resetWorkspaceBannerSessionDismissals();
  });

  it('tracks session dismissals independently per banner id', () => {
    expect(isWorkspaceBannerSessionDismissed('pilot-environment')).toBe(false);
    dismissWorkspaceBannerForSession('pilot-environment');
    expect(isWorkspaceBannerSessionDismissed('pilot-environment')).toBe(true);
    expect(isWorkspaceBannerSessionDismissed('welcome-back')).toBe(false);
  });

  it('clears session dismissals on reset', () => {
    dismissWorkspaceBannerForSession('welcome-back');
    resetWorkspaceBannerSessionDismissals();
    expect(isWorkspaceBannerSessionDismissed('welcome-back')).toBe(false);
  });
});
