import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceStatusStrip } from './WorkspaceStatusStrip';
import { resetWorkspaceStatusStripForTests } from '../lib/workspaceStatusStripSession';

vi.mock('../../../lib/pilotEnvironment', () => ({
  assessPilotEnvironment: vi.fn().mockResolvedValue({
    secureContext: true,
    opfsAvailable: true,
    recommendedBrowser: true,
    warnings: [],
  }),
}));

const resumeCandidate = {
  datasetId: 'ds-1',
  datasetName: 'Pilot Study.sav',
  summaryLine: 'Resume Gender × Region in Pilot Study.sav',
};

describe('WorkspaceStatusStrip', () => {
  beforeEach(() => {
    resetWorkspaceStatusStripForTests();
  });

  it('combines welcome-back and privacy into one strip', async () => {
    render(
      <WorkspaceStatusStrip
        showWelcomeBack
        resumeCandidate={resumeCandidate}
        onResume={vi.fn()}
        onDismissWelcomeBack={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('workspace-status-strip')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-status-welcome')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-status-pilot')).toBeInTheDocument();
    expect(screen.getByText(resumeCandidate.summaryLine)).toBeInTheDocument();
  });

  it('hides the strip for the rest of the session after dismiss', async () => {
    const onDismissWelcomeBack = vi.fn();

    render(
      <WorkspaceStatusStrip
        showWelcomeBack
        resumeCandidate={resumeCandidate}
        onResume={vi.fn()}
        onDismissWelcomeBack={onDismissWelcomeBack}
      />,
    );

    await screen.findByTestId('workspace-status-strip');
    fireEvent.click(screen.getByLabelText('Dismiss status'));

    expect(onDismissWelcomeBack).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByTestId('workspace-status-strip')).not.toBeInTheDocument();
    });

    render(
      <WorkspaceStatusStrip
        showWelcomeBack
        resumeCandidate={resumeCandidate}
        onResume={vi.fn()}
        onDismissWelcomeBack={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('workspace-status-strip')).not.toBeInTheDocument();
  });
});
