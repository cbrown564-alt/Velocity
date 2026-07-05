import React from 'react';
import { CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';

interface StorageStatusIndicatorProps {
  hasDataset: boolean;
  persistentStorageGranted: boolean | null;
  opfsAvailable: boolean;
}

export const StorageStatusIndicator: React.FC<StorageStatusIndicatorProps> = ({
  hasDataset,
  persistentStorageGranted,
  opfsAvailable,
}) => {
  if (!hasDataset) return null;

  if (!opfsAvailable) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--status-warning-text)] bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] rounded px-2 py-1">
        <ShieldAlert size={12} />
        <span>Limited storage - session will not persist between visits</span>
      </div>
    );
  }

  // Normal states stay quiet: a standing amber/green box for the browser
  // default is alarm fatigue. Storage Health (PersistenceStatus) carries the
  // detail; only genuine degradation (no OPFS above) warrants warning color.
  if (persistentStorageGranted === true) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
        <CheckCircle2 size={12} className="shrink-0 opacity-70" />
        <span>Session stored in this browser</span>
      </div>
    );
  }

  if (persistentStorageGranted === false) {
    return (
      <div
        className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"
        title="The browser may clear local data under storage pressure. Export a session file for a durable copy."
      >
        <AlertCircle size={12} className="shrink-0 opacity-70" />
        <span>Session stored locally</span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] opacity-70">
      <AlertCircle size={12} className="shrink-0" />
      <span>Checking storage durability...</span>
    </div>
  );
};
