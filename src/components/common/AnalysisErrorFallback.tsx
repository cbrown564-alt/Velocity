import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export type AnalysisErrorSurface = 'table' | 'chart';

export interface AnalysisErrorFallbackProps {
  surface: AnalysisErrorSurface;
  slideId?: string;
  message?: string;
  onRetry?: () => void;
}

export const AnalysisErrorFallback: React.FC<AnalysisErrorFallbackProps> = ({ surface, slideId, message, onRetry }) => {
  const headline = surface === 'chart' ? 'Chart failed to render' : 'Table failed to render';

  return (
    <div
      className="w-full h-full min-h-[12rem] rounded-xl flex flex-col items-center justify-center gap-4 p-8 bg-[var(--status-error-surface)] border border-[var(--status-error-border)] text-center"
      role="alert"
    >
      <AlertCircle size={32} className="text-[var(--color-error)]" aria-hidden />
      <div className="space-y-1 max-w-md">
        <p className="text-[13px] font-medium text-[var(--text-primary)]">{headline}</p>
        {slideId ? <p className="text-[11px] text-[var(--text-tertiary)]">Slide {slideId}</p> : null}
        {message ? <p className="text-[13px] text-[var(--text-secondary)] break-words">{message}</p> : null}
        <p className="text-[13px] text-[var(--text-secondary)]">Change variables and retry.</p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-accent)] text-[var(--text-inverse)] text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          <RefreshCw size={14} aria-hidden />
          Retry
        </button>
      ) : null}
    </div>
  );
};
