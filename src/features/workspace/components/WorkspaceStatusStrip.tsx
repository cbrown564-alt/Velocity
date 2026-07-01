/**
 * Combined workspace status strip — privacy, environment warnings, and welcome-back
 * in a single dismissible banner (STAB-UI-F3.4).
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Sparkles, X } from 'lucide-react';
import { assessPilotEnvironment, type PilotEnvironmentStatus } from '../../../lib/pilotEnvironment';
import { PILOT_PRIVACY_HEADLINE } from '../../../constants/pilotCopy';
import type { ResumeCandidate } from '../lib/returningResearcher';
import {
  dismissPilotEnvironmentPermanently,
  dismissWorkspaceStatusForSession,
  isPilotPermanentlyDismissed,
  isSessionDismissed,
} from '../lib/workspaceStatusStripSession';
import styles from './WorkspaceStatusStrip.module.css';

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
  const [sessionDismissed, setSessionDismissed] = useState(isSessionDismissed);
  const [pilotDismissed, setPilotDismissed] = useState(isPilotPermanentlyDismissed);
  const [status, setStatus] = useState<PilotEnvironmentStatus | null>(null);

  useEffect(() => {
    void assessPilotEnvironment().then(setStatus);
  }, []);

  if (sessionDismissed) return null;

  const hasPilotWarnings = Boolean(
    status && (!status.secureContext || !status.opfsAvailable || !status.recommendedBrowser),
  );
  const showPilotSection = Boolean(status) && !pilotDismissed;
  const showWelcomeSection = showWelcomeBack && resumeCandidate;

  if (!showWelcomeSection && !showPilotSection) return null;

  const handleDismiss = () => {
    setSessionDismissed(true);
    dismissWorkspaceStatusForSession();
    if (showWelcomeSection) {
      onDismissWelcomeBack();
    }
    if (showPilotSection) {
      setPilotDismissed(true);
      dismissPilotEnvironmentPermanently();
    }
  };

  return (
    <div className={styles.strip} data-testid="workspace-status-strip">
      <div className={styles.content}>
        {showWelcomeSection && (
          <div className={styles.welcomeSection} data-testid="workspace-status-welcome">
            <Sparkles size={16} className={styles.welcomeIcon} aria-hidden />
            <div className={styles.welcomeCopy}>
              <p className={styles.eyebrow}>Welcome back</p>
              <p className={styles.summary}>{resumeCandidate.summaryLine}</p>
            </div>
            <button type="button" className={styles.resumeButton} onClick={onResume}>
              Resume
            </button>
          </div>
        )}

        {showPilotSection && (
          <div
            className={`${styles.pilotSection} ${showWelcomeSection ? styles.pilotSectionBordered : ''}`}
            data-testid="workspace-status-pilot"
          >
            <div className={styles.pilotCopy}>
              <div className={styles.pilotHeadline}>
                <ShieldCheck size={16} className={styles.pilotIcon} aria-hidden />
                <span>{PILOT_PRIVACY_HEADLINE}</span>
              </div>
              {hasPilotWarnings && status && (
                <ul className={styles.warningList}>
                  {status.warnings.map((warning) => (
                    <li key={warning}>
                      <AlertTriangle size={12} aria-hidden />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <button type="button" className={styles.dismissButton} onClick={handleDismiss} aria-label="Dismiss status">
        <X size={16} />
      </button>
    </div>
  );
};
