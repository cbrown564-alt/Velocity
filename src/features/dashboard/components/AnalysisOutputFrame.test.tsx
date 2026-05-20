import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisOutputFrame } from './AnalysisOutputFrame';

describe('AnalysisOutputFrame', () => {
  it('renders shared analysis-frame shell with body content', () => {
    const { container } = render(
      <AnalysisOutputFrame>
        <table><tbody><tr><td>47.7%</td></tr></tbody></table>
      </AnalysisOutputFrame>
    );

    expect(container.querySelector('.analysis-frame')).toBeInTheDocument();
    expect(screen.getByText('47.7%')).toBeInTheDocument();
  });

  it('renders footer band when provided', () => {
    render(
      <AnalysisOutputFrame footer={<div>χ² = 12.4</div>}>
        <span>body</span>
      </AnalysisOutputFrame>
    );

    expect(screen.getByText('χ² = 12.4')).toBeInTheDocument();
  });

  it('marks bleed mode for focus presentation', () => {
    const { container } = render(
      <AnalysisOutputFrame bleed>
        <span>body</span>
      </AnalysisOutputFrame>
    );

    expect(container.querySelector('.analysis-frame')).toHaveAttribute('data-bleed', 'true');
  });
});
