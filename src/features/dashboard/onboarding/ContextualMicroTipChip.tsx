import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { MicroTipDefinition } from './contextualMicroTips';

interface ContextualMicroTipChipProps {
  tip: MicroTipDefinition;
  onDismiss: () => void;
}

export const ContextualMicroTipChip: React.FC<ContextualMicroTipChipProps> = ({ tip, onDismiss }) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      const anchor = document.querySelector(`[data-testid="${tip.anchorTestId}"]`);
      if (!anchor) {
        setPosition(null);
        return;
      }

      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 320)),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [tip.anchorTestId]);

  if (!position) return null;

  return (
    <div
      role="status"
      data-testid={`micro-tip-${tip.id}`}
      className="fixed z-[var(--z-toast)] max-w-xs rounded-lg border border-[var(--border-color-muted)] bg-[var(--bg-panel)] px-3 py-2.5 shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-primary)]">{tip.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)]">{tip.body}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
          aria-label="Dismiss tip"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
