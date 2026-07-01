import React from 'react';
import { AnalysisErrorFallback, type AnalysisErrorSurface } from './AnalysisErrorFallback';

export interface AnalysisErrorBoundaryProps {
  children: React.ReactNode;
  surface: AnalysisErrorSurface;
  slideId?: string;
  /** When this value changes, a prior error is cleared (e.g. table config hash). */
  resetKey?: string;
  onRetry?: () => void;
}

interface AnalysisErrorBoundaryState {
  error: Error | null;
}

export class AnalysisErrorBoundary extends React.Component<AnalysisErrorBoundaryProps, AnalysisErrorBoundaryState> {
  state: AnalysisErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AnalysisErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: AnalysisErrorBoundaryProps): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[AnalysisErrorBoundary:${this.props.surface}]`, error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <AnalysisErrorFallback
          surface={this.props.surface}
          slideId={this.props.slideId}
          message={this.state.error.message}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
