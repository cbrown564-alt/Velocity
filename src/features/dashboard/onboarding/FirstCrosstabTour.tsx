import React from 'react';
import { X } from 'lucide-react';
import type { FirstCrosstabTourStep } from './firstCrosstabTour';
import { FIRST_CROSSTAB_TOUR_STEPS } from './firstCrosstabTour';
import { useFirstCrosstabTour } from '../hooks/useFirstCrosstabTour';

interface FirstCrosstabTourProps {
  step: FirstCrosstabTourStep | null;
  onDismiss: () => void;
}

/**
 * Fixed corner coaching chip for the first-crosstab activation tour (PPR-005).
 * Anchored bottom-left so hints never overlay hero table/chart output or stats footer.
 */
export const FirstCrosstabTour: React.FC<FirstCrosstabTourProps> = ({ step, onDismiss }) => {
  if (!step) return null;

  const copy = FIRST_CROSSTAB_TOUR_STEPS[step];

  return (
    <div
      role="status"
      data-testid="first-crosstab-tour"
      data-tour-step={step}
      className="fixed bottom-4 left-4 z-[var(--z-toast)] max-w-xs rounded-lg border border-[var(--border-color-muted)] bg-[var(--bg-panel)] px-3 py-2.5 shadow-lg pointer-events-auto"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--text-primary)]">{copy.title}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-secondary)]">{copy.body}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
          aria-label="Dismiss tour step"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md bg-[var(--color-accent)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-inverse)] hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

/** Dashboard overlay for the first-crosstab activation tour. */
export const FirstCrosstabTourOverlay: React.FC = () => {
  const { tourStep, dismissTourStep } = useFirstCrosstabTour();
  return <FirstCrosstabTour step={tourStep} onDismiss={dismissTourStep} />;
};
