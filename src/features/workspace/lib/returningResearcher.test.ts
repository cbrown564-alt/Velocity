import { describe, it, expect, beforeEach } from 'vitest';
import type { StoredDataset } from '../types';
import { useVelocityStore } from '../../../store';
import { findResumeCandidate, formatDeckSummaryTooltip } from './returningResearcher';
import { MS_THREE_DAYS, computeActivityTouchPatch, shouldShowWelcomeBack } from '../../../lib/welcomeBack';

const baseDataset = (overrides: Partial<StoredDataset> = {}): StoredDataset => ({
  id: 'ds-1',
  name: 'mock_data',
  fileName: 'mock_data.sav',
  rowCount: 100,
  columnCount: 10,
  fileSize: 1024,
  source: 'sav',
  createdAt: Date.now() - 7 * MS_THREE_DAYS,
  lastOpenedAt: Date.now() - MS_THREE_DAYS,
  lastModifiedAt: Date.now() - 3_600_000,
  starred: false,
  ...overrides,
});

describe('returningResearcher', () => {
  it('computeActivityTouchPatch resets welcome-back after long absence', () => {
    const now = 1_700_000_000_000;
    const stale = now - MS_THREE_DAYS - 1;
    expect(computeActivityTouchPatch({ lastActiveAt: stale, welcomeBackDismissed: true }, now)).toEqual({
      welcomeBackDismissed: false,
    });
  });

  it('computeActivityTouchPatch defers lastActiveAt after long absence', () => {
    const now = 1_700_000_000_000;
    const stale = now - MS_THREE_DAYS - 1;
    const patch = computeActivityTouchPatch({ lastActiveAt: stale, welcomeBackDismissed: false }, now);
    expect(patch).toEqual({ welcomeBackDismissed: false });
    expect(patch).not.toHaveProperty('lastActiveAt');
  });

  it('computeActivityTouchPatch updates lastActiveAt for recent activity', () => {
    const now = 1_700_000_000_000;
    expect(computeActivityTouchPatch({ lastActiveAt: now - 60_000, welcomeBackDismissed: true }, now)).toEqual({
      lastActiveAt: now,
    });
  });

  it('shouldShowWelcomeBack after three days away', () => {
    const now = Date.now();
    expect(shouldShowWelcomeBack(now - MS_THREE_DAYS - 1, false, now)).toBe(true);
    expect(shouldShowWelcomeBack(now - MS_THREE_DAYS + 86_400_000, false, now)).toBe(false);
    expect(shouldShowWelcomeBack(now - MS_THREE_DAYS - 1, true, now)).toBe(false);
  });

  it('findResumeCandidate prefers active dataset with live table config', () => {
    const datasets = [
      baseDataset({
        id: 'other',
        sessionState: {
          tableConfig: { rowVars: ['old'], colVar: 'x' },
          activeFilters: [],
          transformLog: [],
        },
      }),
      baseDataset({ id: 'active', lastModifiedAt: Date.now() - 1000 }),
    ];
    const candidate = findResumeCandidate(datasets, 'active', { rowVars: ['gender'], colVar: 'region' }, Date.now());
    expect(candidate?.datasetId).toBe('active');
    expect(candidate?.summaryLine).toMatch(/gender.*region/i);
  });

  it('formatDeckSummaryTooltip includes variables and filters', () => {
    const tip = formatDeckSummaryTooltip(
      baseDataset({
        variables: [
          { id: 'gender', name: 'gender', label: 'Gender', type: 'categorical', valueLabels: [], missingValues: {} },
          { id: 'region', name: 'region', label: 'Region', type: 'categorical', valueLabels: [], missingValues: {} },
        ],
        sessionState: {
          tableConfig: { rowVars: ['gender'], colVar: 'region' },
          activeFilters: [{ id: 'f1', variableId: 'gender', operator: 'eq', value: 1 }],
          transformLog: [
            {
              type: 'recode',
              sourceColId: 'gender',
              newColId: 'gender_recoded',
              label: 'Gender recoded',
              config: { mode: 'categorical', rules: [] },
              createdAt: 0,
            },
          ],
        },
      }),
    );
    expect(tip).toMatch(/Gender × Region/);
    expect(tip).toMatch(/active filter/);
    expect(tip).toMatch(/saved transform/);
  });
});

describe('touchLastActiveAt welcome-back reset', () => {
  beforeEach(() => {
    useVelocityStore.setState({
      lastActiveAt: Date.now() - MS_THREE_DAYS - 1,
      welcomeBackDismissed: true,
    });
  });

  it('clears welcomeBackDismissed after a long absence', () => {
    useVelocityStore.getState().touchLastActiveAt();
    expect(useVelocityStore.getState().welcomeBackDismissed).toBe(false);
  });

  it('defers lastActiveAt update until welcome-back is acknowledged', () => {
    const stale = Date.now() - MS_THREE_DAYS - 1;
    useVelocityStore.setState({ lastActiveAt: stale });
    useVelocityStore.getState().touchLastActiveAt();
    expect(useVelocityStore.getState().lastActiveAt).toBe(stale);
  });

  it('updates lastActiveAt when activity was recent', () => {
    const recent = Date.now() - 60_000;
    useVelocityStore.setState({ lastActiveAt: recent, welcomeBackDismissed: false });
    useVelocityStore.getState().touchLastActiveAt();
    expect(useVelocityStore.getState().lastActiveAt).toBeGreaterThan(recent);
  });

  it('keeps welcomeBackDismissed when activity was recent', () => {
    useVelocityStore.setState({
      lastActiveAt: Date.now() - 1000,
      welcomeBackDismissed: true,
    });
    useVelocityStore.getState().touchLastActiveAt();
    expect(useVelocityStore.getState().welcomeBackDismissed).toBe(true);
  });
});
