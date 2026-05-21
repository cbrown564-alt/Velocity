import { describe, it, expect, beforeEach } from 'vitest';
import type { StoredDataset } from '../components/WorkspaceView';
import { useVelocityStore } from '../../../store';
import {
  MS_THREE_DAYS,
  findResumeCandidate,
  formatDeckSummaryTooltip,
  shouldShowWelcomeBack,
} from './returningResearcher';

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
    const candidate = findResumeCandidate(
      datasets,
      'active',
      { rowVars: ['gender'], colVar: 'region' },
      Date.now(),
    );
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
          activeFilters: [{ id: 'f1' }],
          transformLog: [{ type: 'recode' }],
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

  it('keeps welcomeBackDismissed when activity was recent', () => {
    useVelocityStore.setState({
      lastActiveAt: Date.now() - 1000,
      welcomeBackDismissed: true,
    });
    useVelocityStore.getState().touchLastActiveAt();
    expect(useVelocityStore.getState().welcomeBackDismissed).toBe(true);
  });
});
