import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisOutputFrame } from './AnalysisOutputFrame';

describe('AnalysisOutputFrame', () => {
  it('renders shared analysis-frame shell with body content', () => {
    const { container } = render(
      <AnalysisOutputFrame>
        <table>
          <tbody>
            <tr>
              <td>47.7%</td>
            </tr>
          </tbody>
        </table>
      </AnalysisOutputFrame>,
    );

    expect(container.querySelector('.analysis-frame')).toBeInTheDocument();
    expect(screen.getByText('47.7%')).toBeInTheDocument();
  });

  it('renders footer band when provided', () => {
    render(
      <AnalysisOutputFrame footer={<div>χ² = 12.4</div>}>
        <span>body</span>
      </AnalysisOutputFrame>,
    );

    expect(screen.getByText('χ² = 12.4')).toBeInTheDocument();
  });

  it('marks bleed mode for focus presentation', () => {
    const { container } = render(
      <AnalysisOutputFrame bleed>
        <span>body</span>
      </AnalysisOutputFrame>,
    );

    expect(container.querySelector('.analysis-frame')).toHaveAttribute('data-bleed', 'true');
  });

  it('renders footer band as sibling after body when footer prop is set', () => {
    const { container } = render(
      <AnalysisOutputFrame footer={<div data-testid="stats-footer">footer</div>}>
        <div data-testid="table-body">body</div>
      </AnalysisOutputFrame>,
    );

    const frame = container.querySelector('.analysis-frame');
    const children = frame?.children;
    expect(children?.length).toBe(2);
    expect(children?.[0]?.textContent).toContain('body');
    expect(children?.[1]?.textContent).toContain('footer');
    expect(screen.getByTestId('stats-footer')).toBeInTheDocument();
  });
});
