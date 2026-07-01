import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceStatusStrip } from './WorkspaceStatusStrip';
import type { ResumeCandidate } from '../lib/returningResearcher';

vi.mock('../../../lib/pilotEnvironment', () => ({
  assessPilotEnvironment: vi.fn(async () => ({
    secureContext: true,
    opfsAvailable: true,
    recommendedBrowser: true,
    warnings: [],
  })),
}));

const candidate: ResumeCandidate = {
  datasetId: 'ds-1',
  datasetName: 'mock_data.sav',
  summaryLine: 'Resume gender × region in mock_data.sav',
};

describe('WorkspaceStatusStrip', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('shows welcome back card when available', () => {
    render(
      <WorkspaceStatusStrip
        showWelcomeBack
        resumeCandidate={candidate}
        onResume={vi.fn()}
        onDismissWelcomeBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId('welcome-back-card')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-status-strip')).not.toBeInTheDocument();
  });

  it('shows combined privacy strip when welcome back is unavailable', async () => {
    render(
      <WorkspaceStatusStrip
        showWelcomeBack={false}
        resumeCandidate={null}
        onResume={vi.fn()}
        onDismissWelcomeBack={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('workspace-status-strip')).toBeInTheDocument();
    expect(screen.getByText(/never leaves this device/i)).toBeInTheDocument();
  });

  it('hides pilot strip for the session after dismiss', async () => {
    render(
      <WorkspaceStatusStrip
        showWelcomeBack={false}
        resumeCandidate={null}
        onResume={vi.fn()}
        onDismissWelcomeBack={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /dismiss workspace notice/i }));

    expect(screen.queryByTestId('workspace-status-strip')).not.toBeInTheDocument();
  });
});
