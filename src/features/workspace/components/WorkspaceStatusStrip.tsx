/**
 * Combined workspace status strip — at most one full-width banner (STAB-UI-F3.4).
 * Priority: welcome back > pilot warnings > privacy headline.
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import { assessPilotEnvironment, type PilotEnvironmentStatus } from '../../../lib/pilotEnvironment';
import { PILOT_PRIVACY_HEADLINE } from '../../../constants/pilotCopy';
import { WelcomeBackCard } from './WelcomeBackCard';
import type { ResumeCandidate } from '../lib/returningResearcher';
import {
  dismissWorkspaceBannerForSession,
  isWorkspaceBannerSessionDismissed,
} from '../lib/workspaceBannerSession';

export interface WorkspaceStatusStripProps {
  showWelcomeBack: boolean;
  resumeCandidate: ResumeCandidate | null;
  onResume: () => void;
  onDismissWelcomeBack: () => void;
}

export const WorkspaceStatusStrip: React.FC<WorkspaceStatusStripProps> = ({
  showWelcomeBack,
  resumeCandidate,
  onResume,
  onDismissWelcomeBack,
}) => {
  const [status, setStatus] = useState<PilotEnvironmentStatus | null>(null);
  const [pilotDismissed, setPilotDismissed] = useState(() => isWorkspaceBannerSessionDismissed('pilot-environment'));
  const [welcomeDismissed, setWelcomeDismissed] = useState(() =>
    isWorkspaceBannerSessionDismissed('welcome-back'),
  );

  useEffect(() => {
    void assessPilotEnvironment().then(setStatus);
  }, []);

  const canShowWelcomeBack = showWelcomeBack && resumeCandidate && !welcomeDismissed;
  const hasPilotWarnings = Boolean(status && (!status.secureContext || !status.opfsAvailable || !status.recommendedBrowser));
  const canShowPilotStrip = !canShowWelcomeBack && status && !pilotDismissed;

  if (!canShowWelcomeBack && !canShowPilotStrip) {
    return null;
  }

  if (canShowWelcomeBack && resumeCandidate) {
    return (
      <WelcomeBackCard
        candidate={resumeCandidate}
        onResume={onResume}
        onDismiss={() => {
          dismissWorkspaceBannerForSession('welcome-back');
          setWelcomeDismissed(true);
          onDismissWelcomeBack();
        }}
      />
    );
  }

  if (!canShowPilotStrip || !status) return null;

  return (
    <div
      className="mx-4 mt-3 rounded-lg border border-[var(--border-color-muted)] bg-[var(--bg-panel)] px-4 py-2.5 text-sm"
      data-testid="workspace-status-strip"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <ShieldCheck size={16} className="shrink-0 text-[var(--text-secondary)]" />
            <span className="font-medium">{PILOT_PRIVACY_HEADLINE}</span>
          </div>
          {hasPilotWarnings && (
            <ul className="space-y-0.5 text-[var(--status-warning-text)]">
              {status.warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2 text-xs">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            dismissWorkspaceBannerForSession('pilot-environment');
            setPilotDismissed(true);
          }}
          className="shrink-0 rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
          aria-label="Dismiss workspace notice"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
