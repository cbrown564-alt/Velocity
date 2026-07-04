import { describe, it, expect, beforeEach } from 'vitest';
import {
  STORAGE_KEY,
  dismissPaletteOnboarding,
  resetPaletteOnboardingForTests,
  resolvePaletteOnboardingWorkspaceId,
  shouldShowPaletteOnboarding,
} from './paletteOnboarding';

describe('paletteOnboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    resetPaletteOnboardingForTests();
  });

  it('resolves workspace id from active dataset first', () => {
    expect(resolvePaletteOnboardingWorkspaceId('active-1', 'dataset-1')).toBe('active-1');
    expect(resolvePaletteOnboardingWorkspaceId(null, 'dataset-1')).toBe('dataset-1');
    expect(resolvePaletteOnboardingWorkspaceId(null, null)).toBeNull();
  });

  it('shows onboarding for a workspace until dismissed', () => {
    expect(shouldShowPaletteOnboarding('ws-1')).toBe(true);
    dismissPaletteOnboarding('ws-1');
    expect(shouldShowPaletteOnboarding('ws-1')).toBe(false);
  });

  it('persists dismiss across reads (session reopen simulation)', () => {
    dismissPaletteOnboarding('ws-1');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(['ws-1']));
    expect(shouldShowPaletteOnboarding('ws-1')).toBe(false);
  });

  it('scopes dismiss per workspace without affecting others', () => {
    dismissPaletteOnboarding('ws-1');
    expect(shouldShowPaletteOnboarding('ws-1')).toBe(false);
    expect(shouldShowPaletteOnboarding('ws-2')).toBe(true);
  });

  it('does not show when workspace id is missing', () => {
    expect(shouldShowPaletteOnboarding(null)).toBe(false);
  });
});
