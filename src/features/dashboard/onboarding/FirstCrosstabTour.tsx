import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { FirstCrosstabTourStep } from './firstCrosstabTour';
import { FIRST_CROSSTAB_TOUR_STEPS } from './firstCrosstabTour';
import { useFirstCrosstabTour } from '../hooks/useFirstCrosstabTour';

interface FirstCrosstabTourProps {
  step: FirstCrosstabTourStep | null;
  onDismiss: () => void;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureTarget(selector: string): HighlightRect | null {
  const element = document.querySelector(selector);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  const pad = 6;
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

/**
 * Non-blocking spotlight coachmark for the first-crosstab activation tour (UXF-011).
 */
export const FirstCrosstabTour: React.FC<FirstCrosstabTourProps> = ({ step, onDismiss }) => {
  const [rect, setRect] = useState<HighlightRect | null>(null);

  const updateRect = useCallback(() => {
    if (!step) {
      setRect(null);
      return;
    }
    setRect(measureTarget(FIRST_CROSSTAB_TOUR_STEPS[step].target));
  }, [step]);

  useEffect(() => {
    updateRect();
    if (!step) return;

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    const timer = window.setInterval(updateRect, 400);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      window.clearInterval(timer);
    };
  }, [step, updateRect]);

  if (!step || !rect) return null;

  const copy = FIRST_CROSSTAB_TOUR_STEPS[step];
  const cardTop = Math.min(rect.top + rect.height + 12, window.innerHeight - 160);
  const cardLeft = Math.min(Math.max(rect.left, 12), window.innerWidth - 320);

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-popover)] pointer-events-none" data-testid="first-crosstab-tour">
      <div
        aria-hidden
        className="absolute rounded-lg border-2 border-[var(--color-accent)] shadow-[0_0_0_9999px_rgb(0_0_0_/0.35)]"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
      />
      <div
        role="status"
        className="absolute w-[min(20rem,calc(100vw-1.5rem))] pointer-events-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-xl"
        style={{ top: cardTop, left: cardLeft }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{copy.title}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)] leading-relaxed">{copy.body}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss tour step"
            className="shrink-0 rounded-md p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--text-primary)]"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--text-inverse)] hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** Dashboard overlay for the first-crosstab activation tour. */
export const FirstCrosstabTourOverlay: React.FC = () => {
  const { tourStep, dismissTourStep } = useFirstCrosstabTour();
  return <FirstCrosstabTour step={tourStep} onDismiss={dismissTourStep} />;
};
