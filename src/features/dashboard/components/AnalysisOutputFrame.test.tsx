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

  it('marks bleed mode for focus presentation', () => {
    const { container } = render(
      <AnalysisOutputFrame bleed>
        <span>body</span>
      </AnalysisOutputFrame>,
    );

    expect(container.querySelector('.analysis-frame')).toHaveAttribute('data-bleed', 'true');
  });

  it('shrink-wraps frame height to content when frameClassName is shrink-wrap', () => {
    const { container } = render(
      <AnalysisOutputFrame frameClassName="shrink-wrap">
        <table>
          <tbody>
            <tr>
              <td>cell</td>
            </tr>
          </tbody>
        </table>
      </AnalysisOutputFrame>,
    );

    const frame = container.querySelector('.analysis-frame');
    expect(frame?.className).toMatch(/shrinkWrap/);
  });

  it('keeps bleed styling when shrink-wrapped with bleed enabled', () => {
    const { container } = render(
      <AnalysisOutputFrame bleed frameClassName="shrink-wrap">
        <span>body</span>
      </AnalysisOutputFrame>,
    );

    const frame = container.querySelector('.analysis-frame');
    expect(frame).toHaveAttribute('data-bleed', 'true');
    expect(frame?.className).toMatch(/shrinkWrap/);
    expect(frame?.className).toMatch(/bleed/);
  });
});
