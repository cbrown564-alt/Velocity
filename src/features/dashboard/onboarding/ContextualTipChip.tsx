import React from 'react';
import { X } from 'lucide-react';
import { CONTEXTUAL_TIPS, dismissContextualTip, type ContextualTipId } from './contextualMicroTips';

export interface ContextualTipChipProps {
  tipId: ContextualTipId;
  onAction?: () => void;
  onDismiss: () => void;
}

export const ContextualTipChip: React.FC<ContextualTipChipProps> = ({ tipId, onAction, onDismiss }) => {
  const tip = CONTEXTUAL_TIPS[tipId];

  const handleDismiss = () => {
    dismissContextualTip(tipId);
    onDismiss();
  };

  return (
    <div
      className="pointer-events-auto flex items-start gap-3 rounded-lg border border-[var(--border-color-muted)] bg-[var(--bg-panel)] px-3 py-2.5 text-sm shadow-lg max-w-md"
      data-testid={`contextual-tip-${tipId}`}
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--text-primary)]">{tip.title}</p>
        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{tip.body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {tip.actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="rounded-md px-2 py-1 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--bg-active)] transition-colors"
          >
            {tip.actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
          aria-label={`Dismiss ${tip.title} tip`}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
