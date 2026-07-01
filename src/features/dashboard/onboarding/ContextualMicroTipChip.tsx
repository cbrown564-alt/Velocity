import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { MicroTipDefinition } from './contextualMicroTips';

interface ContextualMicroTipChipProps {
  tip: MicroTipDefinition;
  onDismiss: () => void;
}

interface ChipPosition {
  top: number;
  left: number;
}

function resolveChipPosition(anchor: Element): ChipPosition {
  const rect = anchor.getBoundingClientRect();
  const maxLeft = window.innerWidth - 280;

  return {
    top: rect.bottom + 8,
    left: Math.max(12, Math.min(rect.left, maxLeft)),
  };
}

export const ContextualMicroTipChip: React.FC<ContextualMicroTipChipProps> = ({ tip, onDismiss }) => {
  const [position, setPosition] = useState<ChipPosition | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      const anchor = document.querySelector(`[data-testid="${tip.anchorTestId}"]`);
      if (!anchor) {
        setPosition(null);
        return;
      }

      setPosition(resolveChipPosition(anchor));
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
