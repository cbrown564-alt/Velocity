import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { getMotionProps, useReducedMotion, DURATIONS } from '../../lib/motion';

export type AnalysisErrorSurface = 'table' | 'chart';

export interface AnalysisErrorFallbackProps {
  surface: AnalysisErrorSurface;
  slideId?: string;
  message?: string;
  onRetry?: () => void;
}

export const AnalysisErrorFallback: React.FC<AnalysisErrorFallbackProps> = ({
  surface,
  slideId,
  message,
  onRetry,
}) => {
  const reducedMotion = useReducedMotion();
  const headline = surface === 'chart' ? "This chart couldn't render" : "This table couldn't render";

  return (
    <div
      {...getMotionProps({ preset: 'fadeUp', duration: DURATIONS.enter, reducedMotion })}
      className="w-full h-full min-h-[12rem] rounded-xl flex flex-col items-center justify-center gap-4 p-8 bg-[var(--status-error-surface)] border border-[var(--status-error-border)] text-center"
      role="alert"
    >
      <AlertCircle size={32} className="text-[var(--color-error)]" aria-hidden />
      <div className="space-y-1 max-w-md">
        <p className="text-base font-medium text-[var(--text-primary)]">{headline}</p>
        {slideId ? <p className="text-xs text-[var(--text-secondary)]">Slide: {slideId}</p> : null}
        {message ? <p className="text-sm text-[var(--text-secondary)] break-words">{message}</p> : null}
        <p className="text-sm text-[var(--text-secondary)]">
          Try again, or change the variables on the canvas. The rest of the app is still available.
        </p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--text-inverse)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <RefreshCw size={14} aria-hidden />
          Retry
        </button>
      ) : null}
    </div>
  );
};
