import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, ShieldCheck } from 'lucide-react';
import { assessPilotEnvironment, type PilotEnvironmentStatus } from '../../lib/pilotEnvironment';
import { PILOT_PRIVACY_HEADLINE } from '../../constants/pilotCopy';

const DISMISS_KEY = 'velocity-pilot-env-banner-dismissed';

export const PilotEnvironmentBanner: React.FC = () => {
  const [status, setStatus] = useState<PilotEnvironmentStatus | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(DISMISS_KEY) === '1';
  });

  useEffect(() => {
    void assessPilotEnvironment().then(setStatus);
  }, []);

  if (!status || dismissed) return null;

  const hasWarnings =
    !status.secureContext || !status.opfsAvailable || !status.recommendedBrowser;

  return (
    <div
      className="mx-4 mt-3 rounded-lg border border-[var(--border-color-muted)] bg-[var(--bg-panel)] px-4 py-3 text-sm"
      data-testid="pilot-environment-banner"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[var(--text-primary)]">
            <ShieldCheck size={16} className="shrink-0 text-[var(--color-accent)]" />
            <span className="font-medium">{PILOT_PRIVACY_HEADLINE}</span>
          </div>
          {hasWarnings && (
            <ul className="space-y-1 text-[var(--status-warning-text)]">
              {status.warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            localStorage.setItem(DISMISS_KEY, '1');
          }}
          className="shrink-0 rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
          aria-label="Dismiss environment notice"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
