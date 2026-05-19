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

  if (persistentStorageGranted === true) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--color-success)] bg-[var(--status-success-surface)] border border-[var(--status-success-border)] rounded px-2 py-1">
        <CheckCircle2 size={12} />
        <span>Session stored securely in this browser</span>
      </div>
    );
  }

  if (persistentStorageGranted === false) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--status-warning-text)] bg-[var(--status-warning-surface)] border border-[var(--status-warning-border)] rounded px-2 py-1">
        <AlertCircle size={12} />
        <span>Session stored locally - may be cleared by browser</span>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-color-muted)] rounded px-2 py-1">
      <AlertCircle size={12} />
      <span>Checking storage durability...</span>
    </div>
  );
};
