import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SignificanceLegend } from './SignificanceLegend';

describe('SignificanceLegend', () => {
  describe('compact mode', () => {
    it('renders compact legend with CI labels', () => {
      render(<SignificanceLegend compact />);

      expect(screen.getByText('95% CI')).toBeInTheDocument();
      expect(screen.getByText('80% CI')).toBeInTheDocument();
    });

    it('shows methodology link when enabled', () => {
      render(<SignificanceLegend compact showMethodologyLink />);

      expect(screen.getByText('How we calculate')).toBeInTheDocument();
    });

    it('calls onMethodologyClick when link is clicked', () => {
      const handleClick = vi.fn();
      render(
        <SignificanceLegend compact showMethodologyLink onMethodologyClick={handleClick} />
      );

      fireEvent.click(screen.getByText('How we calculate'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('hides methodology link when disabled', () => {
      render(<SignificanceLegend compact showMethodologyLink={false} />);

      expect(screen.queryByText('How we calculate')).not.toBeInTheDocument();
    });

    it('shows correction badge when correction is active', () => {
      render(<SignificanceLegend compact correctionType="fdr" />);
      expect(screen.getByText('Benjamini-Hochberg (FDR)')).toBeInTheDocument();
    });
  });

  describe('full mode', () => {
    it('renders full legend with 95% and 80% sections', () => {
      render(<SignificanceLegend />);

      expect(screen.getByText('95% Confidence')).toBeInTheDocument();
      expect(screen.getByText('80% Confidence')).toBeInTheDocument();
    });

    it('shows all significance descriptions', () => {
      render(<SignificanceLegend />);

      expect(screen.getByText('Significantly higher than rest')).toBeInTheDocument();
      expect(screen.getByText('Significantly lower than rest')).toBeInTheDocument();
      expect(screen.getByText('Moderately higher than rest')).toBeInTheDocument();
      expect(screen.getByText('Moderately lower than rest')).toBeInTheDocument();
    });

    it('shows methodology footer', () => {
      render(<SignificanceLegend />);

      expect(screen.getByText(/Welch's T-Test/)).toBeInTheDocument();
      expect(screen.getByText(/Cell vs Rest/)).toBeInTheDocument();
    });

    it('shows selected correction method in footer', () => {
      render(<SignificanceLegend correctionType="bonferroni" />);
      expect(screen.getByText(/Multiple-testing correction: Bonferroni/)).toBeInTheDocument();
    });

    it('shows overlap correction note when enabled', () => {
      render(<SignificanceLegend overlapCorrected />);
      expect(screen.getByText(/Dependent-sample overlap correction is active/)).toBeInTheDocument();
    });

    it('renders header with title', () => {
      render(<SignificanceLegend />);

      expect(screen.getByText('Statistical Significance')).toBeInTheDocument();
    });
  });
});
